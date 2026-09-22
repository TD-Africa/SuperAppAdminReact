import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Radio,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ComparisonBars } from "@/components/analytics/ComparisonBars";
import type {
  AnalyticsTemporal,
  AnalyticsTemporalCadence,
  AnalyticsTemporalCycle,
  AnalyticsTemporalSlot,
  AnalyticsTemporalWeekday,
} from "@/lib/analytics";
import { count, money, watTimestamp } from "@/lib/analyticsFormat";

// ---------------------------------------------------------------------------
// Constants & formatters
// ---------------------------------------------------------------------------

/** The API numbers weekdays 1 (Monday) to 7 (Sunday). */
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const PERIOD_OPTIONS = [
  { value: "month", label: "Month end" },
  { value: "quarter", label: "Quarter end" },
];

const decimal = (value: number | null) =>
  value == null
    ? "Unavailable"
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const dayName = (weekday: number) => DAYS[weekday - 1];

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const weekdayColumns: TableColumnsType<AnalyticsTemporalWeekday> = [
  {
    title: "Weekday",
    dataIndex: "weekday",
    render: dayName,
  },
  {
    title: "Days observed",
    dataIndex: "observedDays",
    align: "right",
    render: count,
  },
  {
    title: "Orders",
    dataIndex: "orders",
    align: "right",
    render: count,
    sorter: (a, b) => a.orders - b.orders,
  },
  {
    title: "Orders per day",
    dataIndex: "averageOrders",
    align: "right",
    render: decimal,
    sorter: (a, b) => (a.averageOrders ?? -1) - (b.averageOrders ?? -1),
  },
  {
    title: "Partners",
    dataIndex: "partners",
    align: "right",
    render: count,
  },
  {
    title: "Net order value",
    dataIndex: "revenueNaira",
    align: "right",
    render: money,
  },
];

const cycleColumns: TableColumnsType<AnalyticsTemporalCycle> = [
  { title: "Period starting", dataIndex: "periodStart" },
  {
    title: "Days observed",
    key: "coverage",
    render: (_, row) => (
      <span>
        {row.observedDays}/{row.calendarDays}{" "}
        {row.observedDays < row.calendarDays && <Tag>Partial</Tag>}
      </span>
    ),
  },
  {
    title: "Orders",
    dataIndex: "orders",
    align: "right",
    render: count,
  },
  {
    title: "End-window days",
    dataIndex: "endDays",
    align: "right",
    render: (value) => `${value}/5`,
  },
  {
    title: "End-window orders",
    dataIndex: "endOrders",
    align: "right",
    render: count,
  },
  {
    title: "Share of orders",
    dataIndex: "endShare",
    align: "right",
    render: (value) =>
      value == null ? "Unavailable" : `${(value * 100).toFixed(1)}%`,
  },
  {
    title: "Orders/day at end",
    dataIndex: "endDailyOrders",
    align: "right",
    render: decimal,
  },
  {
    title: "Orders/day otherwise",
    dataIndex: "otherDailyOrders",
    align: "right",
    render: decimal,
  },
  {
    title: "Daily activity ratio",
    dataIndex: "dailyOrderRatio",
    align: "right",
    render: (value) => (value == null ? "Unavailable" : `${decimal(value)}×`),
  },
];

function cadenceColumns(
  openPartner: (id: string) => void,
): TableColumnsType<AnalyticsTemporalCadence> {
  return [
    {
      title: "Partner",
      dataIndex: "companyName",
      render: (name, row) => (
        <Button
          type="link"
          className="!h-auto !whitespace-normal !p-0 !text-left"
          onClick={() => openPartner(row.partnerId)}
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
      title: "Median days between orders",
      dataIndex: "medianIntervalDays",
      align: "right",
      render: decimal,
    },
    {
      title: "Prior-window orders",
      dataIndex: "previousOrders",
      align: "right",
      render: count,
    },
    {
      title: "Prior median days",
      dataIndex: "previousMedianIntervalDays",
      align: "right",
      render: (value) =>
        value == null ? "Fewer than 3 orders" : decimal(value),
    },
  ];
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

/** Burgundy scaled by activity; grey where the slot was never observed. */
function heatCellStyle(slot: AnalyticsTemporalSlot, strength: number) {
  return {
    background: slot.observedDays
      ? `rgba(128, 0, 32, ${0.06 + strength * 0.94})`
      : "#f3f4f6",
    color: strength > 0.5 ? "white" : "#292524",
  };
}

function OrderHeatmap({
  slots,
  onSelect,
}: {
  slots: AnalyticsTemporalSlot[];
  onSelect: (slot: AnalyticsTemporalSlot) => void;
}) {
  const maximum = Math.max(0, ...slots.map((slot) => slot.averageOrders ?? 0));

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full min-w-[1000px] border-separate border-spacing-1 text-sm"
        aria-label="Average orders by weekday and hour in WAT"
      >
        <thead>
          <tr>
            <th className="text-left">WAT</th>

            {HOURS.map((hour) => (
              <th key={hour} scope="col">
                {String(hour).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {DAYS.map((day, index) => {
            const daySlots = slots.filter((slot) => slot.weekday === index + 1);

            return (
              <tr key={day}>
                <th scope="row" className="pr-3 text-left font-medium">
                  {day}
                </th>

                {daySlots.map((slot) => {
                  const strength = maximum
                    ? (slot.averageOrders ?? 0) / maximum
                    : 0;

                  const label =
                    `${day}, ${slot.hour}:00 WAT: ` +
                    `${decimal(slot.averageOrders)} average orders; ` +
                    `${slot.orders} orders across ${slot.observedDays} observed days`;

                  return (
                    <td key={slot.hour}>
                      <button
                        type="button"
                        title={label}
                        aria-label={label}
                        className="h-10 w-full min-w-8 rounded border-0 px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={heatCellStyle(slot, strength)}
                        onClick={() => onSelect(slot)}
                      >
                        {slot.averageOrders == null
                          ? "—"
                          : decimal(slot.averageOrders)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlotDetail({ slot }: { slot: AnalyticsTemporalSlot }) {
  const usd =
    slot.revenueUsd == null
      ? "USD unavailable"
      : `USD ${slot.revenueUsd.toLocaleString()}`;

  return (
    <div
      className="mt-4 rounded border border-solid border-gray-200 p-3 text-sm"
      role="status"
    >
      {dayName(slot.weekday)} · {slot.hour}:00–{slot.hour + 1}:00 WAT ·{" "}
      {count(slot.orders)} orders · {count(slot.partners)} partners ·{" "}
      {money(slot.revenueNaira)}
      <div className="mt-1 text-muted-foreground">
        {usd} · {slot.observedDays} observed days
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function AnalyticsTemporalPanel({
  data,
  openPartner,
}: {
  data: AnalyticsTemporal;
  openPartner: (id: string) => void;
}) {
  const [period, setPeriod] = useState<"month" | "quarter">("month");
  const [selected, setSelected] = useState<AnalyticsTemporalSlot | null>(null);

  const { summary, completedDays } = data;

  const scopeNote =
    `${completedDays} complete days observed, ending before ` +
    `${watTimestamp(data.observedThroughUtc)} WAT. Today and future dates are excluded. ` +
    "Order counts include pending and cancelled orders; net value follows the " +
    "existing revenue rules.";

  const tiles = [
    {
      label: "Orders placed",
      value: count(summary.ordersTotal),
    },
    {
      label: "Ordering partners",
      value: count(summary.distinctPartnersInWindow),
    },
    {
      label: "Net order value (NGN)",
      value: money(summary.revenueNairaTotal),
    },
    {
      label: "Orders per observed day",
      value: completedDays
        ? decimal(summary.ordersTotal / completedDays)
        : "Unavailable",
    },
  ];

  const weekdayRows = data.weekdays.map((row) => ({
    name: dayName(row.weekday),
    average: row.averageOrders,
  }));

  return (
    <div className="space-y-6">
      <Alert
        type="info"
        showIcon
        title="Completed days in WAT"
        description={scopeNote}
      />

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((item) => (
          <Card key={item.label} className="min-w-0">
            <div className="text-sm text-muted-foreground">{item.label}</div>
            <div className="mt-2 break-words text-2xl font-semibold tracking-tight">
              {item.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Weekday × hour heatmap */}
      <Card title="When partners place orders">
        <Typography.Paragraph type="secondary">
          Average orders in each one-hour slot, divided by the number of that
          weekday observed. Darker cells mean more activity. Select a cell for
          its totals. These are candidate promotion windows; conversion impact
          needs campaign measurement.
        </Typography.Paragraph>

        {completedDays ? (
          <OrderHeatmap slots={data.heatmap} onSelect={setSelected} />
        ) : (
          <Empty description="Choose a range containing completed days" />
        )}

        {selected && <SlotDetail slot={selected} />}
      </Card>

      {/* Weekdays */}
      <Card title="Weekday comparison">
        <Typography.Paragraph type="secondary">
          Compare averages as well as totals: selected ranges can contain
          different numbers of each weekday.
        </Typography.Paragraph>

        <ComparisonBars
          rows={weekdayRows}
          series={[{ key: "average", label: "Orders per observed day" }]}
          label="Average orders per observed day, by weekday; unavailable averages are omitted"
        />

        <Table
          rowKey="weekday"
          columns={weekdayColumns}
          dataSource={data.weekdays}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Month / quarter end */}
      <Card title="Month-end and quarter-end ordering">
        <Radio.Group
          className="mb-4"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          optionType="button"
          options={PERIOD_OPTIONS}
        />

        <Typography.Paragraph type="secondary">
          End windows are the final five calendar days. Ratios compare orders
          per observed end-window day with orders per other observed day.
          Quarters follow the calendar year. Quarter-end days also belong to
          month end; the two views overlap. Partial periods are labelled and
          zero baselines have no ratio.
        </Typography.Paragraph>

        <Table
          rowKey={(row) => `${row.period}-${row.periodStart}`}
          columns={cycleColumns}
          dataSource={data.cycles.filter((row) => row.period === period)}
          pagination={false}
          scroll={{ x: 1250 }}
          locale={{ emptyText: "No completed days in this range" }}
        />
      </Card>

      {/* Partner cadence */}
      <Card title="Partner ordering intervals">
        <Typography.Paragraph type="secondary">
          The 20 most active parent partners with at least three orders in the
          observed window. Median gaps use orders within each window; the
          equal-length prior window starts {watTimestamp(data.previousFromUtc)}{" "}
          WAT. Prior medians require three orders too. Frequency alone cannot
          establish whether a partner is replenishing proactively or has run out
          of stock.
        </Typography.Paragraph>

        <Table
          rowKey="partnerId"
          columns={cadenceColumns(openPartner)}
          dataSource={data.cadence}
          pagination={false}
          scroll={{ x: 850 }}
          locale={{ emptyText: "No partners have three orders in this window" }}
        />
      </Card>

      <Card title="Payment-cycle patterns" extra={<Tag>Coming soon</Tag>}>
        <Typography.Paragraph type="secondary" className="!mb-0">
          Linking ordering peaks to payment cycles needs agreed cycle dates and
          reconciled payment history.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
