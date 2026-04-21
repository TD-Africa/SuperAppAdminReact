import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import { apiGet, API_BASE_URL } from "@/lib/api";
import type {
  OrderReturnDto,
  OrderStatusReturnDTO,
  PaginationResponse,
} from "@/lib/types";
import { PaymentMethodId } from "@/lib/paymentMethods";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

const ALL = "__all__";

export default function OrdersPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [orderStatusId, setOrderStatusId] = useState<string>(ALL);
  const [isPaid, setIsPaid] = useState<string>(ALL);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(ALL);
  const [isPoa, setIsPoa] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: statuses } = useQuery({
    queryKey: ["order-statuses"],
    queryFn: async () => {
      const res = await apiGet<OrderStatusReturnDTO[]>("Component/GetOrderStatuses");
      if (!res.status) throw new Error(res.message ?? "Failed to load statuses");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (orderStatusId !== ALL) params.set("orderStatusId", orderStatusId);
    if (isPaid !== ALL) params.set("isPaid", isPaid);
    if (paymentMethodId !== ALL) params.set("paymentMethodId", paymentMethodId);
    if (isPoa !== ALL) params.set("isPoa", isPoa);
    return params;
  }, [pageSize, page, debouncedKeyword, orderStatusId, isPaid, paymentMethodId, isPoa]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["orders", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<OrderReturnDto>>(
        `Order/GetAllOrders?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load orders");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function openDetail(id: string) {
    setSelectedOrderId(id);
    setDetailOpen(true);
  }

  function downloadAll() {
    window.open(`${API_BASE_URL}Order/DownloadOrders`, "_blank");
  }

  function downloadFiltered() {
    const url = `${API_BASE_URL}Order/DownloadOrders?${queryParams.toString()}`;
    window.open(url, "_blank");
  }

  function totalForOrder(order: OrderReturnDto, currency: "NGN" | "USD") {
    const picker =
      currency === "NGN"
        ? (op: OrderReturnDto["orderedProducts"][number]) => op.amountInNaira
        : (op: OrderReturnDto["orderedProducts"][number]) => op.amountInDollar;
    return (order.orderedProducts ?? []).reduce(
      (acc, op) => acc + picker(op) * op.quantity,
      0,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, and inspect customer orders.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-12"
            placeholder="Search by company, phone, Dynamics ID…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            value={orderStatusId}
            onValueChange={(v) => {
              setPage(1);
              setOrderStatusId(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {(statuses ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={isPaid}
            onValueChange={(v) => {
              setPage(1);
              setIsPaid(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All payment statuses</SelectItem>
              <SelectItem value="true">Paid</SelectItem>
              <SelectItem value="false">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={paymentMethodId}
            onValueChange={(v) => {
              setPage(1);
              setPaymentMethodId(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All methods</SelectItem>
              <SelectItem value={PaymentMethodId.Credit}>Credit</SelectItem>
              <SelectItem value={PaymentMethodId.CashOrCard}>Cash/Card</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={isPoa}
            onValueChange={(v) => {
              setPage(1);
              setIsPoa(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="POA transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All transactions</SelectItem>
              <SelectItem value="true">POA only</SelectItem>
              <SelectItem value="false">Non-POA</SelectItem>
            </SelectContent>
          </Select>
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
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">NGN</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>POA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No orders match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.companyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{o.phoneNumber ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalForOrder(o, "NGN"), "NGN")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalForOrder(o, "USD"), "USD")}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {o.deliveryAddress ?? o.location?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(o.dateCreated)}
                    </TableCell>
                    <TableCell>{o.paymentMethod?.method ?? "—"}</TableCell>
                    <TableCell>
                      {o.isPoaTransaction ? (
                        <Badge variant="warning">POA</Badge>
                      ) : (
                        <Badge variant="secondary">—</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.orderStatus?.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(o.orderedProducts?.length ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDetail(o.id)}
                      >
                        <Eye className="h-4 w-4" />
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

      <OrderDetailModal
        orderId={selectedOrderId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedOrderId(null);
        }}
        onUpdated={() => refetch()}
      />
    </div>
  );
}
