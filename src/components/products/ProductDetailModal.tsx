import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, RefreshCw } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { apiGet, apiPost } from "@/lib/api";
import type { ProductReturnDto } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Props {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailModal({ productId, open, onOpenChange }: Props) {
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));
  const [imageIndex, setImageIndex] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const res = await apiGet<ProductReturnDto>(`Product/GetProduct/${productId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load product");
      return res.data;
    },
    enabled: !!productId && open,
  });

  useEffect(() => {
    setImageIndex(0);
  }, [productId]);

  const images = data?.productImageUrls ?? [];
  const activeImage = images[imageIndex];

  async function handleSyncImages() {
    if (!data?.dynamicsId) return;
    setSyncing(true);
    const res = await apiPost<boolean>(
      "Product/SyncSpecificProductImages/sync-specific-images",
      [data.dynamicsId],
    );
    setSyncing(false);
    if (res.status) {
      toast.success(res.message ?? "Product images synced");
      refetch();
    } else {
      toast.error(res.message ?? "Failed to sync images");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.productName ?? "Product details"}</DialogTitle>
          <DialogDescription>
            {data?.brand?.name ?? "—"} &middot; {data?.dynamicsId ?? "No Dynamics ID"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
              {activeImage ? (
                <img
                  src={activeImage.url}
                  alt={data.productName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageOff className="h-10 w-10" />
                  <span className="text-sm">No image</span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                    onClick={() =>
                      setImageIndex((i) => (i - 1 + images.length) % images.length)
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                    onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                    {imageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-semibold">{data.productName}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.shortDescription ?? "No description"}
                </p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (USD)" value={formatCurrency(data.priceInDollar, "USD")} />
                <Field label="Price (NGN)" value={formatCurrency(data.priceInNaira, "NGN")} />
                <Field label="Quantity" value={formatNumber(data.quantity)} />
                <Field label="Brand" value={data.brand?.name ?? "—"} />
                <Field label="Category" value={data.category ?? "—"} />
                <Field label="Dynamics ID" value={data.dynamicsId ?? "—"} />
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Badge variant={data.isActive ? "success" : "secondary"}>
                  {data.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={data.isVisible ? "default" : "secondary"}>
                  {data.isVisible ? "Visible" : "Hidden"}
                </Badge>
                {data.isFeaturedProduct && <Badge variant="warning">Featured</Badge>}
              </div>
            </div>
          </div>
        )}

        {data && data.warehouses.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Stock breakdown</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Dynamics ID</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.warehouses.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {w.dynamicsId ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(w.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {canEdit && (
            <Button
              variant="secondary"
              disabled={syncing || !data?.dynamicsId}
              onClick={handleSyncImages}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync images
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
