import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Drawer,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, EyeOutlined, TeamOutlined } from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import type {
  CartAdminCartResponse,
  CartAdminLineResponse,
  CartAdminProductResponse,
  CartAdminSummaryResponse,
  PaginationResponse,
  ReleaseCartProductsRequest,
  ReleaseCartProductsResponse,
} from "@/lib/types";
import { formatNumber } from "@/lib/utils";
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

interface PendingRelease {
  request: ReleaseCartProductsRequest;
  title: string;
  description: React.ReactNode;
}

type RequestRelease = (r: PendingRelease) => void;

function plural(n: number, word: string) {
  return `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function CartsTab({ canClear }: { canClear: boolean }) {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"products" | "carts">("products");
  const [onlyExceeding, setOnlyExceeding] = useState(false);
  const [pending, setPending] = useState<PendingRelease | null>(null);
  // Drawers stay mounted under the tab so a release can refresh what's open.
  const [linesFor, setLinesFor] = useState<CartAdminProductResponse | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["cart-admin", "summary"],
    queryFn: async () => {
      const res = await apiGet<CartAdminSummaryResponse>("carts/summary");
      if (!res.status) throw new Error(res.message ?? "Failed to load cart summary");
      return res.data;
    },
  });

  async function confirmRelease(reason: string) {
    if (!pending) return;
    const res = await apiPost<ReleaseCartProductsResponse>("carts/release", {
      ...pending.request,
      reason,
    });
    if (!res.status) {
      message.error(res.message ?? "Release failed");
      return;
    }
    message.success(res.message ?? "Released");
    setPending(null);
    await queryClient.invalidateQueries({ queryKey: ["cart-admin"] });
  }

  const s = summary.data;

  return (
    <div className="space-y-4">
      {summary.error && (
        <Alert type="error" showIcon message={(summary.error as Error).message} />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Carts with items" value={s ? formatNumber(s.carts) : "…"} />
        <StatTile label="Units in carts" value={s ? formatNumber(s.units) : "…"} />
        <StatTile
          label="Products (variant × warehouse)"
          value={s ? formatNumber(s.variants) : "…"}
        />
        <StatTile
          label="Over-carted"
          value={s ? formatNumber(s.variantsExceedingStock) : "…"}
          tone={s?.variantsExceedingStock ? "danger" : undefined}
          hint="Products where carts hold more units than the warehouse has. Click to filter."
          onClick={() => {
            setView("products");
            setOnlyExceeding(true);
          }}
        />
        <StatTile label="Oldest cart line" value={<Age at={s?.oldestLineAddedAt} />} />
      </div>

      <Alert
        type="info"
        showIcon
        message="Carts don't reserve stock. Releasing a product just takes it out of the customer's cart; nobody is notified."
      />

      <Segmented
        value={view}
        onChange={(v) => setView(v as typeof view)}
        options={[
          { value: "products", label: "By product" },
          { value: "carts", label: "By customer" },
        ]}
      />

      {view === "products" ? (
        <ProductsView
          canClear={canClear}
          onlyExceeding={onlyExceeding}
          setOnlyExceeding={setOnlyExceeding}
          onShowLines={setLinesFor}
          requestRelease={setPending}
        />
      ) : (
        <CartsView canClear={canClear} onOpen={setCartId} requestRelease={setPending} />
      )}

      <LinesDrawer
        product={linesFor}
        canClear={canClear}
        onClose={() => setLinesFor(null)}
        requestRelease={setPending}
      />
      <CartDrawer
        cartId={cartId}
        canClear={canClear}
        onClose={() => setCartId(null)}
        requestRelease={setPending}
      />

      <ReleaseDialog
        open={!!pending}
        title={pending?.title ?? ""}
        description={pending?.description}
        onCancel={() => setPending(null)}
        onConfirm={({ reason }) => confirmRelease(reason)}
      />
    </div>
  );
}

function ProductsView({
  canClear,
  onlyExceeding,
  setOnlyExceeding,
  onShowLines,
  requestRelease,
}: {
  canClear: boolean;
  onlyExceeding: boolean;
  setOnlyExceeding: (v: boolean) => void;
  onShowLines: (p: CartAdminProductResponse) => void;
  requestRelease: RequestRelease;
}) {
  const { data: locations } = useLocations();
  const [keyword, setKeyword] = useState("");
  const search = useDebouncedValue(keyword, 350);
  const [locationId, setLocationId] = useState(ALL);
  const [olderThanDays, setOlderThanDays] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("pageNumber", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("Search", search.trim());
    if (locationId !== ALL) p.set("LocationId", locationId);
    if (onlyExceeding) p.set("OnlyExceedingStock", "true");
    if (olderThanDays) p.set("OlderThanDays", String(olderThanDays));
    return p.toString();
  }, [page, pageSize, search, locationId, onlyExceeding, olderThanDays]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["cart-admin", "products", params],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<CartAdminProductResponse>>(
        `carts/products?${params}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load cart products");
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const columns: TableColumnsType<CartAdminProductResponse> = [
    { title: "Product", key: "product", render: (_, r) => <VariantCell {...r} /> },
    { title: "Warehouse", dataIndex: "locationName", render: (v) => v || "—" },
    {
      title: "In carts",
      key: "units",
      align: "right",
      render: (_, r) => (
        <div className="tabular-nums">
          <div>{formatNumber(r.quantityInCarts)}</div>
          <div className="text-xs text-muted-foreground">{plural(r.carts, "cart")}</div>
        </div>
      ),
    },
    {
      title: "On hand",
      key: "stock",
      align: "right",
      render: (_, r) => (
        <div className="tabular-nums">
          <div className={r.exceedsStock ? "font-semibold text-red-600" : undefined}>
            {formatNumber(r.stockAtLocation)}
          </div>
          {r.exceedsStock && <Tag color="error" className="!m-0">Over-carted</Tag>}
        </div>
      ),
    },
    { title: "Oldest", key: "oldest", render: (_, r) => <Age at={r.oldestAddedAt} /> },
    { title: "Latest", key: "latest", render: (_, r) => <Age at={r.latestAddedAt} /> },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Customers holding it">
            <Button size="small" icon={<TeamOutlined />} onClick={() => onShowLines(r)} />
          </Tooltip>
          {canClear && (
            <Tooltip title="Remove from every cart at this warehouse">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  requestRelease({
                    request: { variantId: r.variantId, locationId: r.locationId },
                    title: "Remove from every cart",
                    description: (
                      <>
                        Take <b>{r.productName || r.sku}</b> ({r.locationName}) out of{" "}
                        {plural(r.carts, "customer cart")}: {plural(r.quantityInCarts, "unit")}.
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
            placeholder="Added ≥ N days ago"
            value={olderThanDays}
            onChange={(v) => {
              setOlderThanDays(v);
              setPage(1);
            }}
            className="w-44"
          />
          <Checkbox
            checked={onlyExceeding}
            onChange={(e) => {
              setOnlyExceeding(e.target.checked);
              setPage(1);
            }}
          >
            Only over-carted
          </Checkbox>
        </div>
      </Card>

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CartAdminProductResponse>
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
          locale={{ emptyText: "No products in customer carts match." }}
        />
      </Card>
    </>
  );
}

function CartsView({
  canClear,
  onOpen,
  requestRelease,
}: {
  canClear: boolean;
  onOpen: (cartId: string) => void;
  requestRelease: RequestRelease;
}) {
  const [keyword, setKeyword] = useState("");
  const search = useDebouncedValue(keyword, 350);
  const [idleForDays, setIdleForDays] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("pageNumber", String(page));
    p.set("pageSize", String(pageSize));
    if (search.trim()) p.set("Search", search.trim());
    if (idleForDays) p.set("IdleForDays", String(idleForDays));
    return p.toString();
  }, [page, pageSize, search, idleForDays]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["cart-admin", "carts", params],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<CartAdminCartResponse>>(`carts?${params}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load carts");
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const columns: TableColumnsType<CartAdminCartResponse> = [
    { title: "Customer", key: "customer", render: (_, r) => <CustomerCell {...r} /> },
    {
      title: "Lines",
      dataIndex: "lines",
      align: "right",
      render: (v: number) => <span className="tabular-nums">{formatNumber(v)}</span>,
    },
    {
      title: "Units",
      dataIndex: "units",
      align: "right",
      render: (v: number) => <span className="tabular-nums">{formatNumber(v)}</span>,
    },
    { title: "Last activity", key: "last", render: (_, r) => <Age at={r.lastActivity} /> },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View cart">
            <Button size="small" icon={<EyeOutlined />} onClick={() => onOpen(r.cartId)} />
          </Tooltip>
          {canClear && r.userId && (
            <Tooltip title="Empty this cart">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  requestRelease({
                    request: { userId: r.userId! },
                    title: "Empty cart",
                    description: (
                      <>
                        Remove everything from{" "}
                        <b>{r.companyName || r.customerName || r.email}</b>'s cart:{" "}
                        {plural(r.lines, "line")}, {plural(r.units, "unit")}.
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
            placeholder="Email, name, company or D365 ID…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <InputNumber
            min={1}
            placeholder="Idle ≥ N days"
            value={idleForDays}
            onChange={(v) => {
              setIdleForDays(v);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
      </Card>

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CartAdminCartResponse>
          rowKey="cartId"
          dataSource={data?.data ?? []}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 700 }}
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
          locale={{ emptyText: "No carts with items match." }}
        />
      </Card>
    </>
  );
}

/** Cart lines with optional selection; shared by both drawers. */
function LinesTable({
  lines,
  loading,
  show,
  selectable,
  selected,
  onSelect,
}: {
  lines: CartAdminLineResponse[];
  loading: boolean;
  show: "customer" | "product";
  selectable: boolean;
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const columns: TableColumnsType<CartAdminLineResponse> = [
    show === "customer"
      ? { title: "Customer", key: "customer", render: (_, r) => <CustomerCell {...r} /> }
      : { title: "Product", key: "product", render: (_, r) => <VariantCell {...r} /> },
    ...(show === "product"
      ? [{ title: "Warehouse", dataIndex: "locationName", render: (v: string | null) => v || "—" }]
      : []),
    {
      title: "Qty",
      key: "qty",
      align: "right",
      render: (_, r) => (
        <Tooltip title={`${formatNumber(r.stockAtLocation)} on hand at ${r.locationName ?? "this warehouse"}`}>
          <span
            className={`tabular-nums ${r.quantity > r.stockAtLocation ? "font-semibold text-red-600" : ""}`}
          >
            {formatNumber(r.quantity)}
          </span>
        </Tooltip>
      ),
    },
    { title: "Added", key: "added", render: (_, r) => <Age at={r.dateAdded} /> },
  ];

  return (
    <Table<CartAdminLineResponse>
      rowKey="cartProductId"
      size="small"
      dataSource={lines}
      columns={columns}
      loading={loading}
      pagination={lines.length > 50 ? { pageSize: 50 } : false}
      rowSelection={
        selectable
          ? { selectedRowKeys: selected, onChange: (keys) => onSelect(keys as string[]) }
          : undefined
      }
    />
  );
}

function LinesDrawer({
  product,
  canClear,
  onClose,
  requestRelease,
}: {
  product: CartAdminProductResponse | null;
  canClear: boolean;
  onClose: () => void;
  requestRelease: RequestRelease;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cart-admin", "lines", product?.variantId, product?.locationId],
    enabled: !!product,
    queryFn: async () => {
      const res = await apiGet<CartAdminLineResponse[]>(
        `carts/products/${product!.variantId}/lines?locationId=${product!.locationId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load cart lines");
      return res.data ?? [];
    },
  });
  const lines = data ?? [];

  return (
    <Drawer
      open={!!product}
      onClose={() => {
        setSelected([]);
        onClose();
      }}
      size={720}
      title={product ? `${product.productName || product.sku} · ${product.locationName}` : ""}
      extra={
        canClear && (
          <Button
            danger
            disabled={!selected.length}
            onClick={() =>
              requestRelease({
                request: { cartProductIds: selected },
                title: "Remove selected lines",
                description: `Remove this product from ${plural(selected.length, "customer cart")}.`,
              })
            }
          >
            Remove selected ({selected.length})
          </Button>
        )
      }
    >
      {error && <Alert type="error" showIcon message={(error as Error).message} className="mb-4" />}
      {product && (
        <div className="mb-3 text-sm text-muted-foreground">
          {formatNumber(product.quantityInCarts)} in carts · {formatNumber(product.stockAtLocation)} on
          hand
        </div>
      )}
      <LinesTable
        lines={lines}
        loading={isLoading}
        show="customer"
        selectable={canClear}
        selected={selected.filter((id) => lines.some((l) => l.cartProductId === id))}
        onSelect={setSelected}
      />
    </Drawer>
  );
}

function CartDrawer({
  cartId,
  canClear,
  onClose,
  requestRelease,
}: {
  cartId: string | null;
  canClear: boolean;
  onClose: () => void;
  requestRelease: RequestRelease;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const { data: cart, isLoading, error } = useQuery({
    queryKey: ["cart-admin", "cart", cartId],
    enabled: !!cartId,
    queryFn: async () => {
      const res = await apiGet<CartAdminCartResponse>(`carts/${cartId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load cart");
      return res.data;
    },
  });
  const lines = cart?.items ?? [];
  const who = cart ? cart.companyName || cart.customerName || cart.email : "";

  return (
    <Drawer
      open={!!cartId}
      onClose={() => {
        setSelected([]);
        onClose();
      }}
      size={720}
      title={who ? `Cart · ${who}` : "Cart"}
      extra={
        canClear &&
        cart && (
          <Space>
            <Button
              danger
              disabled={!selected.length}
              onClick={() =>
                requestRelease({
                  request: { cartProductIds: selected },
                  title: "Remove selected lines",
                  description: `Remove ${plural(selected.length, "line")} from ${who}'s cart.`,
                })
              }
            >
              Remove selected ({selected.length})
            </Button>
            {cart.userId && lines.length > 0 && (
              <Button
                danger
                type="primary"
                onClick={() =>
                  requestRelease({
                    request: { userId: cart.userId! },
                    title: "Empty cart",
                    description: `Remove everything from ${who}'s cart: ${plural(cart.units, "unit")}.`,
                  })
                }
              >
                Empty cart
              </Button>
            )}
          </Space>
        )
      }
    >
      {error && <Alert type="error" showIcon message={(error as Error).message} className="mb-4" />}
      {cart && (
        <div className="mb-3 text-sm text-muted-foreground">
          {[cart.email, cart.customerId].filter(Boolean).join(" · ")}
        </div>
      )}
      <LinesTable
        lines={lines}
        loading={isLoading}
        show="product"
        selectable={canClear}
        selected={selected.filter((id) => lines.some((l) => l.cartProductId === id))}
        onSelect={setSelected}
      />
    </Drawer>
  );
}
