import { useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Card,
  Empty,
  Progress,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CalendarOutlined,
  FundOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { ComparisonBars } from "@/components/analytics/ComparisonBars";
import type {
  AnalyticsExecutive,
  AnalyticsExecutivePartner,
} from "@/lib/analytics";
import { dollars, money, watTimestamp } from "@/lib/analyticsFormat";

type Comparison = "month" | "today";
type PartnerView = "chart" | "table";
type OpenReport = (
  tab: string,
  from: string,
  to: string,
  partnerId?: string,
) => void;

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const compactNairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 2,
});

const compactMoney = (value: number) => compactNairaFormatter.format(value);
const count = (value: number) => value.toLocaleString("en-NG");

const dollarValue = (value: number | null) =>
  value == null ? "USD unavailable: incomplete saved amounts" : dollars(value);

/** YYYY-MM-DD in WAT — the format the report filters expect. */
const watDate = (value: string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

/** DD/MM in WAT, for compact chart labels. */
const watShortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "2-digit",
  });

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const COMPARISON_OPTIONS = [
  { label: "Month to date", value: "month" },
  { label: "Today", value: "today" },
];

const PARTNER_VIEW_OPTIONS = [
  { label: "Chart", value: "chart" },
  { label: "Records", value: "table" },
];

// ---------------------------------------------------------------------------
// Change helpers
// ---------------------------------------------------------------------------

function trendOf(difference: number) {
  if (difference > 0) return { color: "green", arrow: "↑" };
  if (difference < 0) return { color: "red", arrow: "↓" };
  return { color: undefined, arrow: "—" };
}

/** Percentage change tag, e.g. "↑ 12.5%". */
function Change({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <Tag>{current === 0 ? "No change" : "No prior-period activity"}</Tag>
    );
  }

  const difference = ((current - previous) / Math.abs(previous)) * 100;
  const trend = trendOf(difference);

  return (
    <Tag color={trend.color}>
      {trend.arrow} {Math.abs(difference).toFixed(1)}%
    </Tag>
  );
}

/** One-sentence summary of a change, for the "What changed" card. */
function changeDescription(
  current: number,
  previous: number,
  format: (value: number) => string,
) {
  if (current === previous) {
    return "Unchanged from the comparison window.";
  }

  if (previous === 0) {
    return `${format(current)} in the current window; no prior-period activity.`;
  }

  const gap = format(Math.abs(current - previous));
  const direction = current > previous ? "higher" : "lower";

  return `${gap} ${direction} than the comparison window.`;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function TextLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="link"
      className="!h-auto !whitespace-normal !p-0 !text-left"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** NGN amount with its USD equivalent underneath. */
function MoneyWithUsd({
  naira,
  usd,
  className,
  suffix,
}: {
  naira: number;
  usd: number | null;
  className?: string;
  suffix?: string;
}) {
  return (
    <div className={className}>
      {money(naira)}
      {suffix}
      <div className="text-xs text-muted-foreground">{dollarValue(usd)}</div>
    </div>
  );
}

function Metric({
  title,
  value,
  icon,
  children,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="mt-2 break-words text-2xl font-semibold tracking-tight">
            {value}
          </div>
        </div>

        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-lg text-primary"
          aria-hidden
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  );
}

function ChangeLine({
  current,
  previous,
  label,
}: {
  current: number;
  previous: number;
  label: string;
}) {
  return (
    <div>
      <Change current={current} previous={previous} />{" "}
      <Typography.Text type="secondary">{label}</Typography.Text>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------

function revenueRows(data: AnalyticsExecutive, comparison: Comparison) {
  if (comparison === "month") {
    return [
      {
        name: "Prior equivalent",
        value: data.previousMonthToDate.revenueNaira,
      },
      {
        name: "Month to date",
        value: data.monthToDate.revenueNaira,
      },
    ];
  }

  return [
    {
      name: `2 weeks ago · ${watShortDate(data.twoWeeksAgoDay.fromUtc)}`,
      value: data.twoWeeksAgoDay.revenueNaira,
    },
    {
      name: `1 week ago · ${watShortDate(data.lastWeekDay.fromUtc)}`,
      value: data.lastWeekDay.revenueNaira,
    },
    {
      name: `Today · ${watShortDate(data.today.fromUtc)}`,
      value: data.today.revenueNaira,
    },
  ];
}

function comparisonDescription(
  data: AnalyticsExecutive,
  comparison: Comparison,
) {
  if (comparison === "month") {
    return (
      `Current month: ${watTimestamp(data.monthToDate.fromUtc)} to ` +
      `${watTimestamp(data.asOfUtc)} WAT. ` +
      `Prior equivalent: ${watTimestamp(data.previousMonthToDate.fromUtc)} to ` +
      `${watTimestamp(data.previousMonthToDate.toUtc)} WAT.`
    );
  }

  return (
    `Today (${watDate(data.today.fromUtc)}) compared with the same weekday ` +
    `1 week ago (${watDate(data.lastWeekDay.fromUtc)}) and ` +
    `2 weeks ago (${watDate(data.twoWeeksAgoDay.fromUtc)}), ` +
    "each from midnight to the same WAT time of day."
  );
}

function comparisonChartLabel(comparison: Comparison) {
  return comparison === "month"
    ? "Month-to-date net order value against the prior month equivalent"
    : "Today's net order value against the same weekday one and two weeks ago";
}

function topPartnerColumns(
  openPartner: (partnerId: string) => void,
): TableColumnsType<AnalyticsExecutivePartner> {
  return [
    {
      title: "Partner",
      dataIndex: "companyName",
      render: (name, row) => (
        <TextLink onClick={() => openPartner(row.partnerId)}>{name}</TextLink>
      ),
    },
    {
      title: "MTD net order value",
      dataIndex: "revenueNaira",
      align: "right",
      render: (value, row) => (
        <MoneyWithUsd naira={value} usd={row.revenueUsd} />
      ),
    },
    {
      title: "Prior month equivalent",
      dataIndex: "previousRevenueNaira",
      align: "right",
      render: (value, row) => (
        <MoneyWithUsd naira={value} usd={row.previousRevenueUsd} />
      ),
    },
    {
      title: "Change",
      key: "change",
      render: (_, row) => (
        <Change
          current={row.revenueNaira}
          previous={row.previousRevenueNaira}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function AnalyticsExecutivePanel({
  data,
  navigate,
}: {
  data: AnalyticsExecutive;
  navigate: (values: Record<string, string | undefined>) => void;
}) {
  const [comparison, setComparison] = useState<Comparison>("month");
  const [partnerView, setPartnerView] = useState<PartnerView>("chart");

  /** Jumps to a detailed report for the given WAT date range, clearing other filters. */
  const openReport: OpenReport = (tab, from, to, partnerId) =>
    navigate({
      tab,
      from: watDate(from),
      to: watDate(to),
      bucket: "Day",
      partnerId,
      brandId: undefined,
      categoryId: undefined,
      detail: partnerId,
      detailPage: undefined,
      skuDetail: undefined,
      view: "partners",
      stage: undefined,
    });

  const openMonthToDate = (tab: string) =>
    openReport(tab, data.monthToDate.fromUtc, data.asOfUtc);

  const openPartner = (partnerId: string) =>
    openReport("partners", data.monthToDate.fromUtc, data.asOfUtc, partnerId);

  const topRevenue = data.topPartners.reduce(
    (total, row) => total + row.revenueNaira,
    0,
  );

  const topShare =
    data.monthToDate.revenueNaira > 0
      ? topRevenue / data.monthToDate.revenueNaira
      : null;

  const topShareText =
    topShare == null
      ? "No positive MTD net order value to calculate a share."
      : `The current top ${data.topPartners.length} partners account for ` +
        `${(topShare * 100).toFixed(1)}% of MTD net order value.`;

  const monthProgress =
    data.daysInMonth > 0 ? (data.completedDays / data.daysInMonth) * 100 : 0;

  const todayChanges = [
    {
      label: "Orders vs 1 week ago",
      current: data.today.orders,
      previous: data.lastWeekDay.orders,
    },
    {
      label: "Orders vs 2 weeks ago",
      current: data.today.orders,
      previous: data.twoWeeksAgoDay.orders,
    },
    {
      label: "Value vs 1 week ago",
      current: data.today.revenueNaira,
      previous: data.lastWeekDay.revenueNaira,
    },
    {
      label: "Value vs 2 weeks ago",
      current: data.today.revenueNaira,
      previous: data.twoWeeksAgoDay.revenueNaira,
    },
  ];

  const partnerChartRows = data.topPartners.map((row) => ({
    name: row.companyName,
    current: row.revenueNaira,
    previous: row.previousRevenueNaira,
  }));

  return (
    <div className="space-y-6">
      <Typography.Paragraph type="secondary" className="!mb-0">
        Business snapshot as of {watTimestamp(data.asOfUtc)} WAT, across all
        partners and products. Net order value includes eligible unpaid orders.
        Comparisons use the same WAT time of day.
      </Typography.Paragraph>

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Today's orders"
          value={count(data.today.orders)}
          icon={<ShoppingCartOutlined />}
        >
          <ChangeLine
            current={data.today.orders}
            previous={data.lastWeekDay.orders}
            label="vs same weekday last week"
          />

          <MoneyWithUsd
            naira={data.today.revenueNaira}
            usd={data.today.revenueUsd}
            suffix=" in net order value"
          />

          <TextLink
            onClick={() =>
              openReport("volume", data.today.fromUtc, data.asOfUtc)
            }
          >
            View today's activity
          </TextLink>
        </Metric>

        <Metric
          title="MTD net order value"
          value={compactMoney(data.monthToDate.revenueNaira)}
          icon={<FundOutlined />}
        >
          <MoneyWithUsd
            className="break-words"
            naira={data.monthToDate.revenueNaira}
            usd={data.monthToDate.revenueUsd}
          />

          <ChangeLine
            current={data.monthToDate.revenueNaira}
            previous={data.previousMonthToDate.revenueNaira}
            label="vs prior month equivalent"
          />

          <TextLink onClick={() => openMonthToDate("volume")}>
            View month to date
          </TextLink>
        </Metric>

        <Metric
          title="Active partners · 7 days"
          value={count(data.activeWeek.partners)}
          icon={<TeamOutlined />}
        >
          <ChangeLine
            current={data.activeWeek.partners}
            previous={data.previousWeek.partners}
            label="vs preceding seven days"
          />

          <Typography.Paragraph type="secondary" className="!mb-0">
            {count(data.previousWeek.partners)} previously. Distinct parent
            accounts with any placed order.
          </Typography.Paragraph>

          <TextLink
            onClick={() =>
              openReport("partners", data.activeWeek.fromUtc, data.asOfUtc)
            }
          >
            Explore partners by calendar date
          </TextLink>
        </Metric>

        <Metric
          title="Projected month-end value"
          value={
            data.projectedRevenueNaira == null
              ? "Awaiting a completed day"
              : compactMoney(data.projectedRevenueNaira)
          }
          icon={<CalendarOutlined />}
        >
          {data.projectedRevenueNaira != null && (
            <div className="break-words">
              {money(data.projectedRevenueNaira)}
            </div>
          )}

          <Typography.Paragraph type="secondary" className="!mb-0">
            {data.dailyRunRateNaira == null
              ? "Daily pace is not yet available."
              : `${money(data.dailyRunRateNaira)} per completed day.`}
          </Typography.Paragraph>

          <Progress
            percent={monthProgress}
            showInfo={false}
            aria-label={`${data.completedDays} of ${data.daysInMonth} calendar days completed`}
          />

          <div className="text-xs text-muted-foreground">
            {data.completedDays} of {data.daysInMonth} days completed. Simple
            pace projection, not a demand forecast.
          </div>

          <Tag>Target not set</Tag>
        </Metric>
      </div>

      {/* What changed */}
      <Card title="What changed">
        <div className="analytics-overview-insights">
          <div>
            <Typography.Text strong>Month-to-date value</Typography.Text>
            <Typography.Paragraph className="!mb-2 !mt-2">
              {changeDescription(
                data.monthToDate.revenueNaira,
                data.previousMonthToDate.revenueNaira,
                money,
              )}
            </Typography.Paragraph>
            <TextLink onClick={() => openMonthToDate("volume")}>
              Explore revenue
            </TextLink>
          </div>

          <div>
            <Typography.Text strong>Partner activity</Typography.Text>
            <Typography.Paragraph className="!mb-2 !mt-2">
              {changeDescription(
                data.activeWeek.partners,
                data.previousWeek.partners,
                (value) => `${count(value)} active partners`,
              )}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              Rolling seven-day windows ending at the observation time.
            </Typography.Text>
          </div>

          <div>
            <Typography.Text strong>Top-partner contribution</Typography.Text>
            <Typography.Paragraph className="!mb-2 !mt-2">
              {topShareText}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              {money(topRevenue)} from these partners. This is a share of value,
              not a risk score.
            </Typography.Text>
          </div>
        </div>
      </Card>

      {/* Revenue comparison */}
      <Card
        title="Revenue comparison"
        extra={
          <Radio.Group
            aria-label="Revenue comparison period"
            value={comparison}
            onChange={(event) => setComparison(event.target.value)}
            optionType="button"
            options={COMPARISON_OPTIONS}
          />
        }
      >
        <Typography.Paragraph type="secondary">
          {comparisonDescription(data, comparison)}
        </Typography.Paragraph>

        <ComparisonBars
          rows={revenueRows(data, comparison)}
          series={[{ key: "value", label: "Net order value (NGN)" }]}
          label={comparisonChartLabel(comparison)}
          format={money}
        />

        {comparison === "today" && (
          <div className="flex flex-wrap gap-4">
            {todayChanges.map((item) => (
              <span key={item.label}>
                {item.label}{" "}
                <Change current={item.current} previous={item.previous} />
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Top partners */}
      <Card
        title="Top 10 partners by MTD revenue"
        extra={
          <Radio.Group
            aria-label="Partner presentation"
            value={partnerView}
            onChange={(event) => setPartnerView(event.target.value)}
            optionType="button"
            options={PARTNER_VIEW_OPTIONS}
          />
        }
      >
        <Typography.Paragraph type="secondary">
          Current leaders against their prior month equivalent. The same
          partners are compared in both periods; this is not the prior month's
          ranking.
        </Typography.Paragraph>

        {partnerView === "chart" ? (
          <>
            <ComparisonBars
              rows={partnerChartRows}
              series={[
                { key: "current", label: "MTD net value (NGN)" },
                { key: "previous", label: "Prior equivalent (NGN)" },
              ]}
              label="Top 10 partners by MTD revenue, compared with the prior month equivalent"
              format={money}
            />

            {!!data.topPartners.length && (
              <Button onClick={() => setPartnerView("table")}>
                View values and partner details
              </Button>
            )}
          </>
        ) : (
          <Table<AnalyticsExecutivePartner>
            rowKey="partnerId"
            columns={topPartnerColumns(openPartner)}
            dataSource={data.topPartners}
            pagination={false}
            scroll={{ x: 800 }}
            locale={{
              emptyText: <Empty description="No eligible orders this month" />,
            }}
          />
        )}
      </Card>

      {/* Methodology */}
      <details className="analytics-methodology">
        <summary>How this overview is calculated</summary>
        <p>
          Comparisons stop at the same WAT time of day; shorter prior months use
          their last available calendar date. Partner activity counts placed
          orders, including pending and cancelled orders, over rolling seven-day
          windows. Detailed reports use full calendar dates, so their totals can
          differ from these snapshots.
        </p>
        <p>
          NGN and USD use saved checkout amounts. USD remains unavailable when
          saved amounts are incomplete. Projection uses only completed days of
          this month. No revenue target is configured.
        </p>
      </details>

      {/* Coming soon */}
      <Card title="Fulfilment within SLA" extra={<Tag>Coming soon</Tag>}>
        <Typography.Paragraph type="secondary">
          On-time fulfilment and overdue backlog need delivery milestones and an
          agreed SLA. Current order outcomes are available in the behaviour
          report.
        </Typography.Paragraph>

        <Space wrap>
          <Button onClick={() => openMonthToDate("behaviour")}>
            View order outcomes
          </Button>

          <Button
            onClick={() =>
              navigate({
                tab: "temporal",
                detail: undefined,
                skuDetail: undefined,
              })
            }
          >
            Explore ordering patterns
          </Button>
        </Space>
      </Card>
    </div>
  );
}
