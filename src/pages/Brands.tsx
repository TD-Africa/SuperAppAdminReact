import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageOff } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import type { BrandReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const ALL = "__all__";

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive]);

  const queryKey = ["brands", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<BrandReturnDTO>>(
        `brand/getAllBrands?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load brands");
      return res.data;
    },
  });

  async function toggleActive(id: string, value: boolean) {
    // The brand API expects { IsApproved: value }.
    const prev =
      queryClient.getQueryData<PaginationResponse<BrandReturnDTO>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<BrandReturnDTO>>(queryKey, {
        ...prev,
        data: prev.data.map((b) => (b.id === id ? { ...b, isActive: value } : b)),
      });
    }
    const res = await apiPatch<boolean>(`brand/updateBrand/${id}`, {
      IsApproved: value,
    });
    if (!res.status) {
      toast.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      toast.success(res.message ?? "Brand updated");
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brands</h1>
        <p className="text-sm text-muted-foreground">
          Manage brand catalog and approval state.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search brands by name or Dynamics ID…"
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
                <TableHead className="w-14"></TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Dynamics ID</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No brands match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-md border bg-muted">
                        {b.brandImageUrl ? (
                          <img
                            src={b.brandImageUrl}
                            alt={b.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <ImageOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.dynamicsId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={b.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(v) => toggleActive(b.id, v)}
                      />
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
