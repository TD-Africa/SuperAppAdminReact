import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import { SearchOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  ACTION_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  auditActionColor,
  entityTypeLabel,
} from "@/lib/auditTrail";
import { AuditTrailDetailModal } from "@/components/audit/AuditTrailDetailModal";
import type {
  AdminAuditLogItem,
  AdminUserReturnDto,
  PaginationResponse,
} from "@/lib/types";

const { RangePicker } = DatePicker;

const ALL = "__all__";

export default function AuditTrailPage() {
  // The nav deep-links here pre-filtered (e.g. /audit-trail?entityType=Promo),
  // so the URL seeds the entity filter and re-applies whenever it changes.
  const [searchParams] = useSearchParams();
  const urlEntityType = searchParams.get("entityType") ?? "";

  const canViewAdmins = useAuthStore((s) =>
    s.hasPermission(Permission.CanViewSubUser),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [entityType, setEntityType] = useState<string>(urlEntityType || ALL);
  const [action, setAction] = useState<string>(ALL);
  const [entityId, setEntityId] = useState("");
  const debouncedEntityId = useDebouncedValue(entityId, 350);
  const [adminId, setAdminId] = useState<string>(ALL);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<AdminAuditLogItem | null>(null);

  useEffect(() => {
    setEntityType(urlEntityType || ALL);
    setPage(1);
  }, [urlEntityType]);

  // Only fetch the admin list when the viewer is allowed to see admins —
  // CanViewAuditTrail doesn't imply CanViewSubUser, and a 403 here would be
  // noise. Without it, the free-text search still matches admin name/email.
  const { data: admins } = useQuery({
    queryKey: ["audit-trail-admins"],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<AdminUserReturnDto>>(
        "Authentication/GetAdminUsers?PageSize=200&PageNumber=1",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load admins");
      return res.data?.data ?? [];
    },
    enabled: canViewAdmins,
    staleTime: 5 * 60_000,
  });

  const adminOptions = useMemo(
    () => [
      { value: ALL, label: "All admins" },
      ...(admins ?? []).map((a) => ({
        value: a.id,
        label: `${a.firstName} ${a.lastName}`.trim() || a.email,
      })),
    ],
    [admins],
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageNumber", String(page));
    params.set("PageSize", String(pageSize));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (entityType !== ALL) params.set("EntityType", entityType);
    if (action !== ALL) params.set("Action", action);
    if (debouncedEntityId.trim()) params.set("EntityId", debouncedEntityId.trim());
    if (adminId !== ALL) params.set("AdminId", adminId);
    const [from, to] = range ?? [null, null];
    // The backend compares against DateCreated inclusively, so widen to whole
    // days — otherwise picking "today" matches only midnight exactly.
    if (from) params.set("From", from.startOf("day").toISOString());
    if (to) params.set("To", to.endOf("day").toISOString());
    return params;
  }, [
    page,
    pageSize,
    debouncedKeyword,
    entityType,
    action,
    debouncedEntityId,
    adminId,
    range,
  ]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-trail", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<AdminAuditLogItem>>(
        `AuditLog/Query?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load audit trail");
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const total = Number(data?.count ?? 0);

  const hasFilters =
    !!keyword ||
    entityType !== ALL ||
    action !== ALL ||
    !!entityId ||
    adminId !== ALL ||
    !!range;

  function clearFilters() {
    setKeyword("");
    setEntityType(ALL);
    setAction(ALL);
    setEntityId("");
    setAdminId(ALL);
    setRange(null);
    setPage(1);
  }

  const columns: TableColumnsType<AdminAuditLogItem> = [
    {
      title: "When",
      dataIndex: "createdAt",
      width: 180,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Entity",
      dataIndex: "entityType",
      width: 170,
      render: (v: string, row) => (
        <div>
          <div className="text-sm font-medium">{entityTypeLabel(v)}</div>
          <Tooltip title={row.entityId}>
            <div className="font-mono text-xs text-muted-foreground">
              {row.entityId?.slice(0, 8) || "—"}
            </div>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      width: 140,
      render: (v: string) => <Tag color={auditActionColor(v)}>{v}</Tag>,
    },
    {
      title: "Admin",
      dataIndex: "adminEmail",
      render: (_: string, row) => (
        <div>
          <div className="text-sm font-medium">
            {row.adminName || row.adminEmail || "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.adminName && row.adminEmail ? row.adminEmail : row.roleName}
          </div>
        </div>
      ),
    },
    {
      title: "IP",
      dataIndex: "ipAddress",
      width: 140,
      render: (v: string | null) => (
        <span className="text-xs text-muted-foreground">{v || "—"}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      align: "right",
      render: (_, row) => (
        <Button size="small" onClick={() => setSelected(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Audit Trail
        </Typography.Title>
        <Typography.Text type="secondary">
          Every change an admin makes across the platform — promos, deals,
          coupons, brands, products, pricing and approvals — with the before and
          after state of each record.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Form layout="vertical">
          <div className="grid gap-3 md:grid-cols-12">
            <Form.Item className="md:col-span-4 !mb-0" label="Search">
              <Input
                placeholder="Admin name, email or entity ID…"
                value={keyword}
                prefix={<SearchOutlined />}
                onChange={(e) => {
                  setPage(1);
                  setKeyword(e.target.value);
                }}
                allowClear
              />
            </Form.Item>
            <Form.Item className="md:col-span-3 !mb-0" label="Entity type">
              <Select
                value={entityType}
                onChange={(v) => {
                  setPage(1);
                  setEntityType(v);
                }}
                options={[{ value: ALL, label: "All entities" }, ...ENTITY_TYPE_OPTIONS]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-2 !mb-0" label="Action">
              <Select
                value={action}
                onChange={(v) => {
                  setPage(1);
                  setAction(v);
                }}
                options={[{ value: ALL, label: "All actions" }, ...ACTION_OPTIONS]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-3 !mb-0" label="Entity ID">
              <Input
                placeholder="Exact record ID…"
                value={entityId}
                onChange={(e) => {
                  setPage(1);
                  setEntityId(e.target.value);
                }}
                allowClear
              />
            </Form.Item>
            {canViewAdmins && (
              <Form.Item className="md:col-span-4 !mb-0" label="Admin">
                <Select
                  value={adminId}
                  onChange={(v) => {
                    setPage(1);
                    setAdminId(v);
                  }}
                  options={adminOptions}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            )}
            <Form.Item className="md:col-span-6 !mb-0" label="Date range">
              <RangePicker
                className="w-full"
                value={range}
                onChange={(v) => {
                  setPage(1);
                  setRange(v ? [v[0], v[1]] : null);
                }}
              />
            </Form.Item>
          </div>
          {hasFilters && (
            <div className="mt-3">
              <Button size="small" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<AdminAuditLogItem>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `${t} entries`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "No audit entries match these filters."
                    : "No audit entries recorded yet."
                }
              />
            ),
          }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </Card>

      <AuditTrailDetailModal
        item={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
