import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import { RollbackOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import type {
  CancelledOrderPaymentResponse,
  OrderStockHoldLineResponse,
  OrderStockHoldOrderResponse,
  OrderStockHoldProductResponse,
  OrderStockHoldSummaryResponse,
  PaginationResponse,
  ReleaseOrderStockRequest,
  ReleaseOrderStockResponse,
} from "@/lib/types";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Age,
  CustomerCell,
  ReleaseDialog,
  StatTile,
  useLocations,
  VariantCell,
} from "./shared";

const ALL = "__all__";

type View = "products" | "orders" | "refunds";

interface PendingRelease {
  request: ReleaseOrderStockRequest;
  title: string;
  description: React.ReactNode;
}

type RequestRelease = (r: PendingRelease) => void;

function plural(n: number, word: string) {
  return `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
}

const RELEASE_RULES =
  "The whole order is cancelled and every line goes back in stock. Only unpaid, unposted, non-credit pending orders qualify; any others are skipped.";

/** Time until the hourly sweep cancels the order by itself. */
function AutoRelease({ at }: { at: string }) {
  const hours = Math.round((new Date(at).getTime() - Date.now()) / 3_600_000);
  return (
    <Tooltip title={formatDateTime(at)}>
      {hours <= 0 ? (
        <Tag color="warning" className="!m-0">Due now</Tag>
      ) : (
        <span className="whitespace-nowrap">in {hours}h</span>
      )}
    </Tooltip>
  );
}

export function OrderHoldsTab({ canEdit }: { canEdit: boolean }) {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("products");
  const [pending, setPending] = useState<PendingRelease | null>(null);
  const [result, setResult] = useState<ReleaseOrderStockResponse | null>(null);
  const [ordersFor, setOrdersFor] = useState<OrderStockHoldProductResponse | null>(null);

  const summary = useQuery({
    queryKey: ["order-holds", "summary"],
    queryFn: async () => {
      const res = await apiGet<OrderStockHoldSummaryResponse>("carts/order-holds/summary");
      if (!res.status) throw new Error(res.message ?? "Failed to load order holds");
      return res.data;
    },
  });

  async function confirmRelease(reason: string, notifyCustomer: boolean) {
    if (!pending) return;
    const res = await apiPost<ReleaseOrderStockResponse>("carts/order-holds/release", {
      ...pending.request,
      reason,
      notifyCustomer,
    });
    // Nothing released comes back as a 409 that still carries the skip reasons.
    if (!res.data) {
      message.error(res.message ?? "Release failed");
      return;
    }
    if (res.status) message.success(res.message ?? "Released");
    else message.warning(res.message ?? "No orders were released");
    setPending(null);
    setResult(res.data);
    await queryClient.invalidateQueries({ queryKey: ["order-holds"] });
    // Releasing stock changes what the cart tab shows as on hand.
    await queryClient.invalidateQueries({ queryKey: ["cart-admin"] });
  }

  const s = summary.data;

  return (
    <div className="space-y-4">
      {summary.error && (
        <Alert type="error" showIcon message={(summary.error as Error).message} />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Pending orders holding stock" value={s ? formatNumber(s.orders) : "…"} />
        <StatTile label="Units held" value={s ? formatNumber(s.units) : "…"} />
        <StatTile
          label="Products (variant × warehouse)"
          value={s ? formatNumber(s.variants) : "…"}
        />
        <StatTile
          label="Oldest pending order"
          value={<Age at={s?.oldestOrderPlacedAt} />}
          hint={
            s
              ? `Unpaid orders are cancelled automatically ${s.autoReleaseAfterHours}h after they're placed.`
              : undefined
          }
        />
        <StatTile
          label="Cancelled, money recorded"
          value={s ? formatNumber(s.cancelledOrdersWithPayments) : "…"}
          tone={s?.cancelledOrdersWithPayments ? "warning" : undefined}
          hint="Cancelled instant-payment orders that still show customer payments. Click to review refunds."
          onClick={() => setView("refunds")}
        />
      </div>

      <Alert
        type="info"
        showIcon
        message={`Pending orders reserve stock until they're paid or the sweep cancels them${
          s ? ` after ${s.autoReleaseAfterHours}h` : ""
        }. "Available" below is already net of these holds.`}
      />

      <Segmented
        value={view}
        onChange={(v) => setView(v as View)}
        options={[
          { value: "products", label: "By product" },
          { value: "orders", label: "By order" },
          { value: "refunds", label: "Refund follow-up" },
        ]}
      />

      {view === "products" && (
        <ProductsView canEdit={canEdit} onShowOrders={setOrdersFor} requestRelease={setPending} />
      )}
      {view === "orders" && <OrdersView canEdit={canEdit} requestRelease={setPending} />}
      {view === "refunds" && <RefundsView />}

      <ProductOrdersDrawer
        product={ordersFor}
        canEdit={canEdit}
        onClose={() => setOrdersFor(null)}
        requestRelease={setPending}
      />

      <ReleaseDialog
        open={!!pending}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel="Cancel orders"
        notifyOption
        onCancel={() => setPending(null)}
        onConfirm={({ reason, notifyCustomer }) => confirmRelease(reason, notifyCustomer)}
      />

      <ReleaseResultModal result={result} onClose={() => setResult(null)} />
    </div>
  );
}

function ProductsView({
  canEdit,
  onShowOrders,
  requestRelease,
}: {
  canEdit: boolean;
  onShowOrders: (p: OrderStockHoldProductResponse) => void;
  requestRelease: RequestRelease;
}) {
  const { data: locations } = useLocations();
  const [keyword, setKeyword] = useState("");
  const search = useDebouncedValue(keyword, 350);
  const [locationId, setLocationId] = useState(ALL);
  const [olderThanHours, setOlderThanHours] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("pageNumber", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("Search", search.trim());
    if (locationId !== ALL) p.set("LocationId", locationId);
    if (olderThanHours) p.set("OlderThanHours", String(olderThanHours));
    return p.toString();
  }, [page, pageSize, search, locationId, olderThanHours]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["order-holds", "products", params],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<OrderStockHoldProductResponse>>(
        `carts/order-holds/products?${params}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load held products");
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const columns: TableColumnsType<OrderStockHoldProductResponse> = [
    { title: "Product", key: "product", render: (_, r) => <VariantCell {...r} /> },
    { title: "Warehouse", dataIndex: "locationName", render: (v) => v || "—" },
    {
      title: "Held",
      key: "held",
      align: "right",
      render: (_, r) => (
        <div className="tabular-nums">
          <div>{formatNumber(r.unitsHeld)}</div>
          <div className="text-xs text-muted-foreground">{plural(r.orders, "order")}</div>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="What SuperApp shows customers as available now, after these holds">
          <span className="cursor-help underline decoration-dotted">Available</span>
        </Tooltip>
      ),
      key: "stock",
      align: "right",
      render: (_, r) => (
        <span className={`tabular-nums ${r.stockAtLocation <= 0 ? "font-semibold text-red-600" : ""}`}>
          {formatNumber(r.stockAtLocation)}
        </span>
      ),
    },
    { title: "Oldest", key: "oldest", render: (_, r) => <Age at={r.oldestOrderPlacedAt} /> },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Orders holding it">
            <Button
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => onShowOrders(r)}
            />
          </Tooltip>
          {canEdit && (
            <Tooltip title="Cancel every pending order holding it here">
              <Button
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() =>
                  requestRelease({
                    request: { variantId: r.variantId, locationId: r.locationId },
                    title: "Release this product's stock",
                    description: (
                      <>
                        Cancel the {plural(r.orders, "pending order")} holding{" "}
                        <b>{r.productName || r.sku}</b> at {r.locationName} (
                        {plural(r.unitsHeld, "unit")}). {RELEASE_RULES}
                      </>
                    ),
                  })
                }
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Product name or SKU…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={locationId}
            onChange={(v) => {
              setLocationId(v);
              setPage(1);
            }}
            className="min-w-[180px]"
            options={[
              { value: ALL, label: "All warehouses" },
              ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <InputNumber
            min={1}
            placeholder="Placed ≥ N hours ago"
            value={olderThanHours}
            onChange={(v) => {
              setOlderThanHours(v);
              setPage(1);
            }}
            className="w-48"
          />
        </div>
      </Card>

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<OrderStockHoldProductResponse>
          rowKey={(r) => `${r.variantId}:${r.locationId}`}
          dataSource={data?.data ?? []}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.count ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: "No pending orders are holding stock." }}
        />
      </Card>
    </>
  );
}

function OrderLines({ lines }: { lines: OrderStockHoldLineResponse[] }) {
  return (
    <Table<OrderStockHoldLineResponse>
      rowKey="orderProductId"
      size="small"
      pagination={false}
      dataSource={lines}
      columns={[
        { title: "Product", key: "product", render: (_, l) => <VariantCell {...l} /> },
        { title: "Warehouse", dataIndex: "locationName", render: (v) => v || "—" },
        {
          title: "Qty",
          dataIndex: "quantity",
          align: "right",
          render: (v: number) => <span className="tabular-nums">{formatNumber(v)}</span>,
        },
      ]}
    />
  );
}

/** Pending orders with expandable lines; shared by the orders view and the product drawer. */
function HoldOrdersTable({
  orders,
  loading,
  selectable,
  selected,
  onSelect,
  pagination,
}: {
  orders: OrderStockHoldOrderResponse[];
  loading: boolean;
  selectable: boolean;
  selected: string[];
  onSelect: (ids: string[]) => void;
  pagination?: React.ComponentProps<typeof Table>["pagination"];
}) {
  const columns: TableColumnsType<OrderStockHoldOrderResponse> = [
    {
      title: "Order",
      key: "order",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.orderReference || "—"}</div>
          {r.placedByStaffId && (
            <Tag className="!m-0" color="blue">
              Placed by staff
            </Tag>
          )}
        </div>
      ),
    },
    { title: "Customer", key: "customer", render: (_, r) => <CustomerCell {...r} /> },
    {
      title: "Units",
      key: "units",
      align: "right",
      render: (_, r) => (
        <div className="tabular-nums">
          <div>{formatNumber(r.units)}</div>
          <div className="text-xs text-muted-foreground">{plural(r.lines.length, "line")}</div>
        </div>
      ),
    },
    { title: "Placed", key: "placed", render: (_, r) => <Age at={r.placedAt} /> },
    { title: "Auto-cancel", key: "auto", render: (_, r) => <AutoRelease at={r.autoReleaseAt} /> },
  ];

  return (
    <Table<OrderStockHoldOrderResponse>
      rowKey="orderId"
      dataSource={orders}
      columns={columns}
      loading={loading}
      scroll={{ x: 800 }}
      pagination={pagination ?? (orders.length > 50 ? { pageSize: 50 } : false)}
      expandable={{ expandedRowRender: (r) => <OrderLines lines={r.lines} /> }}
      rowSelection={
        selectable
          ? { selectedRowKeys: selected, onChange: (keys) => onSelect(keys as string[]) }
          : undefined
      }
    />
  );
}

function releaseOrdersRequest(ids: string[]): PendingRelease {
  return {
    request: { orderIds: ids },
    title: "Cancel selected orders",
    description: `Cancel ${plural(ids.length, "pending order")} and return their stock. ${RELEASE_RULES}`,
  };
}

function OrdersView({
  canEdit,
  requestRelease,
}: {
  canEdit: boolean;
  requestRelease: RequestRelease;
}) {
  const { data: locations } = useLocations();
  const [keyword, setKeyword] = useState("");
  const search = useDebouncedValue(keyword, 350);
  const [locationId, setLocationId] = useState(ALL);
  const [olderThanHours, setOlderThanHours] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);

  const filters = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("Search", search.trim());
    if (locationId !== ALL) p.set("LocationId", locationId);
    if (olderThanHours) p.set("OlderThanHours", String(olderThanHours));
    return p.toString();
  }, [search, locationId, olderThanHours]);

  // The API only pages oldest-first (capped at 200 per page), so pull every
  // match and show newest first here. The sweep keeps this list short.
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["order-holds", "orders", filters],
    queryFn: async () => {
      const all: OrderStockHoldOrderResponse[] = [];
      for (let n = 1; ; n++) {
        const res = await apiGet<PaginationResponse<OrderStockHoldOrderResponse>>(
          `carts/order-holds/orders?pageNumber=${n}&pageSize=200${filters ? `&${filters}` : ""}`,
        );
        if (!res.status) throw new Error(res.message ?? "Failed to load pending orders");
        const batch = res.data?.data ?? [];
        all.push(...batch);
        if (!batch.length || all.length >= (res.data?.count ?? 0)) break;
      }
      return all.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
    },
    placeholderData: (prev) => prev,
  });
  const allOrders = data ?? [];
  const orders = allOrders.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Order reference or customer…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={locationId}
            onChange={(v) => {
              setLocationId(v);
              setPage(1);
            }}
            className="min-w-[180px]"
            options={[
              { value: ALL, label: "All warehouses" },
              ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <InputNumber
            min={1}
            placeholder="Placed ≥ N hours ago"
            value={olderThanHours}
            onChange={(v) => {
              setOlderThanHours(v);
              setPage(1);
            }}
            className="w-48"
          />
          {canEdit && (
            <Button
              danger
              className="ml-auto"
              disabled={!selected.length}
              onClick={() => requestRelease(releaseOrdersRequest(selected))}
            >
              Cancel selected ({selected.length})
            </Button>
          )}
        </div>
      </Card>

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <HoldOrdersTable
          orders={orders}
          loading={isLoading || isFetching}
          selectable={canEdit}
          selected={selected.filter((id) => orders.some((o) => o.orderId === id))}
          onSelect={setSelected}
          pagination={{
            current: page,
            pageSize,
            total: allOrders.length,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              setSelected([]);
            },
          }}
        />
      </Card>
    </>
  );
}

function ProductOrdersDrawer({
  product,
  canEdit,
  onClose,
  requestRelease,
}: {
  product: OrderStockHoldProductResponse | null;
  canEdit: boolean;
  onClose: () => void;
  requestRelease: RequestRelease;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["order-holds", "product-orders", product?.variantId, product?.locationId],
    enabled: !!product,
    queryFn: async () => {
      const res = await apiGet<OrderStockHoldOrderResponse[]>(
        `carts/order-holds/products/${product!.variantId}/orders?locationId=${product!.locationId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load orders");
      // Newest first, matching the orders view.
      return (res.data ?? []).sort(
        (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
      );
    },
  });
  const orders = data ?? [];

  return (
    <Drawer
      open={!!product}
      onClose={() => {
        setSelected([]);
        onClose();
      }}
      size={860}
      title={product ? `${product.productName || product.sku} · ${product.locationName}` : ""}
      extra={
        canEdit && (
          <Button
            danger
            disabled={!selected.length}
            onClick={() => requestRelease(releaseOrdersRequest(selected))}
          >
            Cancel selected ({selected.length})
          </Button>
        )
      }
    >
      {error && <Alert type="error" showIcon message={(error as Error).message} className="mb-4" />}
      {product && (
        <div className="mb-3 text-sm text-muted-foreground">
          {formatNumber(product.unitsHeld)} held · {formatNumber(product.stockAtLocation)} available.
          Cancelling an order releases all of its lines, not just this product.
        </div>
      )}
      <HoldOrdersTable
        orders={orders}
        loading={isLoading}
        selectable={canEdit}
        selected={selected.filter((id) => orders.some((o) => o.orderId === id))}
        onSelect={setSelected}
      />
    </Drawer>
  );
}

function RefundsView() {
  const [days, setDays] = useState(90);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["order-holds", "cancelled-with-payments", days],
    queryFn: async () => {
      const res = await apiGet<CancelledOrderPaymentResponse[]>(
        `carts/order-holds/cancelled-with-payments?days=${days}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load cancelled orders");
      return res.data ?? [];
    },
    placeholderData: (prev) => prev,
  });

  const columns: TableColumnsType<CancelledOrderPaymentResponse> = [
    { title: "Order", dataIndex: "orderReference", render: (v) => <span className="font-medium">{v || "—"}</span> },
    { title: "Customer", key: "customer", render: (_, r) => <CustomerCell {...r} /> },
    {
      title: "Amount paid",
      dataIndex: "amountPaid",
      align: "right",
      sorter: (a, b) => a.amountPaid - b.amountPaid,
      render: (v: number) => <span className="tabular-nums">{formatCurrency(v, "NGN")}</span>,
    },
    {
      title: "Payment references",
      dataIndex: "paymentReferences",
      render: (refs: string[]) =>
        refs.length ? (
          <div className="flex flex-wrap gap-1">
            {refs.map((r) => (
              <Tag key={r} className="!m-0 font-mono">
                {r}
              </Tag>
            ))}
          </div>
        ) : (
          "—"
        ),
    },
    { title: "Placed", dataIndex: "placedAt", render: (v: string) => formatDateTime(v) },
    { title: "Last payment", dataIndex: "lastPaymentAt", render: (v: string) => formatDateTime(v) },
    { title: "Cancelled / modified", dataIndex: "lastModified", render: (v: string | null) => formatDateTime(v) },
  ];

  const total = (data ?? []).reduce((t, r) => t + r.amountPaid, 0);

  return (
    <>
      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">Cancelled in the last</span>
          <InputNumber
            min={1}
            max={3650}
            value={days}
            onChange={(v) => v && setDays(v)}
            addonAfter="days"
            className="w-40"
          />
          {data && (
            <span className="ml-auto text-sm text-muted-foreground">
              {plural(data.length, "order")} · {formatCurrency(total, "NGN")} recorded
            </span>
          )}
        </div>
      </Card>

      <Alert
        type="warning"
        showIcon
        message="These instant-payment orders were cancelled after the customer paid something. Check each against the payment provider and refund or re-instate it."
      />

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CancelledOrderPaymentResponse>
          rowKey="orderId"
          dataSource={data ?? []}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          locale={{ emptyText: "No cancelled orders with payments in this window." }}
        />
      </Card>
    </>
  );
}

function ReleaseResultModal({
  result,
  onClose,
}: {
  result: ReleaseOrderStockResponse | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!result}
      onCancel={onClose}
      onOk={onClose}
      cancelButtonProps={{ className: "!hidden" }}
      title="Release result"
      width={720}
    >
      {result && (
        <div className="space-y-4">
          <div>
            Cancelled <b>{plural(result.ordersReleased, "order")}</b>, returned{" "}
            <b>{plural(result.unitsReturned, "unit")}</b> to stock.
          </div>
          {result.released.length > 0 && (
            <Table
              rowKey="orderId"
              size="small"
              pagination={false}
              dataSource={result.released}
              columns={[
                { title: "Order", dataIndex: "orderReference", render: (v) => v || "—" },
                { title: "Customer", dataIndex: "email", render: (v) => v || "—" },
                { title: "Units", dataIndex: "units", align: "right" },
                {
                  title: "Notified",
                  dataIndex: "customerNotified",
                  render: (v: boolean) => (v ? <Tag color="success">Yes</Tag> : <Tag>No</Tag>),
                },
              ]}
            />
          )}
          {result.skipped.length > 0 && (
            <>
              <div className="font-medium text-amber-600">
                Skipped {plural(result.skipped.length, "order")}
              </div>
              <Table
                rowKey="orderId"
                size="small"
                pagination={false}
                dataSource={result.skipped}
                columns={[
                  { title: "Order", dataIndex: "orderReference", render: (v) => v || "—" },
                  { title: "Reason", dataIndex: "reason" },
                ]}
              />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
