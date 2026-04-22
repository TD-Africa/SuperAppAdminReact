import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Skeleton,
  Checkbox,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  AdminRoleDto,
  EditRoleRequest,
  PaginationResponse,
  PermissionResponse,
  RoleResponse,
} from "@/lib/types";
import { PERMISSION_GROUPS, humanPermissionName } from "@/lib/permissionGroups";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function RolesPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditRoles));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreateRoles));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanEditRoles));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleResponse | null>(null);

  const { data: permissions } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: async () => {
      const res = await apiGet<PermissionResponse[]>(
        "Authentication/GetPermissions",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load permissions");
      return res.data ?? [];
    },
    staleTime: 30 * 60_000,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const queryKey = ["admin-roles", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RoleResponse>>(
        `Authentication/GetRoles?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load roles");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<RoleResponse> = [
    {
      title: "Name",
      key: "name",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {r.id.slice(0, 8)}
          </div>
        </div>
      ),
    },
    {
      title: "Permissions",
      dataIndex: "permissions",
      align: "right",
      render: (v: unknown[]) => <Tag>{v?.length ?? 0}</Tag>,
    },
    {
      title: "",
      key: "actions",
      width: 100,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          {canEdit && (
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditId(r.id)} />
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
            Roles
          </Typography.Title>
          <Typography.Text type="secondary">
            Define permission bundles and assign them to admin users.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New role
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          placeholder="Search by role name…"
          value={keyword}
          allowClear
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<RoleResponse>
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
          locale={{ emptyText: "No roles defined yet." }}
        />
      </Card>

      <CreateRoleModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        permissions={permissions ?? []}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-roles"] })}
      />

      <EditRoleModal
        roleId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        permissions={permissions ?? []}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["admin-roles"] })}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "role"}?`}
        description="Users assigned to this role will lose its permissions."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(
            `Authentication/DeleteRole/${deleteTarget.id}`,
          );
          if (!res.status) throw new Error("delete-failed");
          queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
        }}
      />
    </div>
  );
}

// --- Create ---
function CreateRoleModal({
  open,
  onOpenChange,
  permissions,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: PermissionResponse[];
  onCreated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [name, setName] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName("");
      setPermissionIds([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (permissionIds.length === 0)
        throw new Error("Pick at least one permission");
      const payload: AdminRoleDto = { name: name.trim(), permissionIds };
      const res = await apiPost<boolean>("Authentication/AddRole", payload);
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Role created";
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
      title="New role"
      width={1000}
      confirmLoading={mutation.isPending}
      okText="Create role"
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse Manager"
          />
        </Form.Item>
      </Form>
      <PermissionMatrix
        permissions={permissions}
        value={permissionIds}
        onChange={setPermissionIds}
      />
    </Modal>
  );
}

// --- Edit ---
function EditRoleModal({
  roleId,
  open,
  onOpenChange,
  permissions,
  onUpdated,
}: {
  roleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: PermissionResponse[];
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [name, setName] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-role", roleId],
    queryFn: async () => {
      if (!roleId) return null;
      const res = await apiGet<RoleResponse>(`Authentication/GetRole/${roleId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load role");
      return res.data;
    },
    enabled: !!roleId && open,
  });

  useEffect(() => {
    if (data) {
      setName(data.name);
      const ids = (data.permissions ?? [])
        .map((p) => p.id)
        .filter((id): id is string => !!id);
      setPermissionIds(ids);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!roleId) throw new Error("No role");
      const payload: EditRoleRequest = { name: name.trim(), permissionIds };
      const res = await apiPatch<boolean>(
        `Authentication/EditRole/${roleId}`,
        payload,
      );
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res.message ?? "Role updated";
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
      title={data?.name ?? "Edit role"}
      width={1000}
      confirmLoading={mutation.isPending}
      okText="Save changes"
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Form layout="vertical" requiredMark={false}>
            <Form.Item label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
          </Form>
          <PermissionMatrix
            permissions={permissions}
            value={permissionIds}
            onChange={setPermissionIds}
          />
        </>
      )}
    </Modal>
  );
}

// --- Permission matrix ---
interface PermissionMatrixProps {
  permissions: PermissionResponse[];
  value: string[];
  onChange: (value: string[]) => void;
}

function PermissionMatrix({ permissions, value, onChange }: PermissionMatrixProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const byName = useMemo(() => {
    const map = new Map<string, PermissionResponse>();
    for (const p of permissions) map.set(p.name, p);
    return map;
  }, [permissions]);

  const valueSet = useMemo(() => new Set(value), [value]);

  function toggle(id: string) {
    if (valueSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  const groups = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return PERMISSION_GROUPS.map((g) => {
      const items = g.permissions
        .map((name) => byName.get(name))
        .filter((p): p is PermissionResponse => !!p)
        .filter((p) => {
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            humanPermissionName(p.name).toLowerCase().includes(q) ||
            g.label.toLowerCase().includes(q)
          );
        });
      return { ...g, items };
    }).filter((g) => g.items.length > 0);
  }, [byName, debouncedSearch]);

  function toggleGroupAll(groupItems: PermissionResponse[], select: boolean) {
    const ids = groupItems.map((p) => p.id);
    const idSet = new Set(ids);
    if (select) {
      onChange(Array.from(new Set([...value, ...ids])));
    } else {
      onChange(value.filter((id) => !idSet.has(id)));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{value.length}</span>
          <span className="text-muted-foreground"> of {permissions.length} selected</span>
        </div>
        <Space size={4}>
          <Button size="small" onClick={() => onChange(permissions.map((p) => p.id))}>
            Select all
          </Button>
          <Button size="small" onClick={() => onChange([])}>
            Clear all
          </Button>
        </Space>
      </div>

      <Input
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter permissions…"
        allowClear
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const allSelected = g.items.every((p) => valueSet.has(p.id));
          const someSelected = g.items.some((p) => valueSet.has(p.id));
          return (
            <Card
              key={g.key}
              size="small"
              title={g.label}
              extra={
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => toggleGroupAll(g.items, !allSelected)}
                >
                  {allSelected ? "Clear" : "Select all"}
                </button>
              }
              className={someSelected ? "border-primary/40" : undefined}
            >
              <div className="space-y-1">
                {g.items.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent"
                  >
                    <Checkbox
                      checked={valueSet.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="text-sm">
                      {humanPermissionName(p.name)}
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No permissions match "{debouncedSearch}".
        </div>
      )}
    </div>
  );
}
