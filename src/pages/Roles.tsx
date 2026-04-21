import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTablePagination } from "@/components/DataTablePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function RolesPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditRoles));
  const canCreate = useAuthStore((s) =>
    s.hasPermission(Permission.CanCreateRoles),
  );
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Define permission bundles and assign them to admin users.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New role
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by role name…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {isFetching && !isLoading ? "Refreshing…" : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No roles defined yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {r.permissions?.length ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditId(r.id)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteTarget(r)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <CreateRoleModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        permissions={permissions ?? []}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
        }
      />

      <EditRoleModal
        roleId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        permissions={permissions ?? []}
        onUpdated={() =>
          queryClient.invalidateQueries({ queryKey: ["admin-roles"] })
        }
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
          if (!res.status) {
            toast.error(res.message ?? "Delete failed");
            throw new Error("delete-failed");
          }
          toast.success(res.message ?? "Role deleted");
          queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
        }}
      />
    </div>
  );
}

// --- Create role modal ---
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
      toast.success(msg);
      onCreated();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>
            Bundle a set of permissions under a named role.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse Manager"
            />
          </div>
          <PermissionMatrix
            permissions={permissions}
            value={permissionIds}
            onChange={setPermissionIds}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit role modal ---
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
      toast.success(msg);
      onUpdated();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Edit role"}</DialogTitle>
          <DialogDescription>
            Rename the role or change its permission set.
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <PermissionMatrix
              permissions={permissions}
              value={permissionIds}
              onChange={setPermissionIds}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    if (valueSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
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
      const next = Array.from(new Set([...value, ...ids]));
      onChange(next);
    } else {
      onChange(value.filter((id) => !idSet.has(id)));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{value.length}</span>
          <span className="text-muted-foreground">
            {" "}
            of {permissions.length} selected
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(permissions.map((p) => p.id))}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([])}
          >
            Clear all
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter permissions…"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const allSelected = g.items.every((p) => valueSet.has(p.id));
          const someSelected = g.items.some((p) => valueSet.has(p.id));
          return (
            <Card key={g.key} className={cn(someSelected && "border-primary/40")}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm">{g.label}</CardTitle>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => toggleGroupAll(g.items, !allSelected)}
                >
                  {allSelected ? "Clear" : "Select all"}
                </button>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {g.items.map((p) => (
                  <Label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent"
                  >
                    <Checkbox
                      checked={valueSet.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <span className="text-sm font-normal">
                      {humanPermissionName(p.name)}
                    </span>
                  </Label>
                ))}
              </CardContent>
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
