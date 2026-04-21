import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  BaseProductReturnDto,
  MiniProductResponse,
  PaginationResponse,
  ProductGroupResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/DataTablePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProductSearchMultiSelect } from "@/components/ProductSearchMultiSelect";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

export default function ProductGroupsPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProductGroup));
  const canCreate = useAuthStore((s) =>
    s.hasPermission(Permission.CanCreateProductGroup),
  );
  const canDelete = useAuthStore((s) =>
    s.hasPermission(Permission.CanDeleteProductGroup),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductGroupResponse | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const queryKey = ["product-groups", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<ProductGroupResponse>>(
        `Product/GetProductGroups?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load product groups");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  async function invalidateAll() {
    await queryClient.invalidateQueries({ queryKey: ["product-groups"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Product Groups</h1>
          <p className="text-sm text-muted-foreground">
            Bundle products together for easier merchandising.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New group
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by group name…"
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
                <TableHead>ID</TableHead>
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
                    No product groups yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDetailId(g.id)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditId(g.id)}
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
                            onClick={() => setDeleteTarget(g)}
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

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidateAll}
      />

      <EditGroupModal
        groupId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        onUpdated={invalidateAll}
      />

      <DetailGroupModal
        groupId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onOpenProduct={(id) => setProductDetailId(id)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "group"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(
            `Product/DeleteProductGroup/${deleteTarget.id}`,
          );
          if (!res.status) {
            toast.error(res.message ?? "Delete failed");
            throw new Error("delete-failed");
          }
          toast.success(res.message ?? "Group deleted");
          await invalidateAll();
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
function CreateGroupModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName("");
      setProductIds([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      if (productIds.length === 0) throw new Error("Select at least one product");
      const res = await apiPost<boolean>("Product/CreateProductGroup", {
        name: trimmed,
        productIds,
      });
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Group created";
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
          <DialogTitle>New product group</DialogTitle>
          <DialogDescription>Give the group a title and pick its products.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer essentials"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Products</Label>
            <ProductSearchMultiSelect value={productIds} onChange={setProductIds} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit modal ---
function EditGroupModal({
  groupId,
  open,
  onOpenChange,
  onUpdated,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["product-group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await apiGet<ProductGroupResponse>(
        `Product/GetProductGroup/${groupId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load");
      return res.data;
    },
    enabled: !!groupId && open,
  });

  useEffect(() => {
    if (data) {
      setName(data.name);
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
      if (!groupId) throw new Error("No group");
      if (productIds.length === 0) throw new Error("Select at least one product");
      const res = await apiPatch<boolean>(`Product/EditProductGroup/${groupId}`, {
        name: name.trim(),
        productIds,
      });
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res.message ?? "Group updated";
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
          <DialogTitle>{data?.name ?? "Edit group"}</DialogTitle>
          <DialogDescription>Rename the group or swap its products.</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Products</Label>
              <ProductSearchMultiSelect
                value={productIds}
                onChange={setProductIds}
                initialSelection={initialSelection}
              />
            </div>
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

// --- Detail modal ---
function DetailGroupModal({
  groupId,
  open,
  onOpenChange,
  onOpenProduct,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (productId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await apiGet<ProductGroupResponse>(
        `Product/GetProductGroup/${groupId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load");
      return res.data;
    },
    enabled: !!groupId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Group"}</DialogTitle>
          <DialogDescription>
            {data ? `${data.products?.length ?? 0} products` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Dynamics ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                      Empty group.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.products.map((p: BaseProductReturnDto) => (
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
                  ))
                )}
              </TableBody>
            </Table>
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
