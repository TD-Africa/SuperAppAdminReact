import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPatch } from "@/lib/api";
import type { OrderProductReturnDto, OrderReturnDto } from "@/lib/types";
import { PaymentMethodId } from "@/lib/paymentMethods";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

interface InvoiceRow {
  salesId: string;
  invoiceId: string;
  invoiceCreationDate: string | null;
  amountDueInNaira: number;
  amountPaid: number;
  isFullySettled: boolean;
  isFullyPosted: boolean;
}

export function OrderDetailModal({ orderId, open, onOpenChange, onUpdated }: Props) {
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditOrders));
  const [isPDCCollected, setIsPDCCollected] = useState(false);
  const [isFullyPaid, setIsFullyPaid] = useState(false);
  const [invoiceEdits, setInvoiceEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productOpen, setProductOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await apiGet<OrderReturnDto>(`Order/GetOrder/${orderId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load order");
      return res.data;
    },
    enabled: !!orderId && open,
  });

  useEffect(() => {
    if (data) {
      setIsPDCCollected(data.isPDCCollected);
      setIsFullyPaid(data.isFullyPaid);
      setInvoiceEdits({});
    }
  }, [data]);

  const isCredit = data?.paymentMethod?.id === PaymentMethodId.Credit;
  const showInvoiceTable = !!data && isCredit && !data.isFullyPaid && data.isInvoiced;

  const invoiceRows = useMemo<InvoiceRow[]>(() => {
    if (!data?.orderedProducts) return [];
    // One row per unique salesId (the Blazor version groups by SalesId).
    const seen = new Map<string, InvoiceRow>();
    for (const op of data.orderedProducts) {
      if (!op.salesId || seen.has(op.salesId)) continue;
      seen.set(op.salesId, {
        salesId: op.salesId,
        invoiceId: op.invoiceID ?? "—",
        invoiceCreationDate: op.invoiceCreationDate,
        amountDueInNaira: op.amountInNaira * op.quantity,
        amountPaid: op.amountPaid,
        isFullySettled: op.isFullySettled,
        isFullyPosted: op.isFullyPosted,
      });
    }
    return Array.from(seen.values());
  }, [data]);

  const totalNaira = useMemo(
    () =>
      data?.orderedProducts?.reduce(
        (acc, op) => acc + op.amountInNaira * op.quantity,
        0,
      ) ?? 0,
    [data],
  );
  const totalDollar = useMemo(
    () =>
      data?.orderedProducts?.reduce(
        (acc, op) => acc + op.amountInDollar * op.quantity,
        0,
      ) ?? 0,
    [data],
  );

  function openProduct(id: string) {
    setSelectedProductId(id);
    setProductOpen(true);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const payload = {
      isPDCCollected,
      isFullyPaid,
      invoicePayments: Object.entries(invoiceEdits)
        .filter(([, v]) => !Number.isNaN(v))
        .map(([salesId, amountPaid]) => ({ salesId, amountPaid })),
    };
    const res = await apiPatch<boolean>(`order/updateOrder/${data.id}`, payload);
    setSaving(false);
    if (res.status) {
      toast.success(res.message ?? "Order updated");
      onUpdated?.();
      refetch();
    } else {
      toast.error(res.message ?? "Update failed");
    }
  }

  const hasDirtyEdits =
    !!data &&
    (isPDCCollected !== data.isPDCCollected ||
      isFullyPaid !== data.isFullyPaid ||
      Object.keys(invoiceEdits).length > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              {data ? `#${data.id.slice(0, 8)}` : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Company" value={data.companyName ?? "—"} />
                <Field label="Recipient" value={data.name ?? "—"} />
                <Field label="Phone" value={data.phoneNumber ?? "—"} />
                <Field label="Warehouse" value={data.location?.name ?? "—"} />
                <Field label="Total (NGN)" value={formatCurrency(totalNaira, "NGN")} />
                <Field label="Total (USD)" value={formatCurrency(totalDollar, "USD")} />
                <Field label="Payment" value={data.paymentMethod?.method ?? "—"} />
                <Field label="Delivery" value={data.deliveryMethod?.method ?? "—"} />
                <Field
                  label="Date ordered"
                  value={formatDate(data.dateCreated)}
                />
                <Field
                  label="Due date"
                  value={data.dueDate ? formatDate(data.dueDate) : "N/A"}
                />
                <Field
                  label="Delivery address"
                  value={data.deliveryAddress ?? data.location?.name ?? "—"}
                />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Status
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {data.orderStatus?.status ?? "—"}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-8">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={isPDCCollected}
                    disabled={!canEdit}
                    onCheckedChange={(v) => setIsPDCCollected(!!v)}
                  />
                  <span className="text-sm">Post-dated check collected</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={isFullyPaid}
                    disabled={!canEdit}
                    onCheckedChange={(v) => setIsFullyPaid(!!v)}
                  />
                  <span className="text-sm">Fully paid</span>
                </label>
                {data.isPoaTransaction && (
                  <Badge variant="warning">POA transaction</Badge>
                )}
              </div>

              {showInvoiceTable && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Credit invoices</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice ID</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Due (NGN)</TableHead>
                          <TableHead className="text-right">Amount paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceRows.map((row) => {
                          const locked = row.isFullyPosted && row.isFullySettled;
                          const currentVal =
                            invoiceEdits[row.salesId] ?? row.amountPaid;
                          return (
                            <TableRow key={row.salesId}>
                              <TableCell className="font-medium">
                                {row.invoiceId}
                              </TableCell>
                              <TableCell>
                                {formatDate(row.invoiceCreationDate)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(row.amountDueInNaira, "NGN")}
                              </TableCell>
                              <TableCell className="w-48">
                                <Input
                                  type="number"
                                  disabled={!canEdit || locked}
                                  value={currentVal}
                                  onChange={(e) =>
                                    setInvoiceEdits((prev) => ({
                                      ...prev,
                                      [row.salesId]: Number(e.target.value),
                                    }))
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Products ({data.orderedProducts?.length ?? 0})
                </h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Dynamics ID</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Sales ID</TableHead>
                        <TableHead>Voucher ID</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                        <TableHead className="text-right">NGN</TableHead>
                        <TableHead className="text-right">Paid (NGN)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.orderedProducts ?? []).map(
                        (op: OrderProductReturnDto, idx) => (
                          <TableRow
                            key={`${op.product.id}-${idx}`}
                            className="cursor-pointer"
                            onClick={() => openProduct(op.product.id)}
                          >
                            <TableCell className="font-medium">
                              {op.product.productName}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {op.product.dynamicsId ?? "—"}
                            </TableCell>
                            <TableCell>{op.warehouse?.name ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {formatNumber(op.quantity)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {op.salesId ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {op.voucherId ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(op.amountInDollar, "USD")}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(op.amountInNaira, "NGN")}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(op.amountPaid, "NGN")}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEdit && isCredit && (
              <Button
                onClick={handleSave}
                disabled={saving || !hasDirtyEdits}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Update order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailModal
        productId={selectedProductId}
        open={productOpen}
        onOpenChange={(v) => {
          setProductOpen(v);
          if (!v) setSelectedProductId(null);
        }}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
