import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Eye, RefreshCw } from "lucide-react";
import { apiGet, apiPatch, apiPut, apiPost, API_BASE_URL } from "@/lib/api";
import type { PaginationResponse, ProductReturnDto } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

const ALL = "__all__";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [isFeatured, setIsFeatured] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    if (isFeatured !== ALL) params.set("isFeaturedProduct", isFeatured);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive, isFeatured]);

  const queryKey = ["products", queryParams.toString()];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<ProductReturnDto>>(
        `product/getProducts?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load products");
      return res.data;
    },
  });

  async function toggleField(
    id: string,
    field: "IsActive" | "IsFeaturedProduct",
    value: boolean,
  ) {
    const prev = queryClient.getQueryData<PaginationResponse<ProductReturnDto>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<ProductReturnDto>>(queryKey, {
        ...prev,
        data: prev.data.map((p) =>
          p.id === id
            ? {
                ...p,
                isActive: field === "IsActive" ? value : p.isActive,
                isFeaturedProduct:
                  field === "IsFeaturedProduct" ? value : p.isFeaturedProduct,
              }
            : p,
        ),
      });
    }
    const res = await apiPatch<boolean>(`product/editProduct/${id}`, {
      [field]: value,
    });
    if (!res.status) {
      toast.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      toast.success(res.message ?? "Updated");
    }
  }

  async function syncPrice(id: string) {
    const res = await apiPut<boolean>(`product/SyncProductPrice/${id}`);
    if (res.status) {
      toast.success(res.message ?? "Price synced");
      refetch();
    } else {
      toast.error(res.message ?? "Sync failed");
    }
  }

  async function syncAllImages() {
    toast.promise(
      apiPost<boolean>("Product/SyncAllProductImages/sync-all-images", null).then(
        (res) => {
          if (!res.status) throw new Error(res.message ?? "Sync failed");
          refetch();
          return res.message ?? "Sync started";
        },
      ),
      {
        loading: "Syncing all product images…",
        success: (msg) => msg,
        error: (err: Error) => err.message,
      },
    );
  }

  function downloadAll() {
    window.open(`${API_BASE_URL}Product/DownloadAllProducts`, "_blank");
  }

  function downloadFiltered() {
    const url = `${API_BASE_URL}Product/DownloadAllProducts?${queryParams.toString()}`;
    window.open(url, "_blank");
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Browse, search, and manage the product catalog.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search products by name, SKU, Dynamics ID…"
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
          <Select
            value={isFeatured}
            onValueChange={(v) => {
              setPage(1);
              setIsFeatured(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Featured" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All products</SelectItem>
              <SelectItem value="true">Featured only</SelectItem>
              <SelectItem value="false">Not featured</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadFiltered}>
            <Download className="h-4 w-4" /> Download (filtered)
          </Button>
          <Button variant="outline" onClick={downloadAll}>
            <Download className="h-4 w-4" /> Download all
          </Button>
          {canEdit && (
            <Button variant="secondary" onClick={syncAllImages}>
              <RefreshCw className="h-4 w-4" /> Sync all images
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price (NGN)</TableHead>
                <TableHead className="text-right">Price (USD)</TableHead>
                <TableHead>Dynamics ID</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No products match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="font-medium">{p.productName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.category ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>{p.brand?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.priceInNaira, "NGN")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.priceInDollar, "USD")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.dynamicsId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isVisible ? "default" : "secondary"}>
                        {p.isVisible ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(v) => toggleField(p.id, "IsActive", v)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.isFeaturedProduct}
                        disabled={!canEdit}
                        onCheckedChange={(v) =>
                          toggleField(p.id, "IsFeaturedProduct", v)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDetail(p.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => syncPrice(p.id)}
                            title="Sync price"
                          >
                            <RefreshCw className="h-4 w-4" />
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

      <ProductDetailModal
        productId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
      />
    </div>
  );
}
