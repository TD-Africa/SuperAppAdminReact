import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  SyncOutlined,
  FontSizeOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch, apiPut, apiPost, API_BASE_URL, API_ORIGIN } from "@/lib/api";
import type {
  LocationWithQuantityResponse,
  PaginationResponse,
  ProductReturnDto,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

const ALL = "__all__";

// The flags EditProduct can patch, mapped from the PascalCase name the request
// body uses to the camelCase key the same flag arrives under in the list
// response. EditProductRequest is deserialized case-insensitively, so the
// PascalCase keys are what the existing calls already send.
const TOGGLE_FIELDS = {
  IsActive: "isActive",
  IsFeaturedProduct: "isFeaturedProduct",
  IsDollarPurchasable: "isDollarPurchasable",
} as const;

type ToggleField = keyof typeof TOGGLE_FIELDS;

const warehouseBreakdownColumns: TableColumnsType<LocationWithQuantityResponse> = [
  {
    title: "Warehouse",
    dataIndex: "name",
    render: (v: string) => <span className="font-medium">{v || "—"}</span>,
  },
  {
    title: "Dynamics ID",
    dataIndex: "dynamicsId",
    render: (v: string | null) => (
      <span className="text-xs text-muted-foreground">{v ?? "—"}</span>
    ),
  },
  {
    title: "Status",
    dataIndex: "isActive",
    width: 110,
    render: (v: boolean) => (
      <Tag color={v ? "success" : "default"}>{v ? "Active" : "Inactive"}</Tag>
    ),
  },
  {
    title: "Quantity",
    dataIndex: "quantity",
    align: "right",
    width: 120,
    render: (v: number) => <span className="font-medium">{formatNumber(v)}</span>,
  },
];

/**
 * Per-warehouse stock for one product row.
 *
 * `warehouse[]` carries one entry per warehouse since the all-warehouses
 * migration, so the grid's headline quantity is a sum that no longer maps to
 * anywhere you can go and count. This is the breakdown behind that number.
 *
 * The rendered total is summed from the rows rather than reusing the product's
 * own `quantity`, so the two showing different figures is itself the signal
 * that the row's stock data is stale or incomplete.
 */
function WarehouseBreakdown({ product }: { product: ProductReturnDto }) {
  const rows = product.warehouse ?? [];

  if (rows.length === 0) {
    return (
      <Typography.Text type="secondary" className="!text-xs">
        No per-warehouse stock reported for this product. Out-of-stock rows and
        products with no active variants come back without a breakdown.
      </Typography.Text>
    );
  }

  const total = rows.reduce((sum, w) => sum + (w.quantity ?? 0), 0);

  return (
    <Table<LocationWithQuantityResponse>
      rowKey={(r) => `${r.id}-${r.dynamicsId ?? ""}`}
      dataSource={rows}
      columns={warehouseBreakdownColumns}
      pagination={false}
      size="small"
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={3}>
            <span className="text-xs text-muted-foreground">
              {rows.length === 1 ? "1 warehouse" : `${rows.length} warehouses`}
            </span>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right">
            <span className="font-semibold">{formatNumber(total)}</span>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [isFeatured, setIsFeatured] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [inventorySyncing, setInventorySyncing] = useState(false);
  const [pricesSyncing, setPricesSyncing] = useState(false);
  const [namesSyncing, setNamesSyncing] = useState(false);

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

  async function toggleField(id: string, field: ToggleField, value: boolean) {
    const key = TOGGLE_FIELDS[field];
    const prev = queryClient.getQueryData<PaginationResponse<ProductReturnDto>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<ProductReturnDto>>(queryKey, {
        ...prev,
        data: prev.data.map((p) => (p.id === id ? { ...p, [key]: value } : p)),
      });
    }
    const res = await apiPatch<boolean>(`product/editProduct/${id}`, {
      [field]: value,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? "Updated");
    }
  }

  async function syncPrice(id: string) {
    const res = await apiPut<boolean>(`product/SyncProductPrice/${id}`);
    if (res.status) {
      message.success(res.message ?? "Price synced");
      refetch();
    } else {
      message.error(res.message ?? "Sync failed");
    }
  }

  async function syncAllPrices() {
    setPricesSyncing(true);
    const hide = message.loading("Syncing all product prices…", 0);
    try {
      const res = await apiPut<boolean>(
        "Product/SyncAllProductPrices/sync-all-prices",
      );
      if (res.status) {
        message.success(res.message ?? "All prices synced");
        refetch();
      } else {
        message.error(res.message ?? "Price sync failed");
      }
    } finally {
      hide();
      setPricesSyncing(false);
    }
  }

  async function syncName(id: string) {
    const res = await apiPut<boolean>(`Product/SyncProductName/${id}/sync-name`);
    if (res.status) {
      message.success(res.message ?? "Name synced");
      refetch();
    } else {
      message.error(res.message ?? "Sync failed");
    }
  }

  async function syncAllNames() {
    setNamesSyncing(true);
    const hide = message.loading("Syncing all product names…", 0);
    try {
      const res = await apiPut<boolean>(
        "Product/SyncAllProductNames/sync-all-names",
      );
      if (res.status) {
        message.success(res.message ?? "All names synced");
        refetch();
      } else {
        message.error(res.message ?? "Name sync failed");
      }
    } finally {
      hide();
      setNamesSyncing(false);
    }
  }

  // NOTE: the bulk "sync all images" action is gone. Product/SyncAllProductImages
  // is [Obsolete(error: true)] on the backend and throws NotSupportedException
  // (an unhandled 500) — image sync is handled by
  // InventoryStockUpdateBackgroundService now. The per-product "Sync images" in
  // ProductDetailModal still works; it calls SyncSpecificProductImages, which is
  // one of the sync entrypoints that survived.

  async function runInventorySync() {
    setInventorySyncing(true);
    const hide = message.loading("Running inventory sync…", 0);
    try {
      const res = await apiPost<unknown>(
        `${API_ORIGIN}/api/jobs/run-inventory-sync`,
        null,
      );
      if (res.status) {
        message.success(res.message ?? "Inventory sync started");
        refetch();
      } else {
        message.error(res.message ?? "Inventory sync failed");
      }
    } finally {
      hide();
      setInventorySyncing(false);
    }
  }

  function downloadAll() {
    window.open(`${API_BASE_URL}Product/DownloadAllProducts`, "_blank");
  }

  function downloadFiltered() {
    window.open(
      `${API_BASE_URL}Product/DownloadAllProducts?${queryParams.toString()}`,
      "_blank",
    );
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<ProductReturnDto> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v, r) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium">{v}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.category ?? "—"}
          </div>
        </div>
      ),
    },
    { title: "Brand", dataIndex: ["brand", "name"], render: (v) => v ?? "—" },
    {
      // Backend sums this across every warehouse now, not just TD MW — say so,
      // otherwise the figure reads as one location's stock.
      title: "Qty (all warehouses)",
      dataIndex: "quantity",
      align: "right",
      render: (v) => formatNumber(v),
    },
    {
      title: "Price (NGN)",
      dataIndex: "priceInNaira",
      align: "right",
      render: (v) => formatCurrency(v, "NGN"),
    },
    {
      title: "Price (USD)",
      dataIndex: "priceInDollar",
      align: "right",
      render: (v) => formatCurrency(v, "USD"),
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    {
      title: "Visible",
      dataIndex: "isVisible",
      render: (v: boolean) => <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>,
    },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleField(r.id, "IsActive", val)} />
      ),
    },
    {
      title: "Featured",
      dataIndex: "isFeaturedProduct",
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleField(r.id, "IsFeaturedProduct", val)} />
      ),
    },
    {
      title: (
        <Tooltip title="Whether this product can be bought in dollars. The brand is the master switch — set that on the Exchange Rates page.">
          <span>Dollar Purchasable</span>
        </Tooltip>
      ),
      dataIndex: "isDollarPurchasable",
      width: 100,
      render: (v: boolean | undefined, r) => {
        // The catalog response doesn't carry this flag yet, so on a freshly
        // loaded page every row is `undefined` — unknown, not off. Say that
        // rather than letting an off-looking switch pass for the real value.
        // Toggling still saves, and the optimistic write makes the row known
        // from then on. Once the API returns the field this branch stops
        // firing on its own.
        const unknown = v === undefined;
        return (
          <Tooltip
            title={
              unknown
                ? "Current value isn't returned by the catalog API yet. Toggling saves the new value."
                : undefined
            }
          >
            <span className={unknown ? "opacity-50" : undefined}>
              <Switch
                checked={v ?? false}
                disabled={!canEdit}
                onChange={(val) => toggleField(r.id, "IsDollarPurchasable", val)}
              />
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 140,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} />
          {canEdit && (
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => syncPrice(r.id)}
              title="Sync price"
            />
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<FontSizeOutlined />}
              onClick={() => syncName(r.id)}
              title="Sync name"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Products
        </Typography.Title>
        <Typography.Text type="secondary">
          Browse, search, and manage the product catalog.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search products by name, SKU, Dynamics ID…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={isActive}
            onChange={(v) => {
              setPage(1);
              setIsActive(v);
            }}
            options={[
              { value: ALL, label: "All statuses" },
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
          <Select
            className="md:col-span-3"
            value={isFeatured}
            onChange={(v) => {
              setPage(1);
              setIsFeatured(v);
            }}
            options={[
              { value: ALL, label: "All products" },
              { value: "true", label: "Featured only" },
              { value: "false", label: "Not featured" },
            ]}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : null}
        </span>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={downloadFiltered}>
            Download (filtered)
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadAll}>
            Download all
          </Button>
          {canEdit && (
            <Button
              type="default"
              icon={<SyncOutlined spin={pricesSyncing} />}
              loading={pricesSyncing}
              onClick={syncAllPrices}
            >
              Sync all prices
            </Button>
          )}
          {canEdit && (
            <Button
              type="default"
              icon={<SyncOutlined spin={namesSyncing} />}
              loading={namesSyncing}
              onClick={syncAllNames}
            >
              Sync all names
            </Button>
          )}
          {canEdit && (
            <Tooltip title="Pulls stock for every warehouse from Dynamics. This also runs automatically each hour — trigger it manually only to pick up a change early.">
              <Button
                type="primary"
                icon={<SyncOutlined spin={inventorySyncing} />}
                loading={inventorySyncing}
                onClick={runInventorySync}
              >
                Run inventory sync
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ProductReturnDto>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          expandable={{
            expandedRowRender: (r) => <WarehouseBreakdown product={r} />,
            // The default +/- square reads like "add a row" rather than
            // "reveal what's underneath". A chevron that turns to point down
            // when open is the usual disclosure affordance, and it also shows
            // which rows are currently expanded at a glance.
            expandIcon: ({ expanded, onExpand, record }) => {
              const label = expanded
                ? "Hide warehouse breakdown"
                : "Show warehouse breakdown";
              return (
                <Tooltip title={label}>
                  <Button
                    type="text"
                    size="small"
                    aria-label={label}
                    aria-expanded={expanded}
                    onClick={(e) => onExpand(record, e)}
                    icon={
                      <RightOutlined
                        className={`!text-xs text-muted-foreground transition-transform duration-200 ${
                          expanded ? "rotate-90" : ""
                        }`}
                      />
                    }
                  />
                </Tooltip>
              );
            },
          }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: "No products match the current filters." }}
        />
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
