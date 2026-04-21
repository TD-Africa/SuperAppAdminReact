import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { LocationReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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

const ALL = "__all__";

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const canEditWarehouses = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditWarehouses),
  );
  const canSyncProducts = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditProducts),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive]);

  const queryKey = ["warehouses", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<LocationReturnDTO>>(
        `Location/GetAllLocations?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load warehouses");
      return res.data;
    },
  });

  async function toggleActive(id: string, value: boolean) {
    const prev =
      queryClient.getQueryData<PaginationResponse<LocationReturnDTO>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<LocationReturnDTO>>(queryKey, {
        ...prev,
        data: prev.data.map((w) =>
          w.id === id ? { ...w, isActive: value } : w,
        ),
      });
    }
    const res = await apiPatch<boolean>(`Location/UpdateLocation/${id}`, {
      IsApproved: value,
    });
    if (!res.status) {
      toast.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      toast.success(res.message ?? "Warehouse updated");
    }
  }

  async function syncProducts(id: string) {
    setSyncingId(id);
    const res = await apiPost<boolean>(`Product/SyncProductDetails/${id}`);
    setSyncingId(null);
    if (res.status) {
      toast.success(res.message ?? "Products synced");
    } else {
      toast.error(res.message ?? "Sync failed");
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
        <p className="text-sm text-muted-foreground">
          Manage warehouse locations and sync product inventory.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search warehouses by name or Dynamics ID…"
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
                <TableHead>Address</TableHead>
                <TableHead>Dynamics ID</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No warehouses match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {w.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.dynamicsId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={w.isActive}
                        disabled={!canEditWarehouses}
                        onCheckedChange={(v) => toggleActive(w.id, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!canSyncProducts || syncingId === w.id}
                        onClick={() => syncProducts(w.id)}
                        title="Sync products from this warehouse"
                      >
                        {syncingId === w.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
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
    </div>
  );
}
