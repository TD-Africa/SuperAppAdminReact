import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Empty,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tabs,
} from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { getAllBrands } from "@/lib/storefrontApi";
import type {
  ApiResult,
  CustomerResponse,
  PaginationResponse,
  StaffAdminResponse,
  StaffAssignmentsResponse,
  StaffBrandAssignmentResponse,
  StaffPartnerAssignmentResponse,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type Tab = "partners" | "brands";

const SEARCH_PAGE_SIZE = 20;

// A route the API doesn't have yet comes back as a bare 404 with no Result
// envelope, so axios's own message is all fail() can pass on. A service-level
// NotFound (unknown staff id) carries an envelope with its own message.
function isMissingRoute(message: string | null | undefined) {
  return !!message && message.includes("status code 404");
}

function AssignedCell({ by, at }: { by: string | null; at: string }) {
  return (
    <div className="flex flex-col text-xs">
      <span>{formatDateTime(at)}</span>
      <span className="text-muted-foreground">{by ?? "—"}</span>
    </div>
  );
}

interface Props {
  staff: StaffAdminResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

export function StaffAssignmentsModal({ staff, open, onOpenChange, canEdit }: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const staffId = staff?.id ?? null;

  const [tab, setTab] = useState<Tab>("partners");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Each staff member and each tab is its own picker; don't carry a selection over.
  useEffect(() => {
    setTab("partners");
  }, [staffId]);
  useEffect(() => {
    setSearch("");
    setSelected([]);
  }, [staffId, tab]);

  const queryKey = ["staff", "assignments", staffId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<StaffAssignmentsResponse>(`Staff/GetAssignments/${staffId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load assignments");
      return res.data;
    },
    enabled: open && !!staffId,
    retry: false,
  });

  const notDeployed = isMissingRoute((error as Error | null)?.message);
  const assignedPartnerIds = new Set(data?.partners.map((p) => p.userId));
  const assignedBrandIds = new Set(data?.brands.map((b) => b.brandId));

  // GetUsers returns main accounts only, which is exactly what AssignPartners accepts.
  const partnerSearch = useQuery({
    queryKey: ["staff", "partner-search", debouncedSearch.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        PageSize: String(SEARCH_PAGE_SIZE),
        PageNumber: "1",
      });
      if (debouncedSearch.trim()) params.set("SearchString", debouncedSearch.trim());
      const res = await apiGet<PaginationResponse<CustomerResponse>>(
        `User/GetUsers?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to search partners");
      return res.data?.data ?? [];
    },
    enabled: open && canEdit && tab === "partners" && !!data,
  });

  const brandSearch = useQuery({
    queryKey: ["staff", "brand-search", debouncedSearch.trim()],
    queryFn: async () => {
      const res = await getAllBrands({
        PageSize: SEARCH_PAGE_SIZE,
        PageNumber: 1,
        SearchString: debouncedSearch.trim() || undefined,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to search brands");
      return res.data?.data ?? [];
    },
    enabled: open && canEdit && tab === "brands" && !!data,
  });

  function applyResult(res: ApiResult<StaffAssignmentsResponse>, fallback: string) {
    if (!res.status) {
      message.error(res.message ?? "Action failed");
      return false;
    }
    message.success(res.message ?? fallback);
    // Every endpoint returns the refreshed set, so no refetch is needed.
    if (res.data) queryClient.setQueryData(queryKey, res.data);
    return true;
  }

  async function assign() {
    if (!staffId || !selected.length) return;
    setSaving(true);
    try {
      const res =
        tab === "partners"
          ? await apiPost<StaffAssignmentsResponse>(`Staff/AssignPartners/${staffId}`, {
              userIds: selected,
            })
          : await apiPost<StaffAssignmentsResponse>(`Staff/AssignBrands/${staffId}`, {
              brandIds: selected,
            });
      if (applyResult(res, "Assigned")) {
        setSelected([]);
        setSearch("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function unassign(kind: Tab, id: string) {
    if (!staffId) return;
    setRemovingId(id);
    try {
      const url =
        kind === "partners"
          ? `Staff/UnassignPartner/${staffId}/${encodeURIComponent(id)}`
          : `Staff/UnassignBrand/${staffId}/${id}`;
      const res = await apiDelete<StaffAssignmentsResponse>(url);
      applyResult(res, kind === "partners" ? "Partner unassigned" : "Brand unassigned");
      // A failure is usually someone else having removed it already.
      if (!res.status) await queryClient.invalidateQueries({ queryKey });
    } finally {
      setRemovingId(null);
    }
  }

  function removeButton(kind: Tab, id: string, label: string) {
    if (!canEdit) return null;
    return (
      <Popconfirm
        title={`Unassign ${label}?`}
        okText="Unassign"
        okButtonProps={{ danger: true }}
        onConfirm={() => unassign(kind, id)}
      >
        <Button size="small" danger icon={<DeleteOutlined />} loading={removingId === id}>
          Remove
        </Button>
      </Popconfirm>
    );
  }

  const partnerColumns: TableColumnsType<StaffPartnerAssignmentResponse> = [
    {
      title: "Partner",
      key: "partner",
      render: (_, r) => (
        <div className="flex max-w-[280px] flex-col">
          <span className="truncate font-medium">{r.companyName || r.email || r.userId}</span>
          {r.companyName && r.email && (
            <span className="truncate text-xs text-muted-foreground">{r.email}</span>
          )}
        </div>
      ),
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      width: 120,
      render: (v: string | null) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    {
      title: "Assigned",
      key: "assigned",
      width: 200,
      render: (_, r) => <AssignedCell by={r.assignedBy} at={r.assignedAt} />,
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "right",
      render: (_, r) => removeButton("partners", r.userId, r.companyName || r.email || "this partner"),
    },
  ];

  const brandColumns: TableColumnsType<StaffBrandAssignmentResponse> = [
    {
      title: "Brand",
      dataIndex: "name",
      render: (v: string | null) => <span className="font-medium">{v ?? "—"}</span>,
    },
    {
      title: "Assigned",
      key: "assigned",
      width: 200,
      render: (_, r) => <AssignedCell by={r.assignedBy} at={r.assignedAt} />,
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "right",
      render: (_, r) => removeButton("brands", r.brandId, r.name || "this brand"),
    },
  ];

  const options =
    tab === "partners"
      ? (partnerSearch.data ?? []).map((u) => {
          const name = u.companyName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
          return {
            value: u.id,
            label: u.email && name !== u.email ? `${name} · ${u.email}` : name ?? u.id,
            disabled: assignedPartnerIds.has(u.id),
          };
        })
      : (brandSearch.data ?? []).map((b) => ({
          value: b.id,
          label: b.isActive ? b.name : `${b.name} (inactive)`,
          disabled: assignedBrandIds.has(b.id),
        }));
  const searching = tab === "partners" ? partnerSearch.isFetching : brandSearch.isFetching;

  const picker = canEdit && data && (
    <div className="mb-3 flex gap-2">
      <Select
        mode="multiple"
        className="flex-1"
        placeholder={tab === "partners" ? "Search partners by name, email or ID…" : "Search brands…"}
        value={selected}
        onChange={setSelected}
        showSearch
        searchValue={search}
        onSearch={setSearch}
        filterOption={false}
        options={options}
        notFoundContent={searching ? <Spin size="small" /> : "No matches"}
        maxTagCount="responsive"
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!selected.length}
        loading={saving}
        onClick={assign}
      >
        Assign{selected.length ? ` (${selected.length})` : ""}
      </Button>
    </div>
  );

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  } else if (notDeployed) {
    body = (
      <Alert
        type="warning"
        showIcon
        message="Assignments aren't available on this API yet"
        description="The Staff assignment endpoints exist in the backend (StaffPortal branch) but this admin API host doesn't serve them. They will work here once that build is deployed."
      />
    );
  } else if (error) {
    body = <Alert type="error" showIcon message={(error as Error).message} />;
  } else if (data) {
    body = (
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          {
            key: "partners",
            label: `Partners (${data.partners.length})`,
            children: (
              <>
                {staff?.role === "Lead" && (
                  <Alert
                    type="info"
                    showIcon
                    className="mb-3"
                    message="Leads see every partner in the staff portal, so partner assignments don't limit what this person sees."
                  />
                )}
                {picker}
                <Table<StaffPartnerAssignmentResponse>
                  rowKey="userId"
                  size="middle"
                  dataSource={data.partners}
                  columns={partnerColumns}
                  pagination={data.partners.length > 10 ? { pageSize: 10 } : false}
                  scroll={{ x: 640 }}
                  locale={{
                    emptyText: (
                      <Empty description="No partners assigned. Until some are, this person's book in the staff portal is empty." />
                    ),
                  }}
                />
              </>
            ),
          },
          {
            key: "brands",
            label: `Brands (${data.brands.length})`,
            children: (
              <>
                {picker}
                <Table<StaffBrandAssignmentResponse>
                  rowKey="brandId"
                  size="middle"
                  dataSource={data.brands}
                  columns={brandColumns}
                  pagination={data.brands.length > 10 ? { pageSize: 10 } : false}
                  locale={{ emptyText: <Empty description="No brands assigned." /> }}
                />
              </>
            ),
          },
        ]}
      />
    );
  }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={`Assignments — ${staff?.displayName || staff?.email || "Staff member"}`}
      width={860}
      footer={null}
      destroyOnClose
    >
      {body}
    </Modal>
  );
}
