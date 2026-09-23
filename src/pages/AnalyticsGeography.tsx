import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
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
import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import { CappedPagination } from "@/components/analytics/CappedPagination";
import { ComparisonBars } from "@/components/analytics/ComparisonBars";
import { MoneyValue } from "@/components/analytics/MoneyValue";
import { StatCard } from "@/components/analytics/StatCard";
import {
  ANALYTICS_PAGE_SIZE,
  ANALYTICS_STALE_TIME,
  getAnalytics,
} from "@/lib/analytics";
import type {
  AnalyticsGeography,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsRegion,
  AnalyticsRegionalCategory,
  AnalyticsReport,
  UpdateSearch,
} from "@/lib/analytics";
import { count, dollars, percent } from "@/lib/analyticsFormat";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const nairaAmount = (value: number) =>
  `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const regionOptions = (rows: AnalyticsRegion[]) =>
  rows.map((row) => ({ value: row.key, label: row.name }));

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

/** Columns for the zone and state tables; the name links into that region. */
function regionColumns(
  label: string,
  sortBy: string | number | undefined,
  select: (key: string) => void,
): TableColumnsType<AnalyticsRegion> {
  return [
    {
      title: label,
      dataIndex: "name",
      width: 160,
      render: (name: string, row) => (
        <Button
          type="link"
          className="!h-auto !p-0"
          onClick={() => select(row.key)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: "Orders placed",
      dataIndex: "orderCount",
      align: "right",
      render: count,
      sorter: (a, b) => a.orderCount - b.orderCount,
      defaultSortOrder: sortBy === "orders" ? "descend" : undefined,
    },
    {
      title: "Net order value",
      key: "revenueNaira",
      align: "right",
      render: (_, row) => (
        <MoneyValue naira={row.revenueNaira} usd={row.revenueUsd} />
      ),
      sorter: (a, b) => a.revenueNaira - b.revenueNaira,
      defaultSortOrder: sortBy !== "orders" ? "descend" : undefined,
    },
    {
      title: "Value share",
      dataIndex: "revenueShare",
      align: "right",
      render: percent,
    },
    {
      title: "Registered partners",
      dataIndex: "registeredPartners",
      align: "right",
      render: count,
      sorter: (a, b) => a.registeredPartners - b.registeredPartners,
    },
    {
      title: "Ordering partners",
      dataIndex: "orderingPartners",
      align: "right",
      render: count,
      sorter: (a, b) => a.orderingPartners - b.orderingPartners,
    },
    {
      title: "Ordering rate",
      dataIndex: "orderingRate",
      align: "right",
      render: percent,
    },
  ];
}

const categoryColumns: TableColumnsType<AnalyticsRegionalCategory> = [
  { title: "Category", dataIndex: "name" },
  {
    title: "Orders containing category",
    dataIndex: "orderCount",
    align: "right",
    render: count,
  },
  {
    title: "Net order value",
    align: "right",
    render: (_, row) => (
      <MoneyValue naira={row.revenueNaira} usd={row.revenueUsd} />
    ),
  },
  {
    title: "Regional value share",
    dataIndex: "revenueShare",
    align: "right",
    render: percent,
  },
];

const gapColumns: TableColumnsType<AnalyticsRegion> = [
  { title: "State / FCT", dataIndex: "name" },
  {
    title: "Partners",
    dataIndex: "registeredPartners",
    align: "right",
    render: (value: number) => count(value),
  },
  {
    title: "Orders",
    dataIndex: "orderCount",
    align: "right",
    render: (value: number) => count(value),
  },
];

// ---------------------------------------------------------------------------
// "Where to grow the network"
// ---------------------------------------------------------------------------

type GrowthMetric = "registeredPartners" | "orderCount";

interface GrowthGroupDef {
  title: string;
  metric: GrowthMetric;
  unit: string;
  /** true: bottom 5 states with some activity; false: every state with none. */
  lowest: boolean;
}

interface GrowthGroupData extends GrowthGroupDef {
  items: AnalyticsRegion[];
}

const GROWTH_GROUPS: GrowthGroupDef[] = [
  {
    title: "No partner presence",
    metric: "registeredPartners",
    unit: "partners",
    lowest: false,
  },
  {
    title: "Fewest partners · bottom 5 with presence",
    metric: "registeredPartners",
    unit: "partners",
    lowest: true,
  },
  {
    title: "No orders in selected period",
    metric: "orderCount",
    unit: "orders",
    lowest: false,
  },
  {
    title: "Fewest orders · bottom 5 with activity",
    metric: "orderCount",
    unit: "orders",
    lowest: true,
  },
];

const METRIC_LABELS: Record<GrowthMetric, string> = {
  registeredPartners: "Registered partners",
  orderCount: "Orders placed",
};

function buildGrowthGroups(mappedStates: AnalyticsRegion[]): GrowthGroupData[] {
  return GROWTH_GROUPS.map((group) => {
    const matching = mappedStates
      .filter((row) =>
        group.lowest ? row[group.metric] > 0 : row[group.metric] === 0,
      )
      .sort(
        (a, b) =>
          a[group.metric] - b[group.metric] || a.name.localeCompare(b.name),
      );

    return {
      ...group,
      items: group.lowest ? matching.slice(0, 5) : matching,
    };
  });
}

function GrowthGroup({ group }: { group: GrowthGroupData }) {
  let body;

  if (!group.lowest) {
    body = (
      <Table<AnalyticsRegion>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={group.items}
        columns={gapColumns}
        locale={{ emptyText: "No states in this group." }}
      />
    );
  } else if (group.items.length > 0) {
    body = (
      <ComparisonBars
        rows={group.items.map((row) => ({
          name: row.name,
          value: row[group.metric],
        }))}
        series={[{ key: "value", label: METRIC_LABELS[group.metric] }]}
        label={group.title}
        format={(value) => `${count(value)} ${group.unit}`}
      />
    );
  } else {
    body = (
      <Typography.Text type="secondary">
        No states in this group.
      </Typography.Text>
    );
  }

  return (
    <section className="min-w-0 rounded-lg border border-gray-200 p-4">
      <Typography.Title level={5} className="!mt-0">
        {group.title}
      </Typography.Title>

      {body}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface Props {
  data: AnalyticsGeography;
  params: AnalyticsParams;
  scope: string;
  zone?: string;
  state?: string;
  categoryPage: number;
  update: UpdateSearch;
}

export default function AnalyticsGeographyPanel({
  data,
  params,
  scope,
  zone,
  state,
  categoryPage,
  update,
}: Props) {
  const { summary, zones, states } = data;

  const visibleStates = states.filter((row) => !zone || row.zone === zone);
  const mappedStates = states.filter((row) => row.key !== "unmapped");
  const growthGroups = buildGrowthGroups(mappedStates);

  const regionName =
    states.find((row) => row.key === state)?.name ??
    zones.find((row) => row.key === zone)?.name ??
    "All locations";

  const unmappedPartners = summary.registeredPartners - summary.mappedPartners;
  const unmappedOrders = summary.orderCount - summary.mappedOrders;

  const mappedOrderShare = summary.orderCount
    ? summary.mappedOrders / summary.orderCount
    : null;

  const coverageWarning =
    `${count(unmappedPartners)} registered partners and ` +
    `${count(unmappedOrders)} orders are unmapped. ` +
    "Missing or unrecognised states and non-Nigerian locations stay in " +
    "Unmapped and remain part of the totals. Complete these profiles before " +
    "judging regional coverage.";

  const categories = useQuery({
    queryKey: [
      "analytics",
      scope,
      "geography/categories",
      params,
      zone,
      state,
      categoryPage,
    ],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsRegionalCategory>>>(
        "geography/categories",
        {
          ...params,
          geoZone: zone,
          geoState: state,
          page: categoryPage,
          pageSize: ANALYTICS_PAGE_SIZE,
        },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  function selectZone(value?: string) {
    update(
      { geoZone: value, geoState: undefined, geoCategoryPage: undefined },
      false,
    );
  }

  function selectState(value?: string) {
    update({ geoState: value, geoCategoryPage: undefined }, false);
  }

  function renderCategories() {
    if (categories.isError) {
      return (
        <AnalyticsError
          error={categories.error}
          retry={() => void categories.refetch()}
        />
      );
    }

    if (categories.isPending) return <Skeleton active />;

    const { items, totalCount } = categories.data.data;

    return (
      <>
        <Table<AnalyticsRegionalCategory>
          rowKey={(row) => row.id ?? "unknown"}
          columns={categoryColumns}
          dataSource={items}
          pagination={false}
          scroll={{ x: 650 }}
          locale={{
            emptyText:
              "No category demand recorded in this region under the selected filters",
          }}
        />

        <CappedPagination
          current={categoryPage}
          total={totalCount}
          noun="categories"
          onChange={(page) => update({ geoCategoryPage: String(page) }, false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Typography.Paragraph type="secondary" className="!mb-0">
        Locations come from each parent partner’s current registered state.
        Sub-account orders roll up to that partner. This describes the partner
        network, not delivery destinations; changing a profile’s state moves its
        past orders into the new region.
      </Typography.Paragraph>

      {/* Summary */}
      <Row gutter={[16, 16]}>
        <StatCard>
          <Statistic title="Orders placed" value={summary.orderCount} />
          <Typography.Text type="secondary">
            {count(summary.orderingPartners)} ordering partners
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
              ? "USD unavailable: incomplete saved amounts"
              : `USD ${dollars(summary.revenueUsd)}`}
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic
            title="Registered partners today"
            value={summary.registeredPartners}
          />
          <Typography.Text type="secondary">
            {count(summary.mappedPartners)} with a mapped state
          </Typography.Text>
        </StatCard>

        <StatCard>
          <Statistic
            title="Orders mapped to a state"
            value={percent(mappedOrderShare)}
          />
          <Typography.Text type="secondary">
            {count(unmappedOrders)} orders with unmapped locations
          </Typography.Text>
        </StatCard>
      </Row>

      {(unmappedPartners > 0 || unmappedOrders > 0) && (
        <Alert
          type="warning"
          showIcon
          title="Location coverage is incomplete"
          description={coverageWarning}
        />
      )}

      {/* Zones */}
      <Card title="Revenue and activity by zone">
        <Typography.Paragraph type="secondary">
          All six geopolitical zones, plus unmapped locations. Value share
          includes every location under the main filters. Select a zone to
          explore its states and category demand below.
        </Typography.Paragraph>

        <ComparisonBars
          rows={zones.map((row) => ({
            name: row.name,
            revenue: row.revenueNaira,
          }))}
          series={[{ key: "revenue", label: "Net order value (NGN)" }]}
          label="Net order value across all zones, including unmapped locations"
          format={nairaAmount}
        />

        <Table<AnalyticsRegion>
          key={`zones-${params.sortBy}`}
          rowKey="key"
          columns={regionColumns("Zone", params.sortBy, selectZone)}
          dataSource={zones}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* States */}
      <Card>
        <div className="mb-5 flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-60">
            <label className="mb-1 block text-sm">Explore a zone</label>
            <Select
              className="w-full"
              aria-label="Geographic zone"
              placeholder="All zones"
              allowClear
              value={zone}
              options={regionOptions(zones)}
              onChange={selectZone}
            />
          </div>

          <div className="w-full sm:w-60">
            <label className="mb-1 block text-sm">
              Category demand in a state
            </label>
            <Select
              className="w-full"
              aria-label="Geographic state"
              placeholder="All states in selected zone"
              allowClear
              showSearch
              optionFilterProp="label"
              value={state}
              options={regionOptions(visibleStates)}
              onChange={selectState}
            />
          </div>
        </div>

        <Typography.Title level={4}>
          State performance and partner coverage
        </Typography.Title>

        <Typography.Paragraph type="secondary">
          Registered partners include those with no orders. Date, brand and
          category filters apply to order activity; the partner filter applies
          to both activity and the current network. Ordering rate is ordering
          partners divided by registered partners. Sort Registered partners
          ascending to inspect the smallest networks.
        </Typography.Paragraph>

        <Table<AnalyticsRegion>
          key={`states-${zone}-${params.sortBy}`}
          rowKey="key"
          columns={regionColumns("State / FCT", params.sortBy, selectState)}
          dataSource={visibleStates}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Category demand */}
      <Card title="Regional category demand">
        <Space wrap className="mb-3">
          <Tag>{regionName}</Tag>
        </Space>

        <Typography.Paragraph type="secondary">
          Category mix can guide local stocking and promotions. Orders may
          contain several categories, so category order counts should not be
          added together. Values use the saved order amounts and allocated
          discounts; pending, failed and cancelled orders contribute no revenue.
        </Typography.Paragraph>

        {renderCategories()}
      </Card>

      {/* Growth opportunities */}
      <Card title="Where to grow the network">
        <Typography.Paragraph type="secondary">
          Current registered partners and orders placed in the selected period,
          under the active filters.
        </Typography.Paragraph>

        <div className="grid gap-6 xl:grid-cols-2">
          {growthGroups.map((group) => (
            <GrowthGroup key={group.title} group={group} />
          ))}
        </div>
      </Card>
    </div>
  );
}
