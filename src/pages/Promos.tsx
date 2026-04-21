import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Eye,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  toFormData,
} from "@/lib/api";
import type {
  BaseProductReturnDto,
  LocationReturnDTO,
  MiniProductResponse,
  PaginationResponse,
  PromoResponse,
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
import { ProductSearchMultiSelect } from "@/components/ProductSearchMultiSelect";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

function toLocalDatetimeInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function PromosPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditPromos));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreatePromos));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanDeletePromos));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [locationId, setLocationId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromoResponse | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load warehouses");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    if (locationId !== ALL) params.set("locationId", locationId);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive, locationId]);

  const queryKey = ["promos", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<PromoResponse>>(
        `Promo/GetPromos?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load promos");
      return res.data;
    },
  });

  async function toggleActive(promo: PromoResponse, value: boolean) {
    const fd = toFormData({ isActive: value });
    const res = await apiPatch<boolean>(`Promo/EditPromo/${promo.id}`, fd);
    if (!res.status) {
      toast.error(res.message ?? "Update failed");
    } else {
      toast.success(res.message ?? "Promo updated");
      queryClient.invalidateQueries({ queryKey: ["promos"] });
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function isExpired(p: PromoResponse) {
    if (!p.validUntil) return false;
    return new Date(p.validUntil).getTime() <= Date.now();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promos</h1>
          <p className="text-sm text-muted-foreground">
            Promotional campaigns with percentage discounts on bundles of products.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New promo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search by title…"
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
            value={locationId}
            onValueChange={(v) => {
              setPage(1);
              setLocationId(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All warehouses</SelectItem>
              {(warehouses ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
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
                <TableHead>Title</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No promos match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => {
                  const expired = isExpired(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{p.name}</span>
                          {expired && <Badge variant="secondary">Expired</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.startDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.validUntil ? formatDate(p.validUntil) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{p.percentOff}%</TableCell>
                      <TableCell>{p.location?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={p.isActive && !expired}
                          disabled={!canEdit || expired}
                          onCheckedChange={(v) => toggleActive(p, v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDetailId(p.id)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditId(p.id)}
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
                              onClick={() => setDeleteTarget(p)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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

      <CreatePromoModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        warehouses={warehouses ?? []}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["promos"] })
        }
      />

      <EditPromoModal
        promoId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        warehouses={warehouses ?? []}
        onUpdated={() =>
          queryClient.invalidateQueries({ queryKey: ["promos"] })
        }
      />

      <DetailPromoModal
        promoId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onOpenProduct={(id) => setProductDetailId(id)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "promo"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(
            `Promo/DeletePromo/${deleteTarget.id}`,
          );
          if (!res.status) {
            toast.error(res.message ?? "Delete failed");
            throw new Error("delete-failed");
          }
          toast.success(res.message ?? "Promo deleted");
          queryClient.invalidateQueries({ queryKey: ["promos"] });
        }}
      />

      <ProductDetailModal
        productId={productDetailId}
        open={!!productDetailId}
        onOpenChange={(v) => !v && setProductDetailId(null)}
      />
    </div>
  );
}

// --- Create modal ---
function CreatePromoModal({
  open,
  onOpenChange,
  warehouses,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: LocationReturnDTO[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName("");
      setPercentOff("");
      setWarehouseId("");
      const now = new Date();
      const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setStartDate(toLocalDatetimeInput(now.toISOString()));
      setEndDate(toLocalDatetimeInput(weekLater.toISOString()));
      setFile(null);
      setProductIds([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Title is required");
      const pct = Number(percentOff);
      if (!Number.isFinite(pct) || pct <= 0) throw new Error("Percent off must be > 0");
      if (!warehouseId) throw new Error("Warehouse is required");
      if (!startDate || !endDate) throw new Error("Start and end dates are required");
      if (productIds.length === 0) throw new Error("Select at least one product");

      const fd = toFormData(
        {
          name: name.trim(),
          percentOff: pct,
          startDate: fromLocalDatetimeInput(startDate),
          endDate: fromLocalDatetimeInput(endDate),
          locationId: warehouseId,
          productIds,
        },
        file ?? undefined,
      );
      const res = await apiPost<boolean>("Promo/CreatePromo", fd);
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Promo created";
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New promo</DialogTitle>
          <DialogDescription>Configure a promotional campaign.</DialogDescription>
        </DialogHeader>
        <PromoFormFields
          name={name}
          setName={setName}
          percentOff={percentOff}
          setPercentOff={setPercentOff}
          warehouseId={warehouseId}
          setWarehouseId={setWarehouseId}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          file={file}
          setFile={setFile}
          productIds={productIds}
          setProductIds={setProductIds}
          warehouses={warehouses}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create promo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit modal ---
function EditPromoModal({
  promoId,
  open,
  onOpenChange,
  warehouses,
  onUpdated,
}: {
  promoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: LocationReturnDTO[];
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["promo", promoId],
    queryFn: async () => {
      if (!promoId) return null;
      const res = await apiGet<PromoResponse>(`Promo/GetPromo/${promoId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load promo");
      return res.data;
    },
    enabled: !!promoId && open,
  });

  useEffect(() => {
    if (data) {
      setName(data.name);
      setPercentOff(String(data.percentOff));
      setWarehouseId(data.location?.id ?? "");
      setStartDate(toLocalDatetimeInput(data.startDate));
      setEndDate(toLocalDatetimeInput(data.validUntil));
      setFile(null);
      setProductIds(data.products.map((p) => p.id));
      setInitialSelection(
        data.products.map((p) => ({
          id: p.id,
          productName: p.productName,
          dynamicsId: p.dynamicsId ?? undefined,
        })),
      );
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!promoId) throw new Error("No promo");
      const pct = Number(percentOff);
      if (!Number.isFinite(pct)) throw new Error("Percent off must be a number");
      if (productIds.length === 0) throw new Error("Select at least one product");

      const fd = toFormData(
        {
          name: name.trim(),
          percentOff: pct,
          startDate: fromLocalDatetimeInput(startDate),
          endDate: fromLocalDatetimeInput(endDate),
          locationId: warehouseId,
          productIds,
        },
        file ?? undefined,
      );
      const res = await apiPatch<boolean>(`Promo/EditPromo/${promoId}`, fd);
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res.message ?? "Promo updated";
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit promo</DialogTitle>
          <DialogDescription>{data?.name ?? "Loading…"}</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <PromoFormFields
            name={name}
            setName={setName}
            percentOff={percentOff}
            setPercentOff={setPercentOff}
            warehouseId={warehouseId}
            setWarehouseId={setWarehouseId}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            file={file}
            setFile={setFile}
            productIds={productIds}
            setProductIds={setProductIds}
            initialSelection={initialSelection}
            currentImageUrl={data.imageUrl}
            warehouses={warehouses}
          />
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

// --- Detail modal ---
function DetailPromoModal({
  promoId,
  open,
  onOpenChange,
  onOpenProduct,
}: {
  promoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (productId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["promo", promoId],
    queryFn: async () => {
      if (!promoId) return null;
      const res = await apiGet<PromoResponse>(`Promo/GetPromo/${promoId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load promo");
      return res.data;
    },
    enabled: !!promoId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Promo"}</DialogTitle>
          <DialogDescription>
            {data ? `${data.percentOff}% off${data.location?.name ? " · " + data.location.name : ""}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            {data.imageUrl ? (
              <div className="overflow-hidden rounded-md border bg-muted">
                <img
                  src={data.imageUrl}
                  alt={data.name}
                  className="mx-auto max-h-64 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center gap-2 rounded-md border bg-muted text-muted-foreground">
                <ImageOff className="h-5 w-5" />
                No image
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Starts</div>
                <div>{formatDate(data.startDate)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Ends</div>
                <div>{data.validUntil ? formatDate(data.validUntil) : "—"}</div>
              </div>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Dynamics ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.products ?? []).map((p: BaseProductReturnDto) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => onOpenProduct(p.id)}
                    >
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.dynamicsId ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Shared form fields ---
interface PromoFormFieldsProps {
  name: string;
  setName: (v: string) => void;
  percentOff: string;
  setPercentOff: (v: string) => void;
  warehouseId: string;
  setWarehouseId: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  file: File | null;
  setFile: (v: File | null) => void;
  productIds: string[];
  setProductIds: (v: string[]) => void;
  initialSelection?: MiniProductResponse[];
  currentImageUrl?: string | null;
  warehouses: LocationReturnDTO[];
}

function PromoFormFields({
  name,
  setName,
  percentOff,
  setPercentOff,
  warehouseId,
  setWarehouseId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  file,
  setFile,
  productIds,
  setProductIds,
  initialSelection,
  currentImageUrl,
  warehouses,
}: PromoFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer sale" />
      </div>
      <div className="space-y-1.5">
        <Label>Percentage off</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={percentOff}
          onChange={(e) => setPercentOff(e.target.value)}
          placeholder="25"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Warehouse</Label>
        <Select value={warehouseId || ALL} onValueChange={(v) => setWarehouseId(v === ALL ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Select warehouse</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Image</Label>
        {currentImageUrl && !file && (
          <div className="mb-2 overflow-hidden rounded-md border bg-muted">
            <img
              src={currentImageUrl}
              alt="Current"
              className="mx-auto max-h-40 w-auto object-contain"
            />
            <div className="border-t px-3 py-1 text-center text-xs text-muted-foreground">
              Current image — choose a new file to replace
            </div>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-accent">
          <Upload className="h-4 w-4" />
          <span>{file ? file.name : "Choose an image (optional)"}</span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <div className="space-y-1.5">
        <Label>Products</Label>
        <ProductSearchMultiSelect
          value={productIds}
          onChange={setProductIds}
          initialSelection={initialSelection}
          extraParams={{
            hasPromo: "false",
            locationId: warehouseId || undefined,
          }}
        />
      </div>
    </div>
  );
}
