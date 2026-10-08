import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  AuditOutlined,
  CheckOutlined,
  CloseOutlined,
  ShopOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  PaginationResponse,
  StaffAdminResponse,
  StaffRole,
  StaffStatus,
} from "@/lib/types";
import { StaffRoleValues } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PromptDialog } from "@/components/PromptDialog";
import { StaffAssignmentsModal } from "@/components/staff/StaffAssignmentsModal";

const ALL = "__all__";

const STATUS_COLOR: Record<StaffStatus, string> = {
  Pending: "warning",
  Active: "success",
  Rejected: "error",
  Deactivated: "default",
};

// Pending first: it is the approval queue, and the reason most admins open this page.
const STATUS_TABS: { key: StaffStatus | typeof ALL; label: string }[] = [
  { key: "Pending", label: "Pending" },
  { key: "Active", label: "Active" },
  { key: "Deactivated", label: "Deactivated" },
  { key: "Rejected", label: "Rejected" },
  { key: ALL, label: "All" },
];

type DialogState =
  | { kind: "approve"; row: StaffAdminResponse }
  | { kind: "reject"; row: StaffAdminResponse }
  | { kind: "deactivate"; row: StaffAdminResponse }
  | { kind: "reactivate"; row: StaffAdminResponse }
  | null;

function nameOf(row: StaffAdminResponse) {
  return row.displayName || row.email || "this staff member";
}

export default function StaffAccessPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canManage = useAuthStore((s) => s.hasPermission(Permission.CanManageStaff));
  const canViewAudit = useAuthStore((s) => s.hasPermission(Permission.CanViewAuditTrail));

  const [status, setStatus] = useState<StaffStatus | typeof ALL>("Pending");
  const [role, setRole] = useState<string>(ALL);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [approveRole, setApproveRole] = useState<StaffRole>("Staff");
  const [approving, setApproving] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [assignmentsFor, setAssignmentsFor] = useState<StaffAdminResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (status !== ALL) params.set("Status", status);
    if (role !== ALL) params.set("Role", role);
    return params;
  }, [pageSize, page, debouncedKeyword, status, role]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["staff", "list", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<StaffAdminResponse>>(
        `Staff/Query?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load staff");
      return res.data;
    },
  });

  // Badge on the Pending tab so the queue is visible from any other tab.
  const { data: pendingCount } = useQuery({
    queryKey: ["staff", "pending-count"],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<StaffAdminResponse>>(
        "Staff/Query?Status=Pending&PageSize=1&PageNumber=1",
      );
      if (!res.status) return 0;
      return Number(res.data?.count ?? 0);
    },
  });

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["staff"] });
  }

  async function runAction(
    request: Promise<{ status: boolean; message?: string | null }>,
    fallbackSuccess: string,
  ) {
    const res = await request;
    if (!res.status) {
      message.error(res.message ?? "Action failed");
    } else {
      message.success(res.message ?? fallbackSuccess);
    }
    // Refresh either way: a failure is usually a stale status (someone else acted first).
    await refresh();
    return res.status;
  }

  async function approve() {
    if (dialog?.kind !== "approve") return;
    setApproving(true);
    try {
      const ok = await runAction(
        apiPost<StaffAdminResponse>(`Staff/Approve/${dialog.row.id}`, { role: approveRole }),
        "Staff member approved",
      );
      if (ok) setDialog(null);
    } finally {
      setApproving(false);
    }
  }

  async function changeRole(row: StaffAdminResponse, next: StaffRole) {
    if (next === row.role) return;
    setRoleSavingId(row.id);
    try {
      await runAction(
        apiPut<StaffAdminResponse>(`Staff/SetRole/${row.id}`, { role: next }),
        "Staff role updated",
      );
    } finally {
      setRoleSavingId(null);
    }
  }

  function openApprove(row: StaffAdminResponse) {
    setApproveRole(row.role ?? "Staff");
    setDialog({ kind: "approve", row });
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<StaffAdminResponse> = [
    {
      title: "Staff member",
      key: "who",
      render: (_, r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.displayName || "—"}</span>
          <span className="text-xs text-muted-foreground">{r.email ?? "—"}</span>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: StaffStatus) => <Tag color={STATUS_COLOR[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "Role",
      dataIndex: "role",
      width: 130,
      render: (v: StaffRole, r) =>
        // A pending/rejected row gets its role when it is approved, so only
        // rows that have been granted access are editable in place.
        canManage && (r.status === "Active" || r.status === "Deactivated") ? (
          <Select<StaffRole>
            size="small"
            className="w-24"
            value={v}
            loading={roleSavingId === r.id}
            disabled={roleSavingId === r.id}
            onChange={(next) => changeRole(r, next)}
            options={StaffRoleValues.map((x) => ({ value: x, label: x }))}
          />
        ) : (
          <Tag>{v}</Tag>
        ),
    },
    {
      title: status === "Pending" ? "Requested" : "Created",
      dataIndex: "dateCreated",
      width: 170,
      render: (v) => <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>,
    },
    {
      title: "Last sign-in",
      dataIndex: "lastLoginAt",
      width: 170,
      render: (v) => <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>,
    },
    {
      title: "Last status change",
      key: "changed",
      render: (_, r) =>
        r.statusChangedAt ? (
          <div className="flex flex-col text-xs">
            <span>{formatDateTime(r.statusChangedAt)}</span>
            <span className="text-muted-foreground">{r.statusChangedBy ?? "—"}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 330,
      align: "right",
      render: (_, r) => {
        // Assignments only matter once someone has been granted access; viewers
        // without CanManageStaff can still open them read-only.
        const assignments =
          r.status === "Active" || r.status === "Deactivated" ? (
            <Button size="small" icon={<ShopOutlined />} onClick={() => setAssignmentsFor(r)}>
              Assignments
            </Button>
          ) : null;
        if (!canManage) return assignments;
        return (
          <Space size={4}>
            {assignments}
            {statusActions(r)}
          </Space>
        );
      },
    },
  ];

  function statusActions(r: StaffAdminResponse) {
    switch (r.status) {
      case "Pending":
        return (
          <Space size={4}>
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openApprove(r)}>
              Approve
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => setDialog({ kind: "reject", row: r })}
            >
              Reject
            </Button>
          </Space>
        );
      case "Rejected":
        return (
          <Button size="small" icon={<CheckOutlined />} onClick={() => openApprove(r)}>
            Approve
          </Button>
        );
      case "Active":
        return (
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={() => setDialog({ kind: "deactivate", row: r })}
          >
            Deactivate
          </Button>
        );
      case "Deactivated":
        return (
          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={() => setDialog({ kind: "reactivate", row: r })}
          >
            Reactivate
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Staff Access
          </Typography.Title>
          <Typography.Text type="secondary">
            TD Africa staff request access by signing in to the staff portal with Microsoft.
            Nobody gets in until they are approved here. Changes reach the portal within about a minute.
          </Typography.Text>
        </div>
        {canViewAudit && (
          <Link to="/audit-trail?entityType=Staff">
            <Button icon={<AuditOutlined />}>Audit history</Button>
          </Link>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Tabs
          activeKey={status}
          onChange={(k) => {
            setPage(1);
            setStatus(k as StaffStatus | typeof ALL);
          }}
          items={STATUS_TABS.map((t) => ({
            key: t.key,
            label:
              t.key === "Pending" && pendingCount ? (
                <Space size={6}>
                  {t.label}
                  <Badge count={pendingCount} size="small" />
                </Space>
              ) : (
                t.label
              ),
          }))}
        />
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search by name or email…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={role}
            onChange={(v) => {
              setPage(1);
              setRole(v);
            }}
            options={[
              { value: ALL, label: "All roles" },
              ...StaffRoleValues.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StaffAdminResponse>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 960 }}
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
          locale={{
            emptyText: status === "Pending" ? "No pending access requests." : "No staff accounts.",
          }}
        />
      </Card>

      <Modal
        open={dialog?.kind === "approve"}
        title="Approve staff access"
        okText="Approve"
        confirmLoading={approving}
        onOk={approve}
        onCancel={() => setDialog(null)}
        destroyOnClose
      >
        {dialog?.kind === "approve" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Grant <span className="font-medium text-foreground">{nameOf(dialog.row)}</span>
              {dialog.row.email && dialog.row.displayName ? ` (${dialog.row.email})` : ""} access to
              the staff portal.
            </p>
            <div>
              <div className="mb-2 text-sm font-medium">Role</div>
              <Radio.Group
                value={approveRole}
                onChange={(e) => setApproveRole(e.target.value)}
              >
                <Space direction="vertical">
                  {StaffRoleValues.map((r) => (
                    <Radio key={r} value={r}>
                      {r}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </div>
          </div>
        )}
      </Modal>

      <PromptDialog
        open={dialog?.kind === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject access request"
        description={
          dialog?.kind === "reject"
            ? `${nameOf(dialog.row)} will not get staff portal access. You can still approve them later.`
            : undefined
        }
        label="Reason (optional, recorded in the audit log)"
        confirmLabel="Reject"
        destructive
        required={false}
        onConfirm={async (reason) => {
          if (dialog?.kind !== "reject") return;
          await runAction(
            apiPost<StaffAdminResponse>(`Staff/Reject/${dialog.row.id}`, { reason: reason || null }),
            "Access request rejected",
          );
        }}
      />

      <PromptDialog
        open={dialog?.kind === "deactivate"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Deactivate staff member"
        description={
          dialog?.kind === "deactivate"
            ? `${nameOf(dialog.row)} will lose staff portal access within about a minute. You can reactivate them later.`
            : undefined
        }
        label="Reason (optional, recorded in the audit log)"
        confirmLabel="Deactivate"
        destructive
        required={false}
        onConfirm={async (reason) => {
          if (dialog?.kind !== "deactivate") return;
          await runAction(
            apiPost<StaffAdminResponse>(`Staff/Deactivate/${dialog.row.id}`, { reason: reason || null }),
            "Staff member deactivated",
          );
        }}
      />

      <StaffAssignmentsModal
        staff={assignmentsFor}
        open={!!assignmentsFor}
        onOpenChange={(o) => !o && setAssignmentsFor(null)}
        canEdit={canManage}
      />

      <ConfirmDialog
        open={dialog?.kind === "reactivate"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reactivate staff member"
        description={
          dialog?.kind === "reactivate"
            ? `Restore staff portal access for ${nameOf(dialog.row)} as ${dialog.row.role}.`
            : undefined
        }
        confirmLabel="Reactivate"
        onConfirm={async () => {
          if (dialog?.kind !== "reactivate") return;
          await runAction(
            apiPost<StaffAdminResponse>(`Staff/Reactivate/${dialog.row.id}`),
            "Staff member reactivated",
          );
        }}
      />
    </div>
  );
}
