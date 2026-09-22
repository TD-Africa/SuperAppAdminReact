import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import { CappedPagination } from "@/components/analytics/CappedPagination";
import { StatCard } from "@/components/analytics/StatCard";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  Empty,
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
import { ANALYTICS_STALE_TIME, getAnalytics } from "@/lib/analytics";
import type {
  AnalyticsBehaviour,
  AnalyticsCancellation,
  AnalyticsCart,
  AnalyticsCartSnapshot,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsPaymentTiming,
  AnalyticsReport,
  UpdateSearch,
} from "@/lib/analytics";
import { percent, watTimestamp } from "@/lib/analyticsFormat";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function duration(hours: number | null) {
  if (hours == null) return "Unavailable";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

// ---------------------------------------------------------------------------
// Options & columns
// ---------------------------------------------------------------------------

const DIMENSION_OPTIONS = [
  { value: "product", label: "By product" },
  { value: "partner", label: "By partner" },
];

const cancellationColumns = (
  dimension: "product" | "partner",
): TableColumnsType<AnalyticsCancellation> => [
  { title: dimension === "product" ? "Product" : "Partner", dataIndex: "name" },
  { title: "Orders placed", dataIndex: "ordersPlaced", align: "right" },
  { title: "Cancelled", dataIndex: "cancelledOrders", align: "right" },
  {
    title: "Cancellation rate",
    dataIndex: "cancellationRate",
    align: "right",
    render: percent,
  },
];

const paymentTimingColumns: TableColumnsType<AnalyticsPaymentTiming> = [
  { title: "Payment method", dataIndex: "paymentMethod" },
  { title: "Eligible orders", dataIndex: "eligibleOrders", align: "right" },
  { title: "Measured", dataIndex: "ordersWithRecordedPayment", align: "right" },
  {
    title: "Paid, timing unavailable",
    dataIndex: "paidOrdersWithoutTiming",
    align: "right",
  },
  {
    title: "No payment recorded",
    dataIndex: "ordersWithoutRecordedPayment",
    align: "right",
  },
  { title: "Average", dataIndex: "averageHours", render: duration },
  { title: "Median", dataIndex: "medianHours", render: duration },
  { title: "90th percentile", dataIndex: "p90Hours", render: duration },
];

const cartColumns: TableColumnsType<AnalyticsCart> = [
  { title: "Partner", dataIndex: "companyName" },
  {
    title: "Latest item addition (WAT)",
    dataIndex: "lastItemAddedAt",
    render: watTimestamp,
  },
  {
    title: "Days since addition",
    dataIndex: "daysSinceLastAddition",
    align: "right",
    render: (value: number) => value.toFixed(1),
  },
  { title: "Matching products", dataIndex: "productCount", align: "right" },
  { title: "Matching units", dataIndex: "units", align: "right" },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface Props {
  data: AnalyticsBehaviour;
  params: AnalyticsParams;
  scope: string;
  dimension: "product" | "partner";
  cancellationPage: number;
  cartPage: number;
  update: UpdateSearch;
}

export default function AnalyticsBehaviourPanel({
  data,
  params,
  scope,
  dimension,
  cancellationPage,
  cartPage,
  update,
}: Props) {
  const cancellations = useQuery({
    queryKey: [
      "analytics",
      scope,
      "cancellations",
      params,
      dimension,
      cancellationPage,
    ],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsCancellation>>>(
        `cancellations/${dimension}`,
        { ...params, page: cancellationPage },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const carts = useQuery({
    queryKey: ["analytics", scope, "cart-snapshot", params, cartPage],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsCartSnapshot>>(
        "cart-snapshot",
        { ...params, page: cartPage },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const summary = data.summary;
  const cartReport = carts.data?.data;

  const measuredPayments = data.paymentTiming.reduce(
    (total, row) => total + row.ordersWithRecordedPayment,
    0,
  );
  const missingTiming = data.paymentTiming.reduce(
    (total, row) => total + row.paidOrdersWithoutTiming,
    0,
  );

  return (
    <div className="space-y-6">
      <Typography.Paragraph type="secondary" className="!mb-0">
        Order dates select when orders were placed. Outcomes show their current
        status; the chart does not show when a cancellation or completion
        happened. Results may be cached for five minutes.
      </Typography.Paragraph>

      {/* Summary */}
      <Row gutter={[16, 16]}>
        <StatCard>
          <Statistic title="Orders placed" value={summary.ordersPlaced} />
        </StatCard>

        <StatCard>
          <Statistic title="Completed status" value={summary.completedOrders} />
          <Typography.Text type="secondary">
            {percent(summary.completionRate)} of orders placed
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic title="Cancelled orders" value={summary.cancelledOrders} />
        </StatCard>

        <StatCard>
          <Statistic
            title="Cancellation rate"
            value={percent(summary.cancellationRate)}
          />
        </StatCard>
      </Row>

      <Typography.Paragraph type="secondary">
        {summary.otherOrders.toLocaleString()} orders have another status,
        including pending, unpaid, in progress or failed. Completed status can
        reflect invoicing or settlement and does not confirm physical delivery.
      </Typography.Paragraph>

      {/* Outcomes chart */}
      <Card title="Order outcomes by placement period">
        {summary.ordersPlaced ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer
                data={data.timeseries.map((point) => ({
                  ...point,
                  otherOrders:
                    point.ordersPlaced -
                    point.completedOrders -
                    point.cancelledOrders,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodStart" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  stackId="outcomes"
                  dataKey="otherOrders"
                  name="Other current statuses"
                  fill="#64748b"
                  isAnimationActive={false}
                />
                <Bar
                  stackId="outcomes"
                  dataKey="completedOrders"
                  name="Completed status"
                  fill="#15803d"
                  isAnimationActive={false}
                />
                <Bar
                  stackId="outcomes"
                  dataKey="cancelledOrders"
                  name="Cancelled"
                  fill="#800020"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty description="No orders placed in this window" />
        )}
      </Card>

      {/* Cancellations */}
      <Card
        title="Cancellation patterns"
        extra={
          <Select
            aria-label="Cancellation breakdown"
            value={dimension}
            options={DIMENSION_OPTIONS}
            onChange={(value) =>
              update(
                { cancellationDimension: value, cancellationPage: undefined },
                false,
              )
            }
          />
        }
      >
        <Typography.Paragraph type="secondary">
          Groups with cancellations, ordered by cancelled-order count. Each rate
          compares cancelled orders with all orders in that group under the
          selected filters. One order can contain several products.
        </Typography.Paragraph>

        {cancellations.isError ? (
          <AnalyticsError
            error={cancellations.error}
            retry={() => void cancellations.refetch()}
          />
        ) : cancellations.isPending ? (
          <Skeleton active />
        ) : (
          <>
            <Table<AnalyticsCancellation>
              rowKey="id"
              columns={cancellationColumns(dimension)}
              dataSource={cancellations.data.data.items}
              pagination={false}
              scroll={{ x: 650 }}
              locale={{ emptyText: "No cancellations in this window" }}
            />

            <CappedPagination
              noun="results"
              current={cancellationPage}
              total={cancellations.data.data.totalCount}
              onChange={(value) =>
                update({ cancellationPage: String(value) }, false)
              }
            />
          </>
        )}
      </Card>

      {/* Payment timing */}
      <Card title="Time to first recorded payment">
        <Typography.Paragraph type="secondary">
          Time from placement to the first positive payment recorded in
          SuperApp, including payments recorded after the selected order window.
          Partial payments count as first payments; this does not measure full
          settlement. Pending, failed and cancelled orders are excluded. Payment
          recording can lag receipt.
        </Typography.Paragraph>

        <Space wrap className="mb-4">
          <Tag>
            {measuredPayments.toLocaleString()} orders with measured timing
          </Tag>
          {missingTiming > 0 && (
            <Tag color="gold">
              {missingTiming.toLocaleString()} paid orders without usable timing
            </Tag>
          )}
        </Space>

        <Table<AnalyticsPaymentTiming>
          rowKey="paymentMethod"
          columns={paymentTimingColumns}
          dataSource={data.paymentTiming}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: "No eligible orders in this window" }}
        />
      </Card>

      {/* Fulfilment (placeholder) */}
      <Card title="Fulfilment efficiency" extra={<Tag>Coming soon</Tag>}>
        <Typography.Paragraph className="!mb-0" type="secondary">
          Time from order placement to fulfilment will be available when
          warehouse and delivery milestones are captured in SuperApp.
        </Typography.Paragraph>
      </Card>

      {/* Cart abandonment */}
      <Card title="Potential cart abandonment — current snapshot">
        <Typography.Paragraph type="secondary">
          Open carts with items whose latest item addition falls within the
          selected dates. Potential abandonment means no item was added in at
          least 24 hours. Quantity edits and removals are not fully tracked, so
          this is an estimate. Brand/category filters select cart contents; age
          considers all items in the cart.
        </Typography.Paragraph>

        <Typography.Paragraph type="secondary">
          Checkout removes cart items. Historical abandoned-cart counts and
          cart-to-order conversion rates are unavailable from this snapshot.
        </Typography.Paragraph>

        {carts.isError ? (
          <AnalyticsError
            error={carts.error}
            retry={() => void carts.refetch()}
          />
        ) : carts.isPending ? (
          <Skeleton active />
        ) : (
          cartReport && (
            <>
              <Row gutter={[16, 16]} className="mb-4">
                <Col xs={24} md={8}>
                  <Statistic
                    title="Open carts in scope"
                    value={cartReport.openCarts}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Potentially abandoned"
                    value={cartReport.potentiallyAbandonedCarts}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Affected partners"
                    value={cartReport.affectedPartners}
                  />
                </Col>
              </Row>

              <Typography.Paragraph type="secondary">
                Snapshot generated {watTimestamp(carts.data.generatedAtUtc)}{" "}
                WAT. Showing potentially abandoned carts, oldest first.
              </Typography.Paragraph>

              <Table<AnalyticsCart>
                rowKey="cartId"
                columns={cartColumns}
                dataSource={cartReport.carts.items}
                pagination={false}
                scroll={{ x: 750 }}
                locale={{
                  emptyText: "No potentially abandoned carts in this scope",
                }}
              />

              <CappedPagination
                noun="results"
                current={cartPage}
                total={cartReport.carts.totalCount}
                onChange={(value) => update({ cartPage: String(value) }, false)}
              />
            </>
          )
        )}
      </Card>
    </div>
  );
}
