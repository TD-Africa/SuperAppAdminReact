import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Grid,
  Pagination,
  Popover,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import { CappedPagination } from "@/components/analytics/CappedPagination";
import {
  dimensionColumns,
  dimensionRowKey,
} from "@/components/analytics/dimensionColumns";
import { MoneyValue } from "@/components/analytics/MoneyValue";
import { OrderValueChart } from "@/components/analytics/OrderValueChart";
import { RateValue } from "@/components/analytics/RateValue";
import { RevenueBars } from "@/components/analytics/RevenueBars";
import {
  ANALYTICS_MAX_ROWS,
  ANALYTICS_PAGE_SIZE,
  ANALYTICS_STALE_TIME,
  getAnalytics,
} from "@/lib/analytics";
import type {
  AnalyticsConcentration,
  AnalyticsConcentrationRow,
  AnalyticsDetail,
  AnalyticsDimension,
  AnalyticsExchangeRates,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsPartner,
  AnalyticsRecentOrder,
  AnalyticsReport,
  UpdateSearch,
} from "@/lib/analytics";
import {
  money,
  percent,
  stageLabel,
  usdMoney,
  watDate,
} from "@/lib/analyticsFormat";

type OpenPartner = (partnerId: string) => void;

// ---------------------------------------------------------------------------
// Report controls
// ---------------------------------------------------------------------------

/** Partner report variants; each is also its API endpoint. */
export const PARTNER_VIEWS = [
  "partners",
  "new-partners",
  "inactive",
  "concentration",
];

const PARTNER_VIEW_OPTIONS = [
  { value: "partners", label: "All active in window" },
  { value: "new-partners", label: "New partners" },
  { value: "inactive", label: "Inactive partners" },
  { value: "concentration", label: "Revenue concentration" },
];

const STAGE_OPTIONS = [
  "new",
  "repeat",
  "plateauing",
  "at_risk",
  "churned",
  "occasional",
].map((value) => ({ value, label: stageLabel(value) }));

const INACTIVE_DAYS_OPTIONS = [30, 60, 90].map((days) => ({
  value: String(days),
  label: `At least ${days} days inactive`,
}));

const TOP_OPTIONS = [10, 20, 50].map((size) => ({
  value: String(size),
  label: `Top ${size} partners`,
}));

const STAGE_DEFINITIONS = [
  {
    term: "New",
    description:
      "First-ever order within the last 30 days, even if they have ordered again.",
  },
  {
    term: "Repeat",
    description:
      "At least two lifetime orders and fewer than 30 days since the last order, outside the new stage.",
  },
  {
    term: "Plateauing",
    description:
      "No order for 30–59 days, at least two orders in the trailing 90 days, and a current gap longer than the average interval between those orders.",
  },
  {
    term: "At risk",
    description:
      "No order for 30–89 days, excluding partners classified as plateauing.",
  },
  {
    term: "Churned",
    description:
      "No order for at least 90 days. This indicates inactivity, not a confirmed departure.",
  },
  {
    term: "Occasional",
    description:
      "Reserved fallback; not currently assigned by these rules. Partners with one order fall into new, at risk, or churned.",
  },
];

const STAGE_POPOVER_STYLE = {
  width: 440,
  maxWidth: "calc(100vw - 64px)",
  maxHeight: "65vh",
  overflowY: "auto" as const,
};

/** "Stage definitions" link: a popover on desktop, a bottom drawer on small screens. */
function PartnerStageHelp() {
  const [open, setOpen] = useState(false);
  const screens = Grid.useBreakpoint();

  const closeOnEscape = (event: { key: string }) => {
    if (event.key === "Escape") setOpen(false);
  };

  const definitions = (
    <div onKeyDown={closeOnEscape}>
      <Typography.Paragraph type="secondary">
        Stages use order history as of the selected end date (WAT). Subaccount
        orders count toward their parent partner. Pending, cancelled, and failed
        orders also count; deleted orders are excluded. Brand and category
        filters do not change the stage.
      </Typography.Paragraph>

      <dl className="m-0 space-y-3">
        {STAGE_DEFINITIONS.map((stage) => (
          <div key={stage.term}>
            <dt className="font-semibold">{stage.term}</dt>
            <dd className="m-0">{stage.description}</dd>
          </div>
        ))}
      </dl>

      <Typography.Paragraph type="secondary" className="!mb-0 !mt-4">
        “New partners” uses first orders within your selected date range; the
        “new” stage always uses the last 30 days. Combining report and stage
        filters can return no results.
      </Typography.Paragraph>
    </div>
  );

  const trigger = (
    <Button
      type="link"
      icon={<InfoCircleOutlined />}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      onKeyDown={closeOnEscape}
    >
      Stage definitions
    </Button>
  );

  if (screens.md) {
    return (
      <Popover
        title="Partner stage definitions"
        trigger="click"
        placement="bottomLeft"
        open={open}
        onOpenChange={setOpen}
        content={
          <div style={STAGE_POPOVER_STYLE}>
            {definitions}
            <Button className="mt-4" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {trigger}
      </Popover>
    );
  }

  return (
    <>
      {trigger}
      <Drawer
        title="Partner stage definitions"
        placement="bottom"
        size="80vh"
        open={open}
        onClose={() => setOpen(false)}
      >
        {definitions}
      </Drawer>
    </>
  );
}

/** Report picker plus the options that belong to the chosen report. */
export function PartnerReportControls({
  view,
  params,
  update,
}: {
  view: string;
  params: AnalyticsParams;
  update: UpdateSearch;
}) {
  return (
    <Space wrap>
      <Select
        aria-label="Partner report"
        className="min-w-48"
        value={view}
        options={PARTNER_VIEW_OPTIONS}
        onChange={(value) => update({ view: value })}
      />

      {view !== "concentration" && (
        <Select
          aria-label="Partner stage"
          placeholder="All stages"
          allowClear
          className="min-w-40"
          value={params.stage}
          options={STAGE_OPTIONS}
          onChange={(value) =>
            update({ stage: value ? String(value) : undefined })
          }
        />
      )}

      {view !== "concentration" && <PartnerStageHelp />}

      {view === "inactive" && (
        <Select
          aria-label="Inactivity threshold"
          value={params.inactiveDays}
          options={INACTIVE_DAYS_OPTIONS}
          onChange={(value) => update({ inactiveDays: String(value) })}
        />
      )}

      {view === "concentration" && (
        <Select
          aria-label="Concentration size"
          value={params.top}
          options={TOP_OPTIONS}
          onChange={(value) => update({ top: String(value) })}
        />
      )}
    </Space>
  );
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

function partnerColumns(
  view: string,
  openPartner: OpenPartner,
): TableColumnsType<AnalyticsPartner> {
  const columns: TableColumnsType<AnalyticsPartner> = [
    {
      title: "Partner",
      dataIndex: "companyName",
      render: (name: string, record) => (
        <Button
          type="link"
          className="!px-0"
          onClick={() => openPartner(record.partnerId)}
        >
          {name}
        </Button>
      ),
    },
    { title: "Orders", dataIndex: "orderCount", align: "right" },
    {
      title: "Net order value",
      dataIndex: "revenueNaira",
      align: "right",
      render: (value: number, row) => (
        <MoneyValue naira={value} usd={row.revenueUsd} />
      ),
    },
    {
      title: "Exchange rate",
      dataIndex: "exchangeRates",
      render: (rates: AnalyticsExchangeRates | null) => (
        <RateValue rates={rates} />
      ),
    },
    {
      title: "AOV",
      dataIndex: "aov",
      align: "right",
      render: (value: number, row) => (
        <MoneyValue naira={value} usd={row.aovUsd} />
      ),
    },
    { title: "Last order (WAT)", dataIndex: "lastOrderAt", render: watDate },
    { title: "Days inactive", dataIndex: "daysSinceLastOrder", align: "right" },
    {
      title: "Stage",
      dataIndex: "lifecycleStage",
      render: (value: string) => <Tag>{stageLabel(value)}</Tag>,
    },
  ];

  if (view === "new-partners") {
    columns.push(
      {
        title: "First order value",
        dataIndex: "firstOrderRevenue",
        render: (value: number | null, row) =>
          value == null ? (
            "Outside window or dimension filter"
          ) : (
            <MoneyValue naira={value} usd={row.firstOrderRevenueUsd} />
          ),
      },
      { title: "Orders since first", dataIndex: "ordersSince", align: "right" },
    );
  }

  if (view === "inactive") {
    columns.push(
      {
        title: "Average interval (days)",
        dataIndex: "avgIntervalDaysBefore",
        render: (value: number | null) =>
          value == null ? "One order" : value.toFixed(1),
      },
      {
        title: "Lifetime value",
        dataIndex: "lifetimeRevenue",
        align: "right",
        render: (value: number, row) => (
          <MoneyValue naira={value} usd={row.lifetimeRevenueUsd} />
        ),
      },
    );
  }

  return columns;
}

function concentrationColumns(
  openPartner: OpenPartner,
): TableColumnsType<AnalyticsConcentrationRow> {
  return [
    { title: "Rank", dataIndex: "rank" },
    {
      title: "Partner",
      dataIndex: "companyName",
      render: (name: string, row) => (
        <Button type="link" onClick={() => openPartner(row.partnerId)}>
          {name}
        </Button>
      ),
    },
    {
      title: "Net order value",
      dataIndex: "revenueNaira",
      render: (value: number, row) => (
        <MoneyValue naira={value} usd={row.revenueUsd} />
      ),
    },
    {
      title: "Exchange rate",
      dataIndex: "exchangeRates",
      render: (rates: AnalyticsExchangeRates) => <RateValue rates={rates} />,
    },
    {
      title: "Cumulative share (NGN)",
      dataIndex: "cumulativeShare",
      render: percent,
    },
  ];
}

const recentOrderColumns: TableColumnsType<AnalyticsRecentOrder> = [
  { title: "Reference", dataIndex: "orderReference" },
  { title: "Placed (WAT)", dataIndex: "placedAt", render: watDate },
  {
    title: "Net order value",
    dataIndex: "revenueNaira",
    render: (value: number, row) => (
      <MoneyValue naira={value} usd={row.revenueUsd} />
    ),
  },
  {
    title: "Exchange rate",
    dataIndex: "exchangeRates",
    render: (rates: AnalyticsExchangeRates) => <RateValue rates={rates} />,
  },
];

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function PartnerList({
  partners,
  view,
  currentPage,
  openPartner,
  update,
}: {
  partners: AnalyticsPage<AnalyticsPartner>;
  view: string;
  currentPage: number;
  openPartner: OpenPartner;
  update: UpdateSearch;
}) {
  return (
    <Card>
      <Typography.Paragraph type="secondary">
        First/last order and stage use lifetime order history as of the selected
        end date. Brand/category filters select activity within the window;
        lifetime value covers all items.
      </Typography.Paragraph>

      <Table<AnalyticsPartner>
        rowKey="partnerId"
        columns={partnerColumns(view, openPartner)}
        dataSource={partners.items}
        scroll={{ x: 1200 }}
        pagination={false}
      />

      <CappedPagination
        current={currentPage}
        total={partners.totalCount}
        noun="partners"
        onChange={(value) => update({ page: String(value) }, false)}
      />
    </Card>
  );
}

export function ConcentrationReport({
  concentration,
  top,
  openPartner,
}: {
  concentration: AnalyticsConcentration;
  top: AnalyticsParams["top"];
  openPartner: OpenPartner;
}) {
  const title =
    `Top ${top} partners represent ${percent(concentration.topNShare)} ` +
    `of ${money(concentration.overallRevenue)} / USD ${usdMoney(concentration.overallRevenueUsd)}`;

  return (
    <Card title={title}>
      {concentration.items.length ? (
        <div>
          <RevenueBars data={concentration.items} nameKey="companyName" />
        </div>
      ) : (
        <Empty description="No partner activity in this window" />
      )}

      <Table<AnalyticsConcentrationRow>
        rowKey="partnerId"
        columns={concentrationColumns(openPartner)}
        dataSource={concentration.items}
        scroll={{ x: 600 }}
        pagination={false}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Partner detail drawer (opened from several tabs)
// ---------------------------------------------------------------------------

export function PartnerDetail({
  id,
  params,
  scope,
  onClose,
  onPageChange,
}: {
  id?: string;
  params: AnalyticsParams;
  scope: string;
  onClose: () => void;
  onPageChange: (page: number) => void;
}) {
  const query = useQuery({
    queryKey: ["analytics", scope, "detail", id, params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsDetail>>(
        `partners/${encodeURIComponent(id!)}`,
        params,
        signal,
      ),
    enabled: !!id,
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const detail = query.data?.data;

  function renderBody() {
    if (query.isError) {
      return (
        <AnalyticsError
          error={query.error}
          retry={() => void query.refetch()}
        />
      );
    }

    if (!detail) return <Skeleton active />;

    const { partner } = detail;

    const facts = [
      { label: "Stage", value: stageLabel(partner.lifecycleStage) },
      { label: "Orders in window", value: partner.orderCount },
      {
        label: "Net order value",
        value: (
          <MoneyValue naira={partner.revenueNaira} usd={partner.revenueUsd} />
        ),
      },
      {
        label: "Lifetime value",
        value: (
          <MoneyValue
            naira={partner.lifetimeRevenue}
            usd={partner.lifetimeRevenueUsd}
          />
        ),
      },
      { label: "First order (WAT)", value: watDate(partner.firstOrderAt) },
      { label: "Last order (WAT)", value: watDate(partner.lastOrderAt) },
    ];

    const dimensionTotal = Math.max(
      detail.brands.totalCount,
      detail.categories.totalCount,
    );

    return (
      <div className="flex min-w-0 flex-col gap-6">
        {detail.reactivated && (
          <Alert
            type="success"
            title="Reactivated after at least 90 days without an order"
          />
        )}

        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-x-6 gap-y-5">
          {facts.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="mb-1 text-sm text-gray-500">{item.label}</dt>
              <dd className="m-0">{item.value}</dd>
            </div>
          ))}

          <div className="col-span-full min-w-0">
            <dt className="mb-1 text-sm text-gray-500">
              Window exchange rates
            </dt>
            <dd className="m-0">
              <RateValue rates={partner.exchangeRates} />
            </dd>
          </div>
        </dl>

        <OrderValueChart points={detail.timeseries} />

        <Typography.Title level={5}>Brands</Typography.Title>
        <Table<AnalyticsDimension>
          rowKey={dimensionRowKey}
          size="small"
          columns={dimensionColumns}
          dataSource={detail.brands.items}
          scroll={{ x: 700 }}
          pagination={false}
        />

        <Typography.Title level={5}>Categories</Typography.Title>
        <Table<AnalyticsDimension>
          rowKey={dimensionRowKey}
          size="small"
          columns={dimensionColumns}
          dataSource={detail.categories.items}
          scroll={{ x: 700 }}
          pagination={false}
        />

        <Pagination
          current={Number(params.page ?? 1)}
          pageSize={ANALYTICS_PAGE_SIZE}
          total={Math.min(dimensionTotal, ANALYTICS_MAX_ROWS)}
          showSizeChanger={false}
          onChange={onPageChange}
        />

        <Typography.Title level={5}>
          Latest 10 orders in the selected window
        </Typography.Title>
        <Table<AnalyticsRecentOrder>
          rowKey="id"
          size="small"
          columns={recentOrderColumns}
          dataSource={detail.recentOrders}
          scroll={{ x: 700 }}
          pagination={false}
        />
      </div>
    );
  }

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={detail?.partner.companyName ?? "Partner analytics"}
      size="large"
    >
      {renderBody()}
    </Drawer>
  );
}
