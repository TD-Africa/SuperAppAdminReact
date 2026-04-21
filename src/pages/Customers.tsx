import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Download, Pencil, Plus, RotateCcw } from "lucide-react";
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
import { DataTablePagination } from "@/components/DataTablePagination";
import { PromptDialog } from "@/components/PromptDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateCustomerModal } from "@/components/customers/CreateCustomerModal";
import { EditCustomerModal } from "@/components/customers/EditCustomerModal";
import { formatDate, formatNumber } from "@/lib/utils";

const ALL = "__all__";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreateUser));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [status, setStatus] = useState<string>(ALL);
  const [joinedStart, setJoinedStart] = useState("");
  const [joinedEnd, setJoinedEnd] = useState("");
  const [orderStart, setOrderStart] = useState("");
  const [orderEnd, setOrderEnd] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<CustomerResponse | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<CustomerResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (status !== ALL) params.set("status", status);
    if (joinedStart) params.set("joinedStartDate", joinedStart);
    if (joinedEnd) params.set("joinedEndDate", joinedEnd);
    if (orderStart) params.set("orderStartDate", orderStart);
    if (orderEnd) params.set("orderEndDate", orderEnd);
    return params;
  }, [pageSize, page, debouncedKeyword, status, joinedStart, joinedEnd, orderStart, orderEnd]);

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
      toast.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      toast.success(res.message ?? "Updated");
    }
  }

  async function suspend(c: CustomerResponse, reason: string) {
    const res = await apiPatch<boolean>(`User/SuspendUser/${c.id}`, {
      suspend: true,
      reasonForSuspension: reason,
    });
    if (!res.status) {
      toast.error(res.message ?? "Suspend failed");
      return;
    }
    toast.success(res.message ?? "Customer suspended");
    refetch();
  }

  async function reactivate(c: CustomerResponse) {
    const res = await apiPatch<boolean>(`User/SuspendUser/${c.id}`, {
      suspend: false,
    });
    if (!res.status) {
      toast.error(res.message ?? "Reactivate failed");
      return;
    }
    toast.success(res.message ?? "Customer reactivated");
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
    setJoinedStart("");
    setJoinedEnd("");
    setOrderStart("");
    setOrderEnd("");
    setPage(1);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const statusVariant: Record<UserStatus, "success" | "warning" | "destructive" | "secondary"> = {
    Active: "success",
    Pending: "warning",
    Suspended: "destructive",
    Rejected: "destructive",
    Incomplete: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Browse partner/reseller accounts, credit status, and order history.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New customer
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-8"
            placeholder="Search by company, email, phone, Dynamics ID…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
          >
            <SelectTrigger className="md:col-span-4">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {UserStatusValues.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-2 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Joined date range</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={joinedStart}
                onChange={(e) => {
                  setPage(1);
                  setJoinedStart(e.target.value);
                }}
              />
              <Input
                type="date"
                value={joinedEnd}
                onChange={(e) => {
                  setPage(1);
                  setJoinedEnd(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Order date range</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={orderStart}
                onChange={(e) => {
                  setPage(1);
                  setOrderStart(e.target.value);
                }}
              />
              <Input
                type="date"
                value={orderEnd}
                onChange={(e) => {
                  setPage(1);
                  setOrderEnd(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex items-end md:col-span-12">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadFiltered}>
            <Download className="h-4 w-4" /> Download (filtered)
          </Button>
          <Button variant="outline" onClick={downloadAll}>
            <Download className="h-4 w-4" /> Download all
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Dynamics ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Credit txns</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No customers match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.companyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.phoneNumber ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.dynamicsId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.userStatus] ?? "default"}>
                        {c.userStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(c.numberOfOrders ?? 0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastOrderDate ? formatDate(c.lastOrderDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.isCreditTransactionEnabled}
                        disabled={!canEdit}
                        onCheckedChange={(v) => toggleCreditTransactions(c, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditId(c.id);
                            setEditOpen(true);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canEdit && !c.isSuspended && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setSuspendTarget(c)}
                            title="Suspend"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && c.isSuspended && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-emerald-600"
                            onClick={() => setReactivateTarget(c)}
                            title="Reactivate"
                          >
                            <RotateCcw className="h-4 w-4" />
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
