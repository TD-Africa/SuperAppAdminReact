import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import { CappedPagination } from "@/components/analytics/CappedPagination";
import { ComparisonBars } from "@/components/analytics/ComparisonBars";
import { MoneyValue } from "@/components/analytics/MoneyValue";
import { StatCard } from "@/components/analytics/StatCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ANALYTICS_STALE_TIME, getAnalytics } from "@/lib/analytics";
import type {
  AnalyticsLookup,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsProductDetail,
  AnalyticsProductRow,
  AnalyticsProducts,
  AnalyticsProductWarehouse,
  AnalyticsReport,
  UpdateSearch,
} from "@/lib/analytics";
import { count, dollars, watTimestamp } from "@/lib/analyticsFormat";

// ---------------------------------------------------------------------------
// Formatters & constants
// ---------------------------------------------------------------------------

const skuLabel = (row: AnalyticsProductRow) =>
  row.sku ? `${row.sku} · ${row.name}` : row.name;

const STOCK_LABELS: Record<AnalyticsProductRow["stockStatus"], string> = {
  recorded: "Recorded warehouse stock",
  ambiguous_sku: "SKU stock needs reconciliation",
  unavailable: "Stock unavailable",
  invalid_stock: "Stock balance needs review",
  incomplete_stock: "Stock coverage incomplete",
};

/** What the bestseller chart plots for each "Rank bestsellers by" choice. */
const RANKINGS = {
  units: {
    label: "Charged units",
    value: (row: AnalyticsProductRow) => row.chargedUnits,
  },
  revenue: {
    label: "Net order value (NGN)",
    value: (row: AnalyticsProductRow) => row.revenueNaira,
  },
  orders: {
    label: "Orders",
    value: (row: AnalyticsProductRow) => row.orderCount,
  },
};

const rankingFor = (sort: unknown) =>
  sort === "revenue" || sort === "orders" ? RANKINGS[sort] : RANKINGS.units;

const RANK_OPTIONS = [
  { value: "units", label: "Charged units" },
  { value: "revenue", label: "Net order value" },
  { value: "orders", label: "Order count" },
];

const STOCK_VIEW_OPTIONS = [
  { value: "all", label: "All stocked SKUs" },
  { value: "no_orders", label: "Stocked with no orders" },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/** Remaining stock, or the reason it's unavailable. Missing stock is never shown as zero. */
function Stock({
  row,
}: {
  row: Pick<AnalyticsProductRow, "remainingStock" | "stockStatus">;
}) {
  if (row.remainingStock == null) {
    return (
      <Typography.Text type="secondary">
        {STOCK_LABELS[row.stockStatus]}
      </Typography.Text>
    );
  }

  return <span>{count(row.remainingStock)}</span>;
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

function productColumns(
  open: (key: string) => void,
): TableColumnsType<AnalyticsProductRow> {
  return [
    {
      title: "Product / SKU",
      key: "product",
      width: 270,
      render: (_, row) => (
        <div>
          <Button
            type="link"
            className="!h-auto !whitespace-normal !p-0 !text-left"
            onClick={() => open(row.key)}
          >
            {row.name}
          </Button>

          <div>
            <Typography.Text type="secondary">
              {row.sku ?? "SKU unavailable"}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "Ordered units",
      dataIndex: "orderedUnits",
      align: "right",
      render: count,
    },
    {
      title: "Charged units",
      dataIndex: "chargedUnits",
      align: "right",
      render: count,
    },
    {
      title: "Free units",
      dataIndex: "freeUnits",
      align: "right",
      render: count,
    },
    {
      title: "Orders",
      dataIndex: "orderCount",
      align: "right",
      render: count,
    },
    {
      title: "Buying partners",
      dataIndex: "orderingPartners",
      align: "right",
      render: count,
    },
    {
      title: "Net order value",
      key: "revenue",
      align: "right",
      render: (_, row) => (
        <MoneyValue naira={row.revenueNaira} usd={row.revenueUsd} />
      ),
    },
    {
      title: "Remaining stock",
      key: "stock",
      align: "right",
      render: (_, row) => <Stock row={row} />,
    },
    {
      title: "Last order in window",
      dataIndex: "lastOrderedAt",
      render: (value: string | null) =>
        value ? watTimestamp(value) : "No orders",
    },
  ];
}

const warehouseColumns: TableColumnsType<AnalyticsProductWarehouse> = [
  { title: "Warehouse", dataIndex: "name" },
  {
    title: "Orders",
    dataIndex: "orderCount",
    align: "right",
    render: count,
  },
  {
    title: "Ordered units",
    dataIndex: "orderedUnits",
    align: "right",
    render: count,
  },
  {
    title: "Net order value",
    key: "revenue",
    align: "right",
    render: (_, row) => (
      <MoneyValue naira={row.revenueNaira} usd={row.revenueUsd} />
    ),
  },
  {
    title: "Remaining stock",
    key: "stock",
    align: "right",
    render: (_, row) => <Stock row={row} />,
  },
];

// ---------------------------------------------------------------------------
// Warehouse filter
// ---------------------------------------------------------------------------

function WarehouseFilter({
  value,
  scope,
  change,
}: {
  value?: string;
  scope: string;
  change: (id?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);

  const result = useQuery({
    queryKey: ["analytics", scope, "lookup", "warehouse", debounced, value],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsLookup[]>(
        "lookups/warehouse",
        { search: debounced || value || "" },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const options = result.data?.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  return (
    <div>
      <label className="mb-1 block text-sm">Warehouse</label>

      <Select
        aria-label="SKU warehouse"
        className="w-full"
        placeholder="All warehouses"
        allowClear
        showSearch
        filterOption={false}
        value={value}
        onSearch={setSearch}
        onChange={(id) => {
          setSearch("");
          change(id);
        }}
        loading={result.isFetching}
        options={options}
      />

      {result.isError && (
        <Button size="small" onClick={() => void result.refetch()}>
          Retry warehouses
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SKU detail drawer
// ---------------------------------------------------------------------------

function ProductTrendChart({ detail }: { detail: AnalyticsProductDetail }) {
  if (!detail.product.orderCount) {
    return <Empty description="No eligible orders in this window" />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={detail.timeseries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="periodStart" minTickGap={24} />
          <YAxis allowDecimals={false} width={45} />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="orderedUnits"
            name="Ordered units"
            fill="#800020"
            isAnimationActive={false}
          />
          <Bar
            dataKey="chargedUnits"
            name="Charged units"
            fill="#2563eb"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProductDrawer({
  skuKey,
  params,
  scope,
  close,
}: {
  skuKey: string;
  params: AnalyticsParams;
  scope: string;
  close: () => void;
}) {
  const result = useQuery({
    queryKey: ["analytics", scope, "products/detail", params, skuKey],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsProductDetail>>(
        "products/detail",
        { ...params, skuKey },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const detail = result.data?.data;

  function renderBody() {
    if (result.isError) {
      return (
        <AnalyticsError
          error={result.error}
          retry={() => void result.refetch()}
        />
      );
    }

    if (result.isPending) return <Skeleton active />;

    if (!detail) return null;

    const { product } = detail;

    return (
      <div className="space-y-6">
        <Space wrap>
          <Tag>{product.sku ?? "SKU unavailable"}</Tag>
          <Typography.Text type="secondary">
            {params.from} to {params.to} · WAT
          </Typography.Text>
        </Space>

        <div className="grid gap-4 sm:grid-cols-2">
          <Statistic title="Ordered units" value={product.orderedUnits} />
          <Statistic title="Charged units" value={product.chargedUnits} />

          <div>
            <Typography.Text type="secondary">Net order value</Typography.Text>
            <MoneyValue naira={product.revenueNaira} usd={product.revenueUsd} />
          </div>

          <div>
            <Typography.Text type="secondary">
              Current remaining stock
            </Typography.Text>
            <div>
              <Stock row={product} />
            </div>
          </div>
        </div>

        <Typography.Paragraph type="secondary">
          Stock observed {watTimestamp(result.data!.generatedAtUtc)} WAT.
          Upstream sync time is unavailable. Orders and stock follow the
          selected warehouse scope. Stock is current, not a balance at the
          selected period end.
        </Typography.Paragraph>

        {product.productRecordCount > 1 && (
          <Alert
            type="info"
            showIcon
            title="This SKU combines multiple product records"
            description="Historical orders are combined under the Dynamics item number. Stock is unavailable when more than one current product record makes the balance ambiguous."
          />
        )}

        <Card title="Ordering trend">
          <ProductTrendChart detail={detail} />
        </Card>

        <Card title="Warehouse breakdown">
          <Typography.Paragraph type="secondary">
            One order can draw stock from several warehouses. A warehouse
            balance is unavailable when variant coverage is incomplete.
          </Typography.Paragraph>

          <Table<AnalyticsProductWarehouse>
            rowKey={(row) => row.warehouseId ?? "unspecified"}
            columns={warehouseColumns}
            dataSource={detail.warehouses}
            pagination={false}
            scroll={{ x: 760 }}
            locale={{ emptyText: "No warehouse observations in scope" }}
          />
        </Card>
      </div>
    );
  }

  return (
    <Drawer
      open
      onClose={close}
      title={detail?.product.name ?? "SKU details"}
      size={960}
      styles={{ wrapper: { maxWidth: "100vw" } }}
    >
      {renderBody()}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface Props {
  data: AnalyticsProducts;
  generatedAt: string;
  params: AnalyticsParams;
  scope: string;
  performancePage: number;
  stockPage: number;
  detailKey?: string;
  update: UpdateSearch;
}

export default function AnalyticsProductsPanel({
  data,
  generatedAt,
  params,
  scope,
  performancePage,
  stockPage,
  detailKey,
  update,
}: Props) {
  const [search, setSearch] = useState(String(params.search ?? ""));

  // Keep the search box in sync when the URL changes (e.g. back/forward).
  useEffect(() => setSearch(String(params.search ?? "")), [params.search]);

  // Page 1 of each list comes with the main report; later pages load on demand.
  const performance = useQuery({
    queryKey: [
      "analytics",
      scope,
      "products/performance",
      params,
      performancePage,
    ],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsProductRow>>>(
        "products/performance",
        { ...params, page: performancePage },
        signal,
      ),
    enabled: performancePage > 1,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const stock = useQuery({
    queryKey: ["analytics", scope, "products/stock", params, stockPage],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsProductRow>>>(
        "products/stock",
        { ...params, page: stockPage },
        signal,
      ),
    enabled: stockPage > 1,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const { summary } = data;

  const performanceData =
    performancePage === 1 ? data.performance : performance.data?.data;

  const stockData = stockPage === 1 ? data.stock : stock.data?.data;

  const stockObservedAt =
    stockPage === 1 ? generatedAt : stock.data?.generatedAtUtc;

  const ranking = rankingFor(params.productSort);

  const open = (key: string) => update({ skuDetail: key }, false);

  const changeFilters = (values: Record<string, string | undefined>) =>
    update({ ...values, skuDetail: undefined });

  const coverageNote =
    `${count(summary.stockUnavailableSkus)} SKUs have unavailable stock; ` +
    `${count(summary.missingSkuCount)} products have no SKU. ` +
    "Their eligible orders remain in sales totals. Missing stock is not " +
    "treated as zero. Products with conflicting identities need stock " +
    "reconciliation.";

  function renderPerformance() {
    if (performancePage > 1 && performance.isError) {
      return (
        <AnalyticsError
          error={performance.error}
          retry={() => void performance.refetch()}
        />
      );
    }

    if (!performanceData) return <Skeleton active />;

    const chartRows = performanceData.items.slice(0, 10).map((row) => ({
      name: skuLabel(row),
      value: ranking.value(row),
    }));

    return (
      <>
        <Typography.Paragraph type="secondary">
          First 10 SKUs on this page · current ranking
        </Typography.Paragraph>

        <ComparisonBars
          rows={chartRows}
          series={[{ key: "value", label: ranking.label }]}
          label="First 10 SKU rows on the current page, under the selected ranking"
        />

        <Table<AnalyticsProductRow>
          rowKey="key"
          columns={productColumns(open)}
          dataSource={performanceData.items}
          pagination={false}
          scroll={{ x: 1400 }}
          locale={{ emptyText: "No eligible SKU orders under these filters" }}
        />

        <CappedPagination
          noun="SKUs"
          current={performancePage}
          total={performanceData.totalCount}
          onChange={(page) => update({ productPage: String(page) }, false)}
        />
      </>
    );
  }

  function renderStock() {
    if (stockPage > 1 && stock.isError) {
      return (
        <AnalyticsError
          error={stock.error}
          retry={() => void stock.refetch()}
        />
      );
    }

    if (!stockData) return <Skeleton active />;

    const chartRows = stockData.items.slice(0, 10).map((row) => ({
      name: skuLabel(row),
      ordered: row.orderedUnits,
      stock: row.remainingStock,
    }));

    return (
      <>
        <Typography.Paragraph type="secondary">
          First 10 SKUs on this page · unavailable stock has no bar
        </Typography.Paragraph>

        <ComparisonBars
          rows={chartRows}
          series={[
            { key: "ordered", label: "Ordered units in window" },
            { key: "stock", label: "Current recorded stock" },
          ]}
          label="First 10 SKU rows on this stock page: ordered units and current recorded stock; unavailable stock omitted"
        />

        <Table<AnalyticsProductRow>
          rowKey="key"
          columns={productColumns(open)}
          dataSource={stockData.items}
          pagination={false}
          scroll={{ x: 1400 }}
          locale={{ emptyText: "No stocked SKUs match this view" }}
        />

        <CappedPagination
          noun="SKUs"
          current={stockPage}
          total={stockData.totalCount}
          onChange={(page) => update({ stockPage: String(page) }, false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Typography.Paragraph type="secondary" className="!mb-0">
        SKUs use the product’s Dynamics item number. Variants roll up to that
        SKU, and products without variants remain included. Rankings use
        eligible orders; pending, failed and cancelled orders are excluded.
        Ordered units include free units. Charged units do not mean payment
        collected or delivery completed.
      </Typography.Paragraph>

      {/* Summary */}
      <Row gutter={[16, 16]}>
        <StatCard>
          <Statistic title="SKUs ordered" value={summary.skusOrdered} />
          <Typography.Text type="secondary">
            {count(summary.orderCount)} eligible orders with items
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic title="Charged units" value={summary.chargedUnits} />
          <Typography.Text type="secondary">
            {count(summary.orderedUnits)} ordered · {count(summary.freeUnits)}{" "}
            free
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic
            title="Net order value (NGN)"
            value={summary.revenueNaira}
            precision={2}
            prefix="₦"
          />
          <Typography.Text type="secondary">
            {summary.revenueUsd == null
              ? "USD unavailable"
              : `USD ${dollars(summary.revenueUsd)}`}
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic
            title="Stocked SKUs with no orders"
            value={summary.stockedSkusWithoutOrders}
          />
          <Typography.Text type="secondary">
            {count(summary.stockedSkus)} SKUs with recorded stock
          </Typography.Text>
        </StatCard>
      </Row>

      {/* Filters */}
      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm">Find a product or SKU</label>
            <Input.Search
              aria-label="Search product or SKU"
              placeholder="Name or Dynamics item number"
              maxLength={100}
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onSearch={(value) => changeFilters({ skuSearch: value.trim() })}
            />
          </div>

          <WarehouseFilter
            scope={scope}
            value={params.warehouseId as string | undefined}
            change={(value) => changeFilters({ warehouseId: value })}
          />

          <div>
            <label className="mb-1 block text-sm">Rank bestsellers by</label>
            <Select
              aria-label="SKU ranking"
              className="w-full"
              value={params.productSort}
              onChange={(value) =>
                changeFilters({ productSort: String(value) })
              }
              options={RANK_OPTIONS}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Stock comparison</label>
            <Select
              aria-label="SKU stock view"
              className="w-full"
              value={params.stockView}
              onChange={(value) => changeFilters({ stockView: String(value) })}
              options={STOCK_VIEW_OPTIONS}
            />
          </div>
        </div>
      </Card>

      {/* Data-quality notices */}
      {(summary.stockUnavailableSkus > 0 || summary.missingSkuCount > 0) && (
        <Alert
          type="info"
          showIcon
          title="Stock and SKU coverage"
          description={coverageNote}
        />
      )}

      {summary.invalidQuantityLineCount > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`${count(summary.invalidQuantityLineCount)} order lines have inconsistent quantities`}
          description="Quantity totals include the saved values. Review these records before using the ranking for purchasing decisions."
        />
      )}

      {/* Bestsellers */}
      <Card title="Best-selling SKUs">
        <Typography.Paragraph type="secondary">
          Charged units measure commercial volume. Ordered units include
          promotional units. A single order may contain several SKUs.
        </Typography.Paragraph>

        {renderPerformance()}
      </Card>

      {/* Stock */}
      <Card title="Ordered units versus remaining stock">
        <Typography.Paragraph type="secondary">
          Stocked SKUs with the fewest ordered units appear first, then the
          largest remaining balances. This compares orders in the selected
          window with current recorded stock. It does not measure inventory age
          or sell-through. Date and partner filters affect orders; stock is the
          warehouse balance, not a partner allocation.
        </Typography.Paragraph>

        {stockObservedAt && (
          <Typography.Paragraph type="secondary">
            Stock observed {watTimestamp(stockObservedAt)} WAT. Upstream sync
            time is unavailable.
          </Typography.Paragraph>
        )}

        {renderStock()}
      </Card>

      {/* Coming soon */}
      <Card title="Run Rate versus B2B" extra={<Tag>Coming soon</Tag>}>
        <Typography.Paragraph type="secondary" className="!mb-0">
          The commercial split will be available once its business definition
          and order classification are confirmed.
        </Typography.Paragraph>
      </Card>

      <Card title="SKU profitability" extra={<Tag>Coming soon</Tag>}>
        <Typography.Paragraph type="secondary" className="!mb-0">
          Margin and inventory cost value need historical cost integration.
          Selling prices and storefront markups do not establish gross profit or
          capital tied up.
        </Typography.Paragraph>
      </Card>

      {detailKey && (
        <ProductDrawer
          skuKey={detailKey}
          params={params}
          scope={scope}
          close={() => update({ skuDetail: undefined }, false)}
        />
      )}
    </div>
  );
}
