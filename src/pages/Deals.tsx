import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  DealEnum,
  DealRequest,
  DealResponse,
  EditDealRequest,
  LocationReturnDTO,
  MiniProductResponse,
  PaginationResponse,
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
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

const DEAL_TYPE_LABELS: Record<DealEnum, string> = {
  PercentageDiscount: "Percentage Discount",
  FixedDiscount: "Fixed Discount",
  BuyOneGetOneFree: "Buy X Get Y Free",
};

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

function discountDisplay(d: DealResponse): string {
  switch (d.dealType) {
    case "PercentageDiscount":
      return `${d.percentOff ?? 0}%`;
    case "FixedDiscount":
      return `$${(d.fixedAmount ?? 0).toFixed(2)}`;
    case "BuyOneGetOneFree":
      return `Buy ${d.buyQuantity ?? 0}, Get ${d.getQuantity ?? 0} free`;
  }
}

export default function DealsPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [locationId, setLocationId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DealResponse | null>(null);

  const { data: locations } = useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load locations");
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

  const queryKey = ["deals", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<DealResponse>>(
        `Deal/GetAll?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load deals");
      return res.data;
    },
  });

  async function toggleActive(deal: DealResponse, value: boolean) {
    const res = await apiPut<boolean>(`Deal/Update/${deal.id}`, {
      isActive: value,
    } satisfies EditDealRequest);
    if (!res.status) {
      toast.error(res.message ?? "Update failed");
    } else {
      toast.success(res.message ?? "Deal updated");
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function isExpired(d: DealResponse) {
    if (!d.validUntil) return false;
    return new Date(d.validUntil).getTime() <= Date.now();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">
            Percentage, fixed-amount, or buy-x-get-y deals on sets of products.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New deal
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search by name…"
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
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All locations</SelectItem>
              {(locations ?? []).map((w) => (
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
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead>Active</TableHead>
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
                    No deals match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => {
                  const expired = isExpired(d);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{d.name}</span>
                          {expired && <Badge variant="secondary">Expired</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {DEAL_TYPE_LABELS[d.dealType]}
                        </Badge>
                      </TableCell>
                      <TableCell>{discountDisplay(d)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.startDate ? formatDate(d.startDate) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.validUntil ? formatDate(d.validUntil) : "—"}
                      </TableCell>
                      <TableCell>{d.location?.locationName ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {d.products?.length ?? 0}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={d.isActive && !expired}
                          disabled={!canEdit || expired}
                          onCheckedChange={(v) => toggleActive(d, v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDetailId(d.id)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditId(d.id)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteTarget(d)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
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

      <CreateDealModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        locations={locations ?? []}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["deals"] })}
      />

      <EditDealModal
        dealId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        locations={locations ?? []}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["deals"] })}
      />

      <DetailDealModal
        dealId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "deal"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(`Deal/Delete/${deleteTarget.id}`);
          if (!res.status) {
            toast.error(res.message ?? "Delete failed");
            throw new Error("delete-failed");
          }
          toast.success(res.message ?? "Deal deleted");
          queryClient.invalidateQueries({ queryKey: ["deals"] });
        }}
      />
    </div>
  );
}

// --- Deal form state ---
interface DealFormState {
  name: string;
  dealType: DealEnum;
  percentOff: string;
  fixedAmount: string;
  buyQuantity: string;
  getQuantity: string;
  locationId: string;
  startDate: string;
  validUntil: string;
  productIds: string[];
}

function emptyForm(): DealFormState {
  const now = new Date();
  const week = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: "",
    dealType: "PercentageDiscount",
    percentOff: "",
    fixedAmount: "",
    buyQuantity: "1",
    getQuantity: "1",
    locationId: "",
    startDate: toLocalDatetimeInput(now.toISOString()),
    validUntil: toLocalDatetimeInput(week.toISOString()),
    productIds: [],
  };
}

function buildDealPayload(s: DealFormState): Omit<DealRequest, "productIds"> & {
  productIds: string[];
} {
  const payload: DealRequest = {
    name: s.name.trim(),
    dealType: s.dealType,
    locationId: s.locationId,
    startDate: fromLocalDatetimeInput(s.startDate),
    validUntil: fromLocalDatetimeInput(s.validUntil),
    productIds: s.productIds,
  };
  if (s.dealType === "PercentageDiscount") {
    payload.percentOff = s.percentOff === "" ? null : Number(s.percentOff);
  } else if (s.dealType === "FixedDiscount") {
    payload.fixedAmount = s.fixedAmount === "" ? null : Number(s.fixedAmount);
  } else {
    payload.buyQuantity = s.buyQuantity === "" ? null : Number(s.buyQuantity);
    payload.getQuantity = s.getQuantity === "" ? null : Number(s.getQuantity);
  }
  return payload;
}

// --- Create modal ---
function CreateDealModal({
  open,
  onOpenChange,
  locations,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationReturnDTO[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState<DealFormState>(emptyForm);

  useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      if (!form.locationId) throw new Error("Location is required");
      if (form.productIds.length === 0) throw new Error("Select at least one product");
      const res = await apiPost<boolean>("Deal/Create", buildDealPayload(form));
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Deal created";
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
          <DialogTitle>New deal</DialogTitle>
          <DialogDescription>
            Configure a discount and pick the products it applies to.
          </DialogDescription>
        </DialogHeader>
        <DealFormFields form={form} setForm={setForm} locations={locations} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit modal ---
function EditDealModal({
  dealId,
  open,
  onOpenChange,
  locations,
  onUpdated,
}: {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationReturnDTO[];
  onUpdated: () => void;
}) {
  const [form, setForm] = useState<DealFormState>(emptyForm);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const res = await apiGet<DealResponse>(`Deal/Get/${dealId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load deal");
      return res.data;
    },
    enabled: !!dealId && open,
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        dealType: data.dealType,
        percentOff: data.percentOff != null ? String(data.percentOff) : "",
        fixedAmount: data.fixedAmount != null ? String(data.fixedAmount) : "",
        buyQuantity: data.buyQuantity != null ? String(data.buyQuantity) : "1",
        getQuantity: data.getQuantity != null ? String(data.getQuantity) : "1",
        locationId: data.locationId,
        startDate: toLocalDatetimeInput(data.startDate),
        validUntil: toLocalDatetimeInput(data.validUntil),
        productIds: data.products.map((p) => p.id),
      });
      setInitialSelection(
        data.products.map((p) => ({
          id: p.id,
          productName: p.name ?? "Unnamed",
        })),
      );
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!dealId) throw new Error("No deal");
      if (form.productIds.length === 0)
        throw new Error("Select at least one product");
      const payload: EditDealRequest = buildDealPayload(form);
      const res = await apiPut<boolean>(`Deal/Update/${dealId}`, payload);
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res.message ?? "Deal updated";
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
          <DialogTitle>Edit deal</DialogTitle>
          <DialogDescription>{data?.name ?? "Loading…"}</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <DealFormFields
            form={form}
            setForm={setForm}
            locations={locations}
            initialSelection={initialSelection}
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
function DetailDealModal({
  dealId,
  open,
  onOpenChange,
}: {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const res = await apiGet<DealResponse>(`Deal/Get/${dealId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load deal");
      return res.data;
    },
    enabled: !!dealId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Deal"}</DialogTitle>
          <DialogDescription>
            {data ? `${DEAL_TYPE_LABELS[data.dealType]} · ${discountDisplay(data)}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Location</div>
                <div>{data.location?.locationName ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Status</div>
                <div>{data.isActive ? "Active" : "Inactive"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Starts</div>
                <div>{data.startDate ? formatDate(data.startDate) : "—"}</div>
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
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.products ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {p.price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
interface DealFormFieldsProps {
  form: DealFormState;
  setForm: React.Dispatch<React.SetStateAction<DealFormState>>;
  locations: LocationReturnDTO[];
  initialSelection?: MiniProductResponse[];
}

function DealFormFields({
  form,
  setForm,
  locations,
  initialSelection,
}: DealFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Weekend BOGO"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Deal type</Label>
        <Select
          value={form.dealType}
          onValueChange={(v) =>
            setForm((p) => ({
              ...p,
              dealType: v as DealEnum,
              // reset mutually-exclusive fields
              percentOff: "",
              fixedAmount: "",
              buyQuantity: "1",
              getQuantity: "1",
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PercentageDiscount">
              {DEAL_TYPE_LABELS.PercentageDiscount}
            </SelectItem>
            <SelectItem value="FixedDiscount">
              {DEAL_TYPE_LABELS.FixedDiscount}
            </SelectItem>
            <SelectItem value="BuyOneGetOneFree">
              {DEAL_TYPE_LABELS.BuyOneGetOneFree}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.dealType === "PercentageDiscount" && (
        <div className="space-y-1.5">
          <Label>Percentage off</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.percentOff}
            onChange={(e) =>
              setForm((p) => ({ ...p, percentOff: e.target.value }))
            }
            placeholder="25"
          />
        </div>
      )}
      {form.dealType === "FixedDiscount" && (
        <div className="space-y-1.5">
          <Label>Fixed amount off</Label>
          <Input
            type="number"
            min={0}
            value={form.fixedAmount}
            onChange={(e) =>
              setForm((p) => ({ ...p, fixedAmount: e.target.value }))
            }
            placeholder="50.00"
          />
        </div>
      )}
      {form.dealType === "BuyOneGetOneFree" && (
        <div className="rounded-md bg-primary/5 p-3 text-xs text-muted-foreground">
          Customer must buy <strong>{form.buyQuantity || 1}</strong> to get{" "}
          <strong>{form.getQuantity || 1}</strong> free.
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Buy quantity</Label>
              <Input
                type="number"
                min={1}
                value={form.buyQuantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, buyQuantity: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Get free</Label>
              <Input
                type="number"
                min={1}
                value={form.getQuantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, getQuantity: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Location</Label>
        <Select
          value={form.locationId || ALL}
          onValueChange={(v) =>
            setForm((p) => ({ ...p, locationId: v === ALL ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Select location</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
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
            value={form.startDate}
            onChange={(e) =>
              setForm((p) => ({ ...p, startDate: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Valid until</Label>
          <Input
            type="datetime-local"
            value={form.validUntil}
            onChange={(e) =>
              setForm((p) => ({ ...p, validUntil: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Products</Label>
        <ProductSearchMultiSelect
          value={form.productIds}
          onChange={(v) => setForm((p) => ({ ...p, productIds: v }))}
          initialSelection={initialSelection}
          extraParams={{ locationId: form.locationId || undefined }}
        />
      </div>
    </div>
  );
}
