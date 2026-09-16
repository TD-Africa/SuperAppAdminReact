import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  EyeOutlined,
  MailOutlined,
  ShopOutlined,
  StopOutlined,
  UndoOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch } from "@/lib/api";
import {
  getStorefrontOwners,
  inviteStorefrontOwner,
  resendStorefrontOwnerInvitation,
  revokeStorefrontOwnerInvitation,
} from "@/lib/storefrontApi";
import type { StorefrontOwnerDetailDto } from "@/lib/storefrontTypes";
import type { CustomerResponse, PaginationResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { EditCustomerModal } from "@/components/customers/EditCustomerModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PromptDialog } from "@/components/PromptDialog";

/**
 * Two tabs:
 *  - Invited:   store owners with an invitation, from `GetStorefrontOwners`.
 *  - Uninvited: CAC-verified customers (from `User/GetUsers`) who have not
 *               been invited yet.
 *
 * `GetOwnerCandidates` exists in the API but currently returns an empty list
 * on the backend, so we source uninvited owners from the Customers endpoint.
 */
type OwnerRow = {
  id: string;
  companyName: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  isCacVerified: boolean | null;
  isInvited: boolean;
  isInvitationAccepted: boolean;
  isSuspended: boolean;
  userStatus: string | null;
};

function ownerDisplayName(row: { firstName: string | null; lastName: string | null }) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function detailToRow(d: StorefrontOwnerDetailDto): OwnerRow {
  return {
    id: d.id ?? "",
    companyName: d.companyName,
    userName: d.userName,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    isCacVerified: d.isCacVerified,
    isInvited: d.isInvited,
    isInvitationAccepted: d.isInvitationAccepted,
    isSuspended: d.isSuspended,
    userStatus: d.userStatus,
  };
}

function customerToRow(c: CustomerResponse): OwnerRow {
  return {
    id: c.id,
    companyName: c.companyName,
    userName: c.userName,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    isCacVerified: c.isCacVerified,
    isInvited: false,
    isInvitationAccepted: false,
    isSuspended: c.isSuspended,
    userStatus: c.userStatus,
  };
}

function ownerLabel(row: OwnerRow) {
  const name = ownerDisplayName(row);
  const company = row.companyName?.trim();
  if (company && name) return `${company} — ${name}`;
  return company || name || row.userName || row.email || row.id;
}

function openOwnerPath(row: {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
}) {
  const params = new URLSearchParams();
  if (row.companyName?.trim()) params.set("company", row.companyName.trim());
  const name = ownerDisplayName(row);
  if (name) params.set("owner", name);
  if (row.userName?.trim()) params.set("user", row.userName.trim());
  const qs = params.toString();
  return `/franchise-store-owners/${row.id}${qs ? `?${qs}` : ""}`;
}

function inviteStatusTag(row: OwnerRow) {
  if (row.isInvitationAccepted) return <Tag color="success">Accepted</Tag>;
  if (row.isInvited) return <Tag color="processing">Invited</Tag>;
  return <Tag>Not invited</Tag>;
}

export default function FranchiseStoreOwnerInvitesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [activeTab, setActiveTab] = useState<"invited" | "uninvited">("uninvited");
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm] = Form.useForm<{ ownerId: string }>();
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<OwnerRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<OwnerRow | null>(null);
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));

  // Invited owners (with invite status) from GetStorefrontOwners.
  const invitedQuery = useQuery({
    queryKey: ["storefront", "storefront-owners"],
    queryFn: async () => {
      const res = await getStorefrontOwners({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load store owners");
      return (res.data?.data ?? []).map(detailToRow);
    },
    staleTime: 60_000,
  });

  // CAC-verified customers from User/GetUsers (paged, like Customers.tsx).
  const customersQuery = useQuery({
    queryKey: ["customers", "cac-verified"],
    queryFn: async () => {
      const FETCH_SIZE = 200;
      const all: CustomerResponse[] = [];
      let pageNumber = 1;
      let total = Infinity;
      while (all.length < total) {
        const res = await apiGet<PaginationResponse<CustomerResponse>>(
          `User/GetUsers?PageSize=${FETCH_SIZE}&PageNumber=${pageNumber}`,
        );
        if (!res.status) throw new Error(res.message ?? "Failed to load customers");
        const chunk = res.data?.data ?? [];
        all.push(...chunk);
        total = Number(res.data?.count ?? all.length);
        if (chunk.length === 0) break;
        pageNumber += 1;
      }
      return all.filter((c) => c.isCacVerified === true);
    },
  });

  useEffect(() => {
    if (invitedQuery.isError) {
      message.error(
        invitedQuery.error instanceof Error
          ? invitedQuery.error.message
          : "Unable to load invited store owners.",
      );
    }
  }, [invitedQuery.isError, invitedQuery.error, message]);

  useEffect(() => {
    if (customersQuery.isError) {
      message.error(
        customersQuery.error instanceof Error
          ? customersQuery.error.message
          : "Unable to load customers.",
      );
    }
  }, [customersQuery.isError, customersQuery.error, message]);

  const invitedRows = useMemo<OwnerRow[]>(() => invitedQuery.data ?? [], [invitedQuery.data]);

  const uninvitedRows = useMemo<OwnerRow[]>(() => {
    const customers = customersQuery.data ?? [];
    const invited = invitedRows;

    const invitedIds = new Set<string>();
    const invitedUserNames = new Set<string>();
    const invitedEmails = new Set<string>();
    for (const o of invited) {
      if (o.id) invitedIds.add(o.id);
      if (o.userName) invitedUserNames.add(o.userName.toLowerCase());
      if (o.email) invitedEmails.add(o.email.toLowerCase());
    }

    return customers
      .filter((c) => {
        if (invitedIds.has(c.id)) return false;
        if (c.userName && invitedUserNames.has(c.userName.toLowerCase())) return false;
        if (c.email && invitedEmails.has(c.email.toLowerCase())) return false;
        return true;
      })
      .map(customerToRow);
  }, [customersQuery.data, invitedRows]);

  const searchedInvited = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return invitedRows;
    return invitedRows.filter((r) =>
      [r.companyName, r.userName, r.firstName, r.lastName, r.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [invitedRows, debouncedSearch]);

  const searchedUninvited = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return uninvitedRows;
    return uninvitedRows.filter((r) =>
      [r.companyName, r.userName, r.firstName, r.lastName, r.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [uninvitedRows, debouncedSearch]);

  async function runOwnerAction(
    ownerId: string,
    action: "invite" | "resend" | "revoke",
  ) {
    setPendingOwnerId(ownerId);
    try {
      const res =
        action === "invite"
          ? await inviteStorefrontOwner(ownerId)
          : action === "resend"
            ? await resendStorefrontOwnerInvitation(ownerId)
            : await revokeStorefrontOwnerInvitation(ownerId);
      if (!res.status) {
        message.error(res.message ?? "Action failed");
      } else {
        message.success(res.message ?? "Done");
        queryClient.invalidateQueries({ queryKey: ["storefront", "storefront-owners"] });
      }
    } finally {
      setPendingOwnerId(null);
    }
  }

  async function submitManualInvite() {
    const values = await inviteForm.validateFields();
    const ownerId = values.ownerId.trim();
    if (!ownerId) return;
    setPendingOwnerId(ownerId);
    try {
      const res = await inviteStorefrontOwner(ownerId);
      if (!res.status) {
        message.error(res.message ?? "Invite failed");
        return;
      }
      message.success(res.message ?? "Invitation sent");
      inviteForm.resetFields();
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["storefront", "storefront-owners"] });
    } finally {
      setPendingOwnerId(null);
    }
  }

  function refreshOwners() {
    queryClient.invalidateQueries({ queryKey: ["storefront", "storefront-owners"] });
    queryClient.invalidateQueries({ queryKey: ["customers", "cac-verified"] });
  }

  async function suspendOwner(row: OwnerRow, reason: string) {
    const res = await apiPatch<boolean>(`User/SuspendUser/${row.id}`, {
      suspend: true,
      reasonForSuspension: reason,
    });
    if (!res.status) {
      message.error(res.message ?? "Suspend failed");
      return;
    }
    message.success(res.message ?? "Store owner suspended");
    refreshOwners();
  }

  async function reactivateOwner(row: OwnerRow) {
    const res = await apiPatch<boolean>(`User/SuspendUser/${row.id}`, {
      suspend: false,
    });
    if (!res.status) {
      message.error(res.message ?? "Reactivate failed");
      return;
    }
    message.success(res.message ?? "Store owner reactivated");
    refreshOwners();
  }

  const columns: TableColumnsType<OwnerRow> = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v: string | null, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-[#800020] hover:underline"
          onClick={() => navigate(openOwnerPath(row))}
        >
          {v?.trim() || "—"}
        </button>
      ),
    },
    {
      title: "Owner",
      key: "owner",
      render: (_, row) => ownerDisplayName(row) || "—",
    },
    {
      title: "Username",
      dataIndex: "userName",
      render: (v: string | null) => (
        <span className="text-xs text-muted-foreground">{v ?? "—"}</span>
      ),
    },
    {
      title: "CAC verified",
      dataIndex: "isCacVerified",
      width: 120,
      render: (v: boolean | null) => (
        <Tag color={v ? "success" : "default"}>{v ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, row) => {
        if (row.isSuspended) return <Tag color="error">Suspended</Tag>;
        if (row.userStatus === "Active") return <Tag color="success">Active</Tag>;
        if (row.userStatus) return <Tag color="warning">{row.userStatus}</Tag>;
        return <Tag>—</Tag>;
      },
    },
    {
      title: "Invite",
      key: "invite",
      width: 110,
      render: (_, row) => inviteStatusTag(row),
    },
    {
      title: "",
      key: "actions",
      width: 230,
      align: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(openOwnerPath(row))}
            title="View owner"
          />
          {canEdit && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditId(row.id);
                setEditOpen(true);
              }}
              title="Edit customer"
            />
          )}
          {!row.isInvited && (
            <Popconfirm
              title={`Invite ${ownerLabel(row)}?`}
              description="This will send a store owner invitation by email."
              okText="Invite"
              onConfirm={() => runOwnerAction(row.id, "invite")}
            >
              <Button
                size="small"
                icon={<MailOutlined />}
                loading={pendingOwnerId === row.id}
                title="Invite owner"
              />
            </Popconfirm>
          )}
          {row.isInvited && !row.isInvitationAccepted && (
            <>
              <Button
                size="small"
                icon={<MailOutlined />}
                loading={pendingOwnerId === row.id}
                onClick={() => runOwnerAction(row.id, "resend")}
                title="Resend invitation"
              />
              <Popconfirm
                title={`Revoke invitation for ${ownerLabel(row)}?`}
                okText="Revoke"
                okButtonProps={{ danger: true }}
                onConfirm={() => runOwnerAction(row.id, "revoke")}
              >
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  loading={pendingOwnerId === row.id}
                  title="Revoke invitation"
                />
              </Popconfirm>
            </>
          )}
          {canEdit && !row.isSuspended && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => setSuspendTarget(row)}
              title="Suspend"
            />
          )}
          {canEdit && row.isSuspended && (
            <Button
              size="small"
              icon={<UndoOutlined />}
              onClick={() => setReactivateTarget(row)}
              title="Reactivate"
            />
          )}
        </Space>
      ),
    },
  ];

  function renderTable(tableRows: OwnerRow[], loading: boolean) {
    return (
      <Table<OwnerRow>
        rowKey={(row) => row.id || row.userName || row.email || "unknown"}
        columns={columns}
        dataSource={tableRows}
        loading={loading}
        locale={{ emptyText: <Empty description="No store owners" /> }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total) => `${total} owner${total === 1 ? "" : "s"}`,
        }}
        scroll={{ x: 900 }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Store owner invites
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage store owner invitations for CAC-verified businesses
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => setInviteOpen(true)}
        >
          Invite store owner
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search company, name, username, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<ShopOutlined className="text-muted-foreground" />}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "invited" | "uninvited")}
          items={[
            {
              key: "uninvited",
              label: `Uninvited (${searchedUninvited.length})`,
              children: renderTable(searchedUninvited, customersQuery.isLoading || invitedQuery.isLoading),
            },
            {
              key: "invited",
              label: `Invited (${searchedInvited.length})`,
              children: renderTable(searchedInvited, invitedQuery.isLoading),
            },
          ]}
        />
      </Card>

      <Modal
        title="Invite store owner"
        open={inviteOpen}
        onCancel={() => {
          setInviteOpen(false);
          inviteForm.resetFields();
        }}
        onOk={submitManualInvite}
        okText="Send invite"
        confirmLoading={pendingOwnerId !== null}
        destroyOnClose
      >
        <Form form={inviteForm} layout="vertical">
          <Form.Item
            name="ownerId"
            label="Owner ID"
            rules={[{ required: true, whitespace: true, message: "Enter an owner ID" }]}
            extra="Enter the store owner's user ID manually (e.g. a CAC-registered user ID)."
          >
            <Input placeholder="e.g. a1b2c3d4-…" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <EditCustomerModal
        customerId={editId}
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditId(null);
        }}
        onUpdated={refreshOwners}
      />

      <PromptDialog
        open={!!suspendTarget}
        onOpenChange={(v) => !v && setSuspendTarget(null)}
        title={`Suspend ${suspendTarget ? ownerLabel(suspendTarget) : ""}?`}
        description="Provide a reason — the store owner will see this when signing in."
        label="Reason for suspension"
        placeholder="e.g. Outstanding balance, suspected fraud…"
        confirmLabel="Suspend"
        destructive
        onConfirm={(reason) =>
          suspendTarget ? suspendOwner(suspendTarget, reason) : undefined
        }
      />

      <ConfirmDialog
        open={!!reactivateTarget}
        onOpenChange={(v) => !v && setReactivateTarget(null)}
        title={`Reactivate ${reactivateTarget ? ownerLabel(reactivateTarget) : ""}?`}
        description="The store owner will regain account access immediately."
        confirmLabel="Reactivate"
        onConfirm={() =>
          reactivateTarget ? reactivateOwner(reactivateTarget) : undefined
        }
      />
    </div>
  );
}
