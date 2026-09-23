import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import { CappedPagination } from "@/components/analytics/CappedPagination";
import { ComparisonBars } from "@/components/analytics/ComparisonBars";
import { MoneyValue } from "@/components/analytics/MoneyValue";
import { ANALYTICS_STALE_TIME, getAnalytics } from "@/lib/analytics";
import type {
  AnalyticsCredit,
  AnalyticsCreditMix,
  AnalyticsCreditPartner,
  AnalyticsDebt,
  AnalyticsDebtBucket,
  AnalyticsDebtOrder,
  AnalyticsDebtPartner,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsReport,
  UpdateSearch,
} from "@/lib/analytics";
import { count, money, watTimestamp } from "@/lib/analyticsFormat";

// ---------------------------------------------------------------------------
// Formatters & constants
// ---------------------------------------------------------------------------

const hours = (value: number | null) =>
  value == null
    ? "Unavailable"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} h`;

function dueStatus(daysUntilDue: number | null) {
  if (daysUntilDue == null) return "Due date unavailable / invalid";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
  if (daysUntilDue === 0) return "Due today";
  return `Due in ${daysUntilDue} days`;
}

const BALANCE_LABELS: Record<string, string> = {
  currency_allocation_unavailable: "Currency allocation unavailable",
  missing_lines: "Order lines unavailable",
  invalid_values: "Saved values need review",
  local_unreconciled: "Local, unreconciled",
};

const LINK_BUTTON_CLASS = "!h-auto !whitespace-normal !p-0 !text-left";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/** A labelled headline number. `boxed` renders a plain bordered box instead of a Card. */
function Tile({
  label,
  value,
  boxed = false,
}: {
  label: string;
  value: string;
  boxed?: boolean;
}) {
  const content = (
    <>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-2xl font-semibold tracking-tight">
        {value}
      </div>
    </>
  );

  if (boxed) {
    return (
      <div className="min-w-0 rounded border border-solid border-gray-200 p-4">
        {content}
      </div>
    );
  }

  return <Card className="min-w-0">{content}</Card>;
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const mixColumns: TableColumnsType<AnalyticsCreditMix> = [
  { title: "Payment method", dataIndex: "name" },
  {
    title: "Orders placed",
    dataIndex: "orders",
    align: "right",
    render: count,
  },
  {
    title: "Eligible orders",
    dataIndex: "eligibleOrders",
    align: "right",
    render: count,
  },
  {
    title: "Net order value",
    key: "value",
    align: "right",
    render: (_, row) => (
      <MoneyValue naira={row.revenueNaira} usd={row.revenueUsd} />
    ),
  },
  {
    title: "POA orders (subset)",
    dataIndex: "poaOrders",
    align: "right",
    render: count,
  },
];

const timingColumns: TableColumnsType<AnalyticsCreditMix> = [
  { title: "Payment method", dataIndex: "name" },
  {
    title: "Timing available",
    dataIndex: "ordersWithTiming",
    align: "right",
    render: count,
  },
  {
    title: "Paid evidence, no valid timing",
    dataIndex: "paidWithoutTiming",
    align: "right",
    render: count,
  },
  {
    title: "No recorded payment evidence",
    dataIndex: "withoutPaymentEvidence",
    align: "right",
    render: count,
  },
  {
    title: "Median delay",
    dataIndex: "medianFirstPaymentHours",
    align: "right",
    render: hours,
  },
  {
    title: "Average delay",
    dataIndex: "averageFirstPaymentHours",
    align: "right",
    render: hours,
  },
  {
    title: "90th percentile",
    dataIndex: "p90FirstPaymentHours",
    align: "right",
    render: hours,
  },
];

function PartnerTerms({ row }: { row: AnalyticsCreditPartner }) {
  const hasDays = row.currentCreditDays != null;

  return (
    <div>
      {hasDays ? `${row.currentCreditDays} days` : "Unavailable"}

      {!hasDays && row.currentTerms && (
        <div className="text-xs text-muted-foreground">
          Recorded: {row.currentTerms}
        </div>
      )}

      {row.accountsWithDifferentTerms > 0 && (
        <div className="text-xs text-muted-foreground">
          {count(row.accountsWithDifferentTerms)} ordering accounts have
          different terms
        </div>
      )}
    </div>
  );
}

const creditPartnerColumns: TableColumnsType<AnalyticsCreditPartner> = [
  { title: "Parent partner", dataIndex: "companyName" },
  {
    title: "Current parent terms",
    key: "terms",
    render: (_, row) => <PartnerTerms row={row} />,
  },
  {
    title: "Orders placed",
    dataIndex: "orders",
    align: "right",
    render: count,
  },
  {
    title: "Credit orders",
    dataIndex: "creditOrders",
    align: "right",
    render: count,
  },
  {
    title: "Net order value",
    key: "value",
    align: "right",
    render: (_, row) => (
      <MoneyValue naira={row.revenueNaira} usd={row.revenueUsd} />
    ),
  },
  {
    title: "Timing coverage",
    key: "timing",
    render: (_, row) =>
      `${row.ordersWithTiming}/${row.eligibleOrders} eligible orders`,
  },
  {
    title: "Median first-payment delay",
    dataIndex: "medianFirstPaymentHours",
    align: "right",
    render: hours,
  },
];

function bucketColumns(
  selectBucket: (key: string) => void,
): TableColumnsType<AnalyticsDebtBucket> {
  return [
    {
      title: "Recorded due-date bucket",
      dataIndex: "name",
      render: (name, row) => (
        <Button
          type="link"
          className={LINK_BUTTON_CLASS}
          onClick={() => selectBucket(row.key)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: "Orders",
      dataIndex: "orders",
      align: "right",
      render: count,
    },
    {
      title: "Known local balance (NGN)",
      dataIndex: "knownBalanceNaira",
      align: "right",
      render: money,
    },
    {
      title: "Balance unavailable",
      dataIndex: "balanceUnavailableOrders",
      align: "right",
      render: count,
    },
  ];
}

function debtPartnerColumns(
  openPartner: (partnerId: string) => void,
): TableColumnsType<AnalyticsDebtPartner> {
  return [
    {
      title: "Parent partner",
      dataIndex: "companyName",
      render: (name, row) => (
        <Button
          type="link"
          className={LINK_BUTTON_CLASS}
          onClick={() => openPartner(row.partnerId)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: "Open orders",
      dataIndex: "orders",
      align: "right",
      render: count,
    },
    {
      title: "Known local balance (NGN)",
      dataIndex: "knownBalanceNaira",
      align: "right",
      render: money,
    },
    {
      title: "Overdue orders",
      dataIndex: "overdueOrders",
      align: "right",
      render: count,
    },
    {
      title: "Known overdue balance (NGN)",
      dataIndex: "knownOverdueNaira",
      align: "right",
      render: money,
    },
    {
      title: "Due date unavailable / invalid",
      dataIndex: "missingDueDateOrders",
      align: "right",
      render: count,
    },
    {
      title: "Balance unavailable",
      dataIndex: "balanceUnavailableOrders",
      align: "right",
      render: count,
    },
  ];
}

const orderColumns: TableColumnsType<AnalyticsDebtOrder> = [
  { title: "Order", dataIndex: "orderReference" },
  { title: "Placed (WAT)", dataIndex: "placedAtUtc", render: watTimestamp },
  {
    title: "Recorded due date (WAT)",
    dataIndex: "recordedDueDateUtc",
    render: (value) => (value ? watTimestamp(value) : "Unavailable"),
  },
  {
    title: "Due status",
    key: "due",
    render: (_, row) => dueStatus(row.daysUntilDue),
  },
  {
    title: "Local balance (NGN)",
    key: "balance",
    align: "right",
    render: (_, row) => (
      <div>
        {row.localBalanceNaira == null
          ? "Unavailable"
          : money(row.localBalanceNaira)}

        <div className="text-xs text-muted-foreground">
          {BALANCE_LABELS[row.balanceStatus]}
        </div>
      </div>
    ),
  },
  {
    title: "Recorded paid (NGN)",
    dataIndex: "recordedPaidNaira",
    align: "right",
    render: money,
  },
];

// ---------------------------------------------------------------------------
// Debt orders drawer
// ---------------------------------------------------------------------------

function DebtOrders({
  params,
  scope,
  partner,
  page,
  update,
}: {
  params: AnalyticsParams;
  scope: string;
  partner: string;
  page: number;
  update: UpdateSearch;
}) {
  const result = useQuery({
    queryKey: [
      "analytics",
      scope,
      "credit-payments/debt/orders",
      params,
      partner,
      page,
    ],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsDebtOrder>>>(
        "credit-payments/debt/orders",
        { ...params, partnerId: partner, page },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const close = () =>
    update({ debtPartner: undefined, debtOrderPage: undefined }, false);

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

    const { items, totalCount } = result.data.data;

    return (
      <>
        <Typography.Paragraph type="secondary">
          Observed {watTimestamp(result.data.generatedAtUtc)} WAT ·{" "}
          {items[0]?.companyName}
        </Typography.Paragraph>

        <Table
          rowKey="orderId"
          columns={orderColumns}
          dataSource={items}
          pagination={false}
          scroll={{ x: 1200 }}
        />

        <CappedPagination
          noun="records"
          current={page}
          total={totalCount}
          onChange={(value) => update({ debtOrderPage: String(value) }, false)}
        />
      </>
    );
  }

  return (
    <Drawer
      open
      size={1100}
      styles={{ wrapper: { maxWidth: "100vw" } }}
      title="Current recorded debt · orders"
      onClose={close}
    >
      <Typography.Paragraph type="secondary">
        Whole-order local balances, before D365 reconciliation. Recorded due
        dates determine the WAT day buckets. Unknown balances remain
        unavailable.
      </Typography.Paragraph>

      {renderBody()}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface Props {
  data: AnalyticsCredit;
  params: AnalyticsParams;
  scope: string;
  partnerPage: number;
  debtPage: number;
  debtBucket: string;
  debtPartner?: string;
  debtOrderPage: number;
  update: UpdateSearch;
}

export default function AnalyticsCreditPanel({
  data,
  params,
  scope,
  partnerPage,
  debtPage,
  debtBucket,
  debtPartner,
  debtOrderPage,
  update,
}: Props) {
  // Current debt deliberately omits the order-period filters and presentation controls.
  const debtParams: AnalyticsParams = {
    brandId: params.brandId,
    categoryId: params.categoryId,
    partnerId: params.partnerId,
    debtBucket,
  };

  const debt = useQuery({
    queryKey: [
      "analytics",
      scope,
      "credit-payments/debt",
      debtParams,
      debtPage,
    ],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsDebt>>(
        "credit-payments/debt",
        { ...debtParams, page: debtPage },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  // Page 1 of partners comes with the main report; later pages load on demand.
  const partners = useQuery({
    queryKey: [
      "analytics",
      scope,
      "credit-payments/partners",
      params,
      partnerPage,
    ],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsCreditPartner>>>(
        "credit-payments/partners",
        { ...params, page: partnerPage },
        signal,
      ),
    enabled: partnerPage > 1,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const partnerRows = partnerPage === 1 ? data.partners : partners.data?.data;
  const credit = data.paymentMix.find((row) => row.key === "credit");

  const selectBucket = (key: string) =>
    update({ debtBucket: key, debtPartner: undefined });

  const openDebtPartner = (partnerId: string) =>
    update({ debtPartner: partnerId, debtOrderPage: undefined }, false);

  const summaryTiles = [
    {
      label: "Orders placed",
      value: count(data.summary.ordersTotal),
    },
    {
      label: "Credit orders",
      value: count(credit?.orders ?? 0),
    },
    {
      label: "Credit orders with down payment",
      value: count(credit?.splitPaymentOrders ?? 0),
    },
    {
      label: "Eligible net order value",
      value: money(data.summary.revenueNairaTotal),
    },
  ];

  const paymentMixRows = data.paymentMix.map((row) => ({
    name: row.name,
    orders: row.orders,
  }));

  function renderPartners() {
    if (partnerPage > 1 && partners.isError) {
      return (
        <AnalyticsError
          error={partners.error}
          retry={() => void partners.refetch()}
        />
      );
    }

    if (!partnerRows) return <Skeleton active />;

    return (
      <>
        <Table
          rowKey="partnerId"
          columns={creditPartnerColumns}
          dataSource={partnerRows.items}
          pagination={false}
          scroll={{ x: 1150 }}
        />

        <CappedPagination
          noun="records"
          current={partnerPage}
          total={partnerRows.totalCount}
          onChange={(value) =>
            update({ creditPartnerPage: String(value) }, false)
          }
        />
      </>
    );
  }

  function renderDebt() {
    if (debt.isError) {
      return (
        <AnalyticsError error={debt.error} retry={() => void debt.refetch()} />
      );
    }

    if (debt.isPending) return <Skeleton active />;

    const report = debt.data.data;

    const debtTiles = [
      {
        label: "Known local balance (NGN)",
        value: money(report.summary.knownBalanceNaira),
      },
      {
        label: "Overdue orders",
        value: count(report.summary.overdueOrders),
      },
      {
        label: "Due date unavailable / invalid",
        value: count(report.summary.missingDueDateOrders),
      },
      {
        label: "Balance unavailable",
        value: count(report.summary.balanceUnavailableOrders),
      },
    ];

    const bucketOptions = [
      { value: "all", label: "All recorded due dates" },
      ...report.buckets.map((row) => ({ value: row.key, label: row.name })),
    ];

    const bucketRows = report.buckets.map((row) => ({
      name: row.name,
      balance: row.knownBalanceNaira,
    }));

    return (
      <div className="space-y-5">
        <Alert
          type="info"
          showIcon
          title="Local balances · D365 reconciliation pending"
          description="Saved NGN order value, after order discounts, minus recorded payments. Balances involving USD-posted lines, missing lines or invalid values are unavailable. Existing settlement flags may omit payments recorded elsewhere; these are not confirmed ledger receivables."
        />

        <Typography.Paragraph type="secondary">
          Observed {watTimestamp(report.asOfUtc)} WAT. Due dates use calendar
          days in WAT; today's obligations are separate from overdue orders.
          Summary buckets always cover the full current scope.
        </Typography.Paragraph>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {debtTiles.map((item) => (
            <Tile
              key={item.label}
              boxed
              label={item.label}
              value={item.value}
            />
          ))}
        </div>

        <ComparisonBars
          rows={bucketRows}
          series={[{ key: "balance", label: "Known local balance (NGN)" }]}
          label="Current known local debt balance by due-date bucket; unavailable balances excluded"
          format={money}
        />

        <Table
          rowKey="key"
          columns={bucketColumns(selectBucket)}
          dataSource={report.buckets}
          pagination={false}
          scroll={{ x: 750 }}
        />

        <div>
          <label className="mb-2 block text-sm">
            Filter partner debt by due date
          </label>
          <Select
            aria-label="Debt bucket"
            className="w-full sm:w-80"
            value={debtBucket}
            options={bucketOptions}
            onChange={selectBucket}
          />
        </div>

        <Table
          rowKey="partnerId"
          columns={debtPartnerColumns(openDebtPartner)}
          dataSource={report.partners.items}
          pagination={false}
          scroll={{ x: 1150 }}
          locale={{
            emptyText: (
              <Empty description="No open credit orders in this scope" />
            ),
          }}
        />

        <CappedPagination
          noun="records"
          current={debtPage}
          total={report.partners.totalCount}
          onChange={(value) => update({ debtPage: String(value) }, false)}
        />

        <Typography.Paragraph type="secondary" className="!mb-0">
          {count(report.summary.excludedNonPositiveBalanceOrders)} candidate
          orders have no positive local balance and are excluded from these
          buckets. Unavailable balances remain counted separately. Click a
          partner to inspect orders.
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    <div className="space-y-6 [&_.ant-card-head-title]:whitespace-normal [&_.ant-card-head-title]:py-3">
      <Typography.Paragraph type="secondary">
        Payment activity covers the selected order dates. Timing uses the first
        positive payment recorded by {watTimestamp(data.asOfUtc)} WAT, including
        partial payments after the order period. It does not measure full
        settlement or bank receipt time.
      </Typography.Paragraph>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryTiles.map((item) => (
          <Tile key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      {/* Payment mix */}
      <Card title="Credit versus instant payment">
        <Typography.Paragraph type="secondary">
          Payment method is the recorded checkout selection. Credit orders can
          include an upfront payment. POA is an overlapping flag, not another
          payment-method group. Placed counts include pending/cancelled orders;
          values follow revenue eligibility.
        </Typography.Paragraph>

        <ComparisonBars
          rows={paymentMixRows}
          series={[{ key: "orders", label: "Orders placed" }]}
          label="Orders by recorded payment method; POA flags are not added as a separate group"
        />

        <Table
          rowKey="key"
          columns={mixColumns}
          dataSource={data.paymentMix}
          pagination={false}
          scroll={{ x: 850 }}
        />

        <Typography.Paragraph type="secondary" className="!mb-0 !mt-4">
          Requested down payments on credit orders:{" "}
          {money(credit?.requestedDownPaymentNaira ?? 0)}.{" "}
          {count(credit?.settledDownPaymentOrders ?? 0)} carry a
          settled-down-payment flag. Requested amounts are not cash collected.
        </Typography.Paragraph>
      </Card>

      {/* Payment timing */}
      <Card title="Time to first recorded payment">
        <Typography.Paragraph type="secondary">
          Coverage is based on revenue-eligible orders. Zero-value markers and
          future transactions are excluded. Payment evidence without a valid
          timestamp remains visible; it is not treated as an instant payment.
        </Typography.Paragraph>

        <Table
          rowKey="key"
          columns={timingColumns}
          dataSource={data.paymentMix}
          pagination={false}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* Partner terms */}
      <Card title="Partner terms and payment activity">
        <Typography.Paragraph type="secondary">
          Current parent-account terms, not the historical terms agreed on these
          orders. Sub-account orders roll up to the parent; different recorded
          account terms are flagged. Comparing order frequency and first-payment
          timing here does not establish creditworthiness.
        </Typography.Paragraph>

        {renderPartners()}
      </Card>

      {/* Current debt */}
      <Card title="Current recorded debt">
        <Typography.Paragraph type="secondary">
          Current unpaid/partially paid credit orders, including orders placed
          before the selected date range. Brand/category filters select whole
          orders; balances are not apportioned to individual products.
          Parent-partner filtering still applies.
        </Typography.Paragraph>

        {renderDebt()}
      </Card>

      <Card
        title="Payment performance and credit assessment"
        extra={<Tag>Coming soon</Tag>}
      >
        <Typography.Paragraph type="secondary" className="!mb-0">
          Full-settlement timing, historical on-time-payment rates, reconciled
          invoice balances and credit utilisation need validated historical
          terms and payment evidence. This report does not score partners or
          recommend credit-limit changes.
        </Typography.Paragraph>
      </Card>

      {debtPartner && (
        <DebtOrders
          params={debtParams}
          scope={scope}
          partner={debtPartner}
          page={debtOrderPage}
          update={update}
        />
      )}
    </div>
  );
}
