import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ALL = "__all__";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditSubUser));
  const canCreate = useAuthStore((s) =>
    s.hasPermission(Permission.CanCreateSubUser),
  );
  const canDelete = useAuthStore((s) =>
    s.hasPermission(Permission.CanDeleteSubUser),
  );

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
      toast.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      toast.success(res.message ?? "Admin updated");
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff accounts that can sign in to this dashboard.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New admin
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search by name, email, phone…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            value={isActive}
            onValueChange={(v) => {
              setPage(1);
              setIsActive(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No admin users match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{u.userName}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell className="text-xs">{u.phoneNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role?.name ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(v) => toggleActive(u, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditTarget(u)}
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
                            onClick={() => setDeleteTarget(u)}
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
          if (!res.status) {
            toast.error(res.message ?? "Delete failed");
            throw new Error("delete-failed");
          }
          toast.success(res.message ?? "Admin deleted");
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />
    </div>
  );
}

const createSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  userName: z.string().min(1, "Username is required"),
  phoneNumber: z.string().min(1, "Phone is required"),
  roleId: z.string().min(1, "Role is required"),
});
type CreateValues = z.infer<typeof createSchema>;

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
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      userName: "",
      phoneNumber: "",
      roleId: "",
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const roleId = watch("roleId");

  const mutation = useMutation({
    mutationFn: async (values: CreateValues) => {
      const payload: AdminUserDto = values;
      const res = await apiPost<boolean>("Authentication/RegisterUser", payload);
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Admin created";
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New admin</DialogTitle>
          <DialogDescription>Give the new admin their credentials and role.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <Field label="Username" error={errors.userName?.message}>
            <Input {...register("userName")} placeholder="johndoe" />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message}>
              <Input {...register("firstName")} placeholder="John" />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Input {...register("lastName")} placeholder="Doe" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="Phone" error={errors.phoneNumber?.message}>
              <Input {...register("phoneNumber")} placeholder="+2348012345678" />
            </Field>
          </div>
          <Field label="Role" error={errors.roleId?.message}>
            <Select
              value={roleId}
              onValueChange={(v) => setValue("roleId", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [roleId, setRoleId] = useState("");

  useEffect(() => {
    if (admin) {
      setFirstName(admin.firstName ?? "");
      setLastName(admin.lastName ?? "");
      setEmail(admin.email ?? "");
      setUserName(admin.userName ?? "");
      setPhoneNumber(admin.phoneNumber ?? "");
      setRoleId(admin.role?.id ?? "");
    }
  }, [admin]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!admin) throw new Error("No admin");
      const payload: EditAdminUserDto = {};
      if (firstName !== (admin.firstName ?? "")) payload.firstName = firstName;
      if (lastName !== (admin.lastName ?? "")) payload.lastName = lastName;
      if (email !== (admin.email ?? "")) payload.email = email;
      if (userName !== (admin.userName ?? "")) payload.userName = userName;
      if (phoneNumber !== (admin.phoneNumber ?? "")) payload.phoneNumber = phoneNumber;
      if (roleId && roleId !== admin.role?.id) payload.roleId = roleId;

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
      toast.success(msg);
      onUpdated();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit admin</DialogTitle>
          <DialogDescription>
            {admin ? admin.email : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Username">
            <Input value={userName} onChange={(e) => setUserName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="First name">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </Field>
          </div>
          <Field label="Role">
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
