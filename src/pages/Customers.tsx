import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  DatePicker,
  Form,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ApiOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { apiGet, apiPatch, API_BASE_URL } from "@/lib/api";
import type {
  CustomerResponse,
  PaginationResponse,
  UserStatus,
} from "@/lib/types";
import { UserStatusValues } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate, formatNumber } from "@/lib/utils";
import { PromptDialog } from "@/components/PromptDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateCustomerModal } from "@/components/customers/CreateCustomerModal";
import { EditCustomerModal } from "@/components/customers/EditCustomerModal";
import { DynamicsLinkModal } from "@/components/customers/DynamicsLinkModal";
import { CustomerDetailModal } from "@/components/customers/CustomerDetailModal";

const { RangePicker } = DatePicker;
const ALL = "__all__";

const statusColor: Record<UserStatus, "success" | "warning" | "error" | "default"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "error",
  Rejected: "error",
  Incomplete: "default",
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreateUser));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [status, setStatus] = useState<string>(ALL);
  const [joinedRange, setJoinedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [orderRange, setOrderRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<CustomerResponse | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<CustomerResponse | null>(null);
  const [dynamicsTarget, setDynamicsTarget] = useState<CustomerResponse | null>(null);
  const [detailTarget, setDetailTarget] = useState<CustomerResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (status !== ALL) params.set("status", status);
    const [js, je] = joinedRange ?? [null, null];
    if (js) params.set("joinedStartDate", js.format("YYYY-MM-DD"));
    if (je) params.set("joinedEndDate", je.format("YYYY-MM-DD"));
    const [os, oe] = orderRange ?? [null, null];
    if (os) params.set("orderStartDate", os.format("YYYY-MM-DD"));
    if (oe) params.set("orderEndDate", oe.format("YYYY-MM-DD"));
    return params;
  }, [pageSize, page, debouncedKeyword, status, joinedRange, orderRange]);

  const queryKey = ["customers", queryParams.toString()];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<CustomerResponse>>(
        `User/GetUsers?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load customers");
      return res.data;
    },
  });

  async function toggleCreditTransactions(c: CustomerResponse, value: boolean) {
    const prev = queryClient.getQueryData<PaginationResponse<CustomerResponse>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<CustomerResponse>>(queryKey, {
        ...prev,
        data: prev.data.map((x) =>
          x.id === c.id ? { ...x, isCreditTransactionEnabled: value } : x,
        ),
      });
    }
    const res = await apiPatch<boolean>(`User/EditCustomerAccount/${c.id}`, {
      enableCreditTransactions: value,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? "Updated");
    }
  }

  async function suspend(c: CustomerResponse, reason: string) {
    const res = await apiPatch<boolean>(`User/SuspendUser/${c.id}`, {
      suspend: true,
      reasonForSuspension: reason,
    });
    if (!res.status) {
      message.error(res.message ?? "Suspend failed");
      return;
    }
    message.success(res.message ?? "Customer suspended");
    refetch();
  }

  async function reactivate(c: CustomerResponse) {
    const res = await apiPatch<boolean>(`User/SuspendUser/${c.id}`, {
      suspend: false,
    });
    if (!res.status) {
      message.error(res.message ?? "Reactivate failed");
      return;
    }
    message.success(res.message ?? "Customer reactivated");
    refetch();
  }

  function downloadAll() {
    window.open(`${API_BASE_URL}User/DownloadCustomers`, "_blank");
  }

  function downloadFiltered() {
    window.open(`${API_BASE_URL}User/DownloadCustomers?${queryParams}`, "_blank");
  }

  function clearFilters() {
    setKeyword("");
    setStatus(ALL);
    setJoinedRange(null);
    setOrderRange(null);
    setPage(1);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<CustomerResponse> = [
    { title: "Company", dataIndex: "companyName", render: (v) => <span className="font-medium">{v ?? "—"}</span> },
    { title: "Email", dataIndex: "email", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    { title: "Phone", dataIndex: "phoneNumber", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v: string | null) =>
        v ? (
          <span className="text-xs text-muted-foreground">{v}</span>
        ) : (
          <Tag color="warning">Not linked</Tag>
        ),
    },
    {
      title: "Status",
      dataIndex: "userStatus",
      render: (v: UserStatus) => <Tag color={statusColor[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "Orders",
      dataIndex: "numberOfOrders",
      align: "right",
      render: (v) => formatNumber(v ?? 0),
    },
    {
      title: "Date joined",
      dataIndex: "dateCreated",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{v ? formatDate(v) : "—"}</span>
      ),
    },
    {
      title: "Last order",
      dataIndex: "lastOrderDate",
      render: (v) => <span className="text-xs text-muted-foreground">{v ? formatDate(v) : "—"}</span>,
    },
    {
      title: "Credit txns",
      dataIndex: "isCreditTransactionEnabled",
      render: (v: boolean, r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleCreditTransactions(r, val)} />
        </span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 180,
      align: "right",
      render: (_, r) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditId(r.id);
              setEditOpen(true);
            }}
          />
          {canEdit && (
            <Button
              size="small"
              icon={<ApiOutlined />}
              type={r.dynamicsId ? "default" : "primary"}
              onClick={() => setDynamicsTarget(r)}
              title={r.dynamicsId ? "Manage Dynamics link" : "Link to Dynamics"}
            />
          )}
          {canEdit && !r.isSuspended && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => setSuspendTarget(r)}
              title="Suspend"
            />
          )}
          {canEdit && r.isSuspended && (
            <Button
              size="small"
              icon={<UndoOutlined />}
              onClick={() => setReactivateTarget(r)}
              title="Reactivate"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Customers
          </Typography.Title>
          <Typography.Text type="secondary">
            Browse partner/reseller accounts, credit status, and order history.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New customer
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Form layout="vertical">
          <div className="grid gap-3 md:grid-cols-12">
            <Form.Item className="md:col-span-8 !mb-0" label="Search">
              <Input
                placeholder="Search by company, email, phone, Dynamics ID…"
                value={keyword}
                allowClear
                onChange={(e) => {
                  setPage(1);
                  setKeyword(e.target.value);
                }}
              />
            </Form.Item>
            <Form.Item className="md:col-span-4 !mb-0" label="Status">
              <Select
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                options={[
                  { value: ALL, label: "All statuses" },
                  ...UserStatusValues.map((s) => ({ value: s, label: s })),
                ]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-6 !mb-0" label="Joined date range">
              <RangePicker
                className="w-full"
                value={joinedRange}
                onChange={(v) => setJoinedRange(v ? [v[0], v[1]] : null)}
              />
            </Form.Item>
            <Form.Item className="md:col-span-6 !mb-0" label="Order date range">
              <RangePicker
                className="w-full"
                value={orderRange}
                onChange={(v) => setOrderRange(v ? [v[0], v[1]] : null)}
              />
            </Form.Item>
          </div>
          <div className="mt-3">
            <Button size="small" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </Form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : null}
        </span>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={downloadFiltered}>
            Download (filtered)
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadAll}>
            Download all
          </Button>
        </Space>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CustomerResponse>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: "No customers match the current filters." }}
          onRow={(record) => ({
            onClick: () => setDetailTarget(record),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <CreateCustomerModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />

      <EditCustomerModal
        customerId={editId}
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditId(null);
        }}
        onUpdated={() => refetch()}
      />

      <DynamicsLinkModal
        customer={dynamicsTarget}
        open={!!dynamicsTarget}
        onOpenChange={(v) => !v && setDynamicsTarget(null)}
        onLinked={() => refetch()}
      />

      <CustomerDetailModal
        customer={detailTarget}
        open={!!detailTarget}
        onOpenChange={(v) => !v && setDetailTarget(null)}
      />

      <PromptDialog
        open={!!suspendTarget}
        onOpenChange={(v) => !v && setSuspendTarget(null)}
        title={`Suspend ${suspendTarget?.companyName ?? "customer"}?`}
        description="Provide a reason — the customer will see this when signing in."
        label="Reason for suspension"
        placeholder="e.g. Outstanding balance, suspected fraud…"
        confirmLabel="Suspend"
        destructive
        onConfirm={(reason) =>
          suspendTarget ? suspend(suspendTarget, reason) : undefined
        }
      />

      <ConfirmDialog
        open={!!reactivateTarget}
        onOpenChange={(v) => !v && setReactivateTarget(null)}
        title={`Reactivate ${reactivateTarget?.companyName ?? "customer"}?`}
        description="The customer will regain account access immediately."
        confirmLabel="Reactivate"
        onConfirm={() =>
          reactivateTarget ? reactivate(reactivateTarget) : undefined
        }
      />
    </div>
  );
}
