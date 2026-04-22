import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Modal,
  Form,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AdminUserDto,
  AdminUserReturnDto,
  EditAdminUserDto,
  PaginationResponse,
  RoleResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const ALL = "__all__";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditSubUser));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreateSubUser));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanDeleteSubUser));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUserReturnDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserReturnDto | null>(null);

  const { data: roles } = useQuery({
    queryKey: ["admin-roles-list"],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RoleResponse>>(
        "Authentication/GetRoles?PageSize=200&PageNumber=1",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load roles");
      return res.data?.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive]);

  const queryKey = ["admin-users", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<AdminUserReturnDto>>(
        `Authentication/GetAdminUsers?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load admins");
      return res.data;
    },
  });

  async function toggleActive(user: AdminUserReturnDto, value: boolean) {
    const prev =
      queryClient.getQueryData<PaginationResponse<AdminUserReturnDto>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<AdminUserReturnDto>>(queryKey, {
        ...prev,
        data: prev.data.map((x) =>
          x.id === user.id ? { ...x, isActive: value } : x,
        ),
      });
    }
    const res = await apiPatch<boolean>(`Authentication/EditUser/${user.id}`, {
      isActive: value,
    } satisfies EditAdminUserDto);
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? "Admin updated");
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<AdminUserReturnDto> = [
    {
      title: "Name",
      key: "name",
      render: (_, r) => (
        <div>
          <div className="font-medium">
            {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
          </div>
          <div className="text-xs text-muted-foreground">@{r.userName}</div>
        </div>
      ),
    },
    { title: "Email", dataIndex: "email", render: (v) => <span className="text-xs">{v}</span> },
    { title: "Phone", dataIndex: "phoneNumber", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    {
      title: "Role",
      dataIndex: ["role", "name"],
      render: (v) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleActive(r, val)} />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          {canEdit && (
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditTarget(r)} />
          )}
          {canDelete && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteTarget(r)}
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
            Admin Users
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage staff accounts that can sign in to this dashboard.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New admin
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search by name, email, phone…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={isActive}
            onChange={(v) => {
              setPage(1);
              setIsActive(v);
            }}
            options={[
              { value: ALL, label: "All statuses" },
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<AdminUserReturnDto>
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
          locale={{ emptyText: "No admin users match the current filters." }}
        />
      </Card>

      <CreateAdminModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles ?? []}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["admin-users"] })
        }
      />

      <EditAdminModal
        admin={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        roles={roles ?? []}
        onUpdated={() =>
          queryClient.invalidateQueries({ queryKey: ["admin-users"] })
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.firstName ?? "admin"}?`}
        description="They'll lose access immediately. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(
            `Authentication/DeleteAdminUser/${deleteTarget.id}`,
          );
          if (!res.status) throw new Error("delete-failed");
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />
    </div>
  );
}

function CreateAdminModal({
  open,
  onOpenChange,
  roles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleResponse[];
  onCreated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<AdminUserDto>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: async (values: AdminUserDto) => {
      const res = await apiPost<boolean>("Authentication/RegisterUser", values);
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Admin created";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onCreated();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="New admin"
      width={720}
      confirmLoading={mutation.isPending}
      okText="Create admin"
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form<AdminUserDto>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Form.Item
          name="userName"
          label="Username"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="johndoe" />
        </Form.Item>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="firstName"
            label="First name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="John" />
          </Form.Item>
          <Form.Item
            name="lastName"
            label="Last name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="Doe" />
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="phoneNumber"
            label="Phone"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="+2348012345678" />
          </Form.Item>
        </div>
        <Form.Item
          name="roleId"
          label="Role"
          rules={[{ required: true, message: "Required" }]}
        >
          <Select
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Select a role"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function EditAdminModal({
  admin,
  open,
  onOpenChange,
  roles,
  onUpdated,
}: {
  admin: AdminUserReturnDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleResponse[];
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<
    AdminUserDto & { roleId?: string }
  >();

  useEffect(() => {
    if (admin && open) {
      form.setFieldsValue({
        firstName: admin.firstName ?? "",
        lastName: admin.lastName ?? "",
        email: admin.email ?? "",
        userName: admin.userName ?? "",
        phoneNumber: admin.phoneNumber ?? "",
        roleId: admin.role?.id ?? undefined,
      });
    }
  }, [admin, open, form]);

  const mutation = useMutation({
    mutationFn: async (values: AdminUserDto) => {
      if (!admin) throw new Error("No admin");
      const payload: EditAdminUserDto = {};
      if (values.firstName !== (admin.firstName ?? "")) payload.firstName = values.firstName;
      if (values.lastName !== (admin.lastName ?? "")) payload.lastName = values.lastName;
      if (values.email !== (admin.email ?? "")) payload.email = values.email;
      if (values.userName !== (admin.userName ?? "")) payload.userName = values.userName;
      if (values.phoneNumber !== (admin.phoneNumber ?? ""))
        payload.phoneNumber = values.phoneNumber;
      if (values.roleId && values.roleId !== admin.role?.id)
        payload.roleId = values.roleId;

      if (Object.keys(payload).length === 0) {
        return "No changes to save";
      }
      const res = await apiPatch<boolean>(
        `Authentication/EditUser/${admin.id}`,
        payload,
      );
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res.message ?? "Admin updated";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onUpdated();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="Edit admin"
      width={720}
      confirmLoading={mutation.isPending}
      okText="Save changes"
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => mutation.mutate(values as AdminUserDto)}
      >
        <Form.Item name="userName" label="Username">
          <Input />
        </Form.Item>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item name="firstName" label="First name">
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Last name">
            <Input />
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: "Enter a valid email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone">
            <Input />
          </Form.Item>
        </div>
        <Form.Item name="roleId" label="Role">
          <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
