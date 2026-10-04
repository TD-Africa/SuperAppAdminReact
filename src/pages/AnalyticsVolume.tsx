import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  Col,
  Pagination,
  Row,
  Statistic,
  Table,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import {
  dimensionColumns,
  dimensionRowKey,
} from "@/components/analytics/dimensionColumns";
import { MoneyValue } from "@/components/analytics/MoneyValue";
import { OrderValueChart } from "@/components/analytics/OrderValueChart";
import { RevenueBars } from "@/components/analytics/RevenueBars";
import { StatCard } from "@/components/analytics/StatCard";
import {
  ANALYTICS_MAX_ROWS,
  ANALYTICS_PAGE_SIZE,
  ANALYTICS_STALE_TIME,
  getAnalytics,
} from "@/lib/analytics";
import type {
  AnalyticsDimension,
  AnalyticsGrowth,
  AnalyticsOverview,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsReport,
  UpdateSearch,
} from "@/lib/analytics";
import { money, usdMoney } from "@/lib/analyticsFormat";

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const growthColumns: TableColumnsType<AnalyticsGrowth> = [
  { title: "Name", dataIndex: "name" },
  {
    title: "Current",
    dataIndex: "currentRevenue",
    align: "right",
    render: (value: number, row) => (
      <MoneyValue naira={value} usd={row.currentRevenueUsd} />
    ),
  },
  {
    title: "Previous",
    dataIndex: "previousRevenue",
    align: "right",
    render: (value: number, row) => (
      <MoneyValue naira={value} usd={row.previousRevenueUsd} />
    ),
  },
  {
    title: "Change (NGN)",
    dataIndex: "deltaPct",
    align: "right",
    render: (value: number | null) =>
      value == null ? "No previous revenue" : `${value.toFixed(1)}%`,
  },
];

// ---------------------------------------------------------------------------
// Paged sections
// ---------------------------------------------------------------------------

interface PagedSectionProps<T> {
  initial: AnalyticsPage<T>;
  params: AnalyticsParams;
  scope: string;
  page: number;
  changePage: (page: number) => void;
}

/** Page 1 comes with the overview report; later pages are fetched on demand. */
function Breakdown({
  dimension,
  initial,
  params,
  scope,
  page,
  changePage,
}: PagedSectionProps<AnalyticsDimension> & {
  dimension: "brand" | "category";
}) {
  const result = useQuery({
    queryKey: ["analytics", scope, dimension, params, page],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsDimension>>>(
        `by-${dimension}`,
        { ...params, page },
        signal,
      ),
    enabled: page > 1,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const data = page === 1 ? initial : result.data?.data;

  return (
    <Card title={`By ${dimension}`} className="h-full">
      {page > 1 && result.isError ? (
        <AnalyticsError
          error={result.error}
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {!!data?.items.length && (
            <div className="mb-6">
              <RevenueBars data={data.items.slice(0, 10)} nameKey="name" />
              <Typography.Text type="secondary">
                First 10 rows on this page · current sort order
              </Typography.Text>
            </div>
          )}

          <Table<AnalyticsDimension>
            rowKey={dimensionRowKey}
            size="small"
            columns={dimensionColumns}
            dataSource={data?.items}
            loading={page > 1 && result.isFetching}
            scroll={{ x: 700 }}
            pagination={false}
          />
        </>
      )}

      <Pagination
        className="mt-4"
        size="small"
        current={page}
        pageSize={ANALYTICS_PAGE_SIZE}
        total={Math.min(initial.totalCount, ANALYTICS_MAX_ROWS)}
        showSizeChanger={false}
        onChange={changePage}
      />
    </Card>
  );
}

/** Page 1 comes with the overview report; later pages are fetched on demand. */
function Growth({
  initial,
  params,
  scope,
  page,
  changePage,
}: PagedSectionProps<AnalyticsGrowth>) {
  const result = useQuery({
    queryKey: ["analytics", scope, "growth", params, page],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsGrowth>>>(
        "growth",
        { ...params, page },
        signal,
      ),
    enabled: page > 1,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const data = page === 1 ? initial : result.data?.data;

  return (
    <Card title={`Growth by ${params.dimension}`}>
      <Typography.Paragraph type="secondary">
        Compared with the immediately preceding window of the same length.
      </Typography.Paragraph>

      {page > 1 && result.isError ? (
        <AnalyticsError
          error={result.error}
          retry={() => void result.refetch()}
        />
      ) : (
        <Table<AnalyticsGrowth>
          rowKey={dimensionRowKey}
          columns={growthColumns}
          dataSource={data?.items}
          loading={page > 1 && result.isFetching}
          scroll={{ x: 600 }}
          pagination={false}
        />
      )}

      <Pagination
        className="mt-4"
        current={page}
        pageSize={ANALYTICS_PAGE_SIZE}
        total={Math.min(initial.totalCount, ANALYTICS_MAX_ROWS)}
        showSizeChanger={false}
        onChange={changePage}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function AnalyticsVolumePanel({
  overview,
  params,
  scope,
  page,
  update,
}: {
  overview: AnalyticsOverview;
  params: AnalyticsParams;
  scope: string;
  /** Reads a page number from the URL, e.g. page("brandPage"). */
  page: (key: string) => number;
  update: UpdateSearch;
}) {
  const { summary } = overview;

  return (
    <>
      {!!summary.missingUsdLineCount && (
        <Alert
          type="warning"
          showIcon
          title={`USD totals are unavailable: ${summary.missingUsdLineCount} eligible order lines have no positive saved dollar amount.`}
        />
      )}

      {/* Summary */}
      <Row gutter={[16, 16]}>
        <StatCard>
          <Statistic title="Orders placed" value={summary.ordersTotal} />
        </StatCard>

        <StatCard>
          <Statistic
            title="Net order value (NGN)"
            value={money(summary.revenueNairaTotal)}
          />
          <Typography.Text type="secondary">
            USD {usdMoney(summary.revenueUsdTotal)}
          </Typography.Text>
          <div className="mt-1 text-xs text-muted-foreground">
            Includes eligible unpaid orders
          </div>
        </StatCard>

        <StatCard>
          <Statistic
            title="Average eligible order (NGN)"
            value={money(summary.averageOrderValueNaira)}
          />
          <Typography.Text type="secondary">
            USD {usdMoney(summary.averageOrderValueUsd)}
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic
            title="Distinct partners"
            value={summary.distinctPartnersInWindow}
          />
        </StatCard>
      </Row>

      <Card title="Orders and net order value">
        <OrderValueChart points={overview.timeseries} />
      </Card>

      {/* Brand & category breakdowns */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Breakdown
            dimension="brand"
            initial={overview.brands}
            params={params}
            scope={scope}
            page={page("brandPage")}
            changePage={(value) => update({ brandPage: String(value) }, false)}
          />
        </Col>

        <Col span={24}>
          <Breakdown
            dimension="category"
            initial={overview.categories}
            params={params}
            scope={scope}
            page={page("categoryPage")}
            changePage={(value) =>
              update({ categoryPage: String(value) }, false)
            }
          />
        </Col>
      </Row>

      <Growth
        initial={overview.growth}
        params={params}
        scope={scope}
        page={page("growthPage")}
        changePage={(value) => update({ growthPage: String(value) }, false)}
      />
    </>
  );
}
