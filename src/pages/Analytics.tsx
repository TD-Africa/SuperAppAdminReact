import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  App,
  Button,
  Card,
  DatePicker,
  Dropdown,
  Select,
  Skeleton,
  Typography,
} from "antd";
import {
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { AnalyticsError } from "@/components/analytics/AnalyticsError";
import { AnalyticsWorkspace } from "@/components/analytics/AnalyticsWorkspace";
import { ActiveFilter, Lookup } from "@/components/analytics/Lookup";
import { useAnalyticsReports } from "@/hooks/useAnalyticsReports";
import { analyticsError, downloadAnalytics } from "@/lib/analytics";
import type {
  AnalyticsExportFormat,
  AnalyticsParams,
  UpdateSearch,
} from "@/lib/analytics";
import { watTimestamp } from "@/lib/analyticsFormat";
import { ANALYTICS_SECTIONS } from "@/lib/analyticsSections";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import AnalyticsBehaviourPanel from "./AnalyticsBehaviour";
import AnalyticsCreditPanel from "./AnalyticsCredit";
import AnalyticsExecutivePanel from "./AnalyticsExecutive";
import AnalyticsGeographyPanel from "./AnalyticsGeography";
import {
  ConcentrationReport,
  PARTNER_VIEWS,
  PartnerDetail,
  PartnerList,
  PartnerReportControls,
} from "./AnalyticsPartners";
import AnalyticsProductsPanel from "./AnalyticsProducts";
import AnalyticsTemporalPanel from "./AnalyticsTemporal";
import AnalyticsVolumePanel from "./AnalyticsVolume";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RANGE_DAYS = 89;

/** URL keys holding a page number; cleared whenever the result set changes. */
const PAGE_KEYS = [
  "page",
  "brandPage",
  "categoryPage",
  "growthPage",
  "detailPage",
  "cancellationPage",
  "cartPage",
  "geoCategoryPage",
  "productPage",
  "stockPage",
  "creditPartnerPage",
  "debtPage",
  "debtOrderPage",
];

/** Tabs whose "Group by" select only sets the allowed date-range length. */
const RANGE_ONLY_TABS: string[] = ["geography", "temporal", "credit"];

/** Tabs without the shared "Sort by" control. */
const UNSORTED_TABS: string[] = ["behaviour", "products", "temporal", "credit"];

/** Tabs that carry their own methodology notes. */
const OWN_METHODOLOGY_TABS: string[] = ["executive", "behaviour", "credit"];

const BUCKET_OPTIONS = ["Day", "Week", "Month", "Quarter", "Year"].map(
  (value) => ({ value, label: value }),
);

const GROWTH_DIMENSION_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "brand", label: "Brand" },
];

/** Today's date in WAT (UTC+1), as YYYY-MM-DD. */
const dateToday = () =>
  new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/** Which export endpoint serves the current tab. */
function exportResource(
  tab: string,
  format: AnalyticsExportFormat,
  view: string,
) {
  if (tab === "volume") {
    // CSV exports just the time series; Excel exports the full report.
    return format === "xlsx" ? "overview" : "orders-timeseries";
  }

  if (tab === "products") return "products";

  return view;
}

function exportMenuItems(tab: string) {
  if (tab === "products") {
    return [{ key: "xlsx", label: "Full report (Excel)" }];
  }

  if (tab === "volume") {
    return [
      { key: "csv", label: "Time series (CSV)" },
      { key: "xlsx", label: "Full report (Excel)" },
    ];
  }

  return [
    { key: "csv", label: "Download CSV" },
    { key: "xlsx", label: "Download Excel" },
  ];
}

function LoadingCard() {
  return (
    <Card>
      <Skeleton active paragraph={{ rows: 8 }} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPageView() {
  const today = dateToday();
  const defaultFrom = dayjs(today)
    .subtract(DEFAULT_RANGE_DAYS, "day")
    .format("YYYY-MM-DD");

  const [search, setSearch] = useSearchParams({
    from: defaultFrom,
    to: today,
    bucket: "Month",
    tab: "executive",
  });

  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const scope = `${user?.userDTO.id ?? ""}:stored-currencies-v2`;

  const canExport =
    hasPermission(Permission.CanViewAnalytics) &&
    hasPermission(Permission.CanExportAnalytics);

  const [filtersOpen, setFiltersOpen] = useState(false);

  // ----- URL state -----

  const params = useMemo<AnalyticsParams>(
    () => ({
      from: search.get("from") ?? defaultFrom,
      to: search.get("to") ?? today,
      bucket: search.get("bucket") ?? "Month",
      brandId: search.get("brandId") || undefined,
      categoryId: search.get("categoryId") || undefined,
      partnerId: search.get("partnerId") || undefined,
      sortBy: search.get("sortBy") ?? "revenue",
      dimension: search.get("dimension") ?? "category",
      stage: search.get("stage") || undefined,
      top: search.get("top") ?? "10",
      inactiveDays: search.get("inactiveDays") ?? "60",
    }),
    [search, today, defaultFrom],
  );

  const productParams = useMemo<AnalyticsParams>(
    () => ({
      ...params,
      search: search.get("skuSearch") || undefined,
      warehouseId: search.get("warehouseId") || undefined,
      productSort: search.get("productSort") ?? "units",
      stockView: search.get("stockView") ?? "all",
    }),
    [params, search],
  );

  const section =
    ANALYTICS_SECTIONS.find((item) => item.key === search.get("tab")) ??
    ANALYTICS_SECTIONS[0];

  const tab = section.key;

  const viewParam = search.get("view") ?? "";
  const view = PARTNER_VIEWS.includes(viewParam) ? viewParam : "partners";

  /** Reads a 1-based page number from the URL, clamped to the 10,000-row cap. */
  const page = (key: string) =>
    Math.max(1, Math.min(401, Math.floor(Number(search.get(key))) || 1));

  const update: UpdateSearch = (values, reset = true) => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);

      if (!next.has("from")) next.set("from", String(params.from));
      if (!next.has("to")) next.set("to", String(params.to));

      if (reset) {
        PAGE_KEYS.forEach((key) => next.delete(key));
        next.delete("debtPartner");
      }

      Object.entries(values).forEach(([key, value]) => {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      });

      return next;
    });
  };

  const openPartner = (partnerId: string) =>
    update({ detail: partnerId, detailPage: undefined }, false);

  // ----- Reports -----

  const reports = useAnalyticsReports({
    scope,
    tab,
    view,
    params,
    productParams,
    partnerPage: page("page"),
  });

  const { active } = reports;
  const report = active.data;

  // ----- Export -----

  const [exporting, setExporting] = useState(false);
  const exportAbort = useRef<AbortController>();

  // Cancel any in-flight export on unmount or when the filters change.
  useEffect(() => () => exportAbort.current?.abort(), []);
  useEffect(() => {
    exportAbort.current?.abort();
    setExporting(false);
  }, [search.toString()]);

  async function exportFile(format: AnalyticsExportFormat) {
    exportAbort.current?.abort();

    const controller = new AbortController();
    exportAbort.current = controller;
    setExporting(true);

    const resource = exportResource(tab, format, view);
    const exportParams = tab === "products" ? productParams : params;

    try {
      await downloadAnalytics(
        resource,
        format,
        exportParams,
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted) void message.error(analyticsError(error));
    } finally {
      if (exportAbort.current === controller) setExporting(false);
    }
  }

  // ----- Filter handlers -----

  function handleDateChange(dates: [Dayjs | null, Dayjs | null] | null) {
    if (!dates?.[0] || !dates[1]) return;

    const [start, end] = dates;
    const yearly = params.bucket === "Year";
    const earliest = yearly
      ? end.subtract(5, "year").add(1, "day")
      : end.subtract(365, "day");

    if (start.isBefore(earliest, "day") || start.year() < 2000) {
      void message.warning(
        yearly
          ? "Choose at most five years, starting in 2000 or later."
          : "Choose at most 366 days, or select Year for a longer range.",
      );
      return;
    }

    update({ from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") });
  }

  function handleBucketChange(value: string) {
    const rangeDays = dayjs(String(params.to)).diff(
      dayjs(String(params.from)),
      "day",
    );

    if (value !== "Year" && rangeDays >= 366) {
      void message.warning(
        "Shorten the date range to 366 days before selecting this bucket.",
      );
      return;
    }

    update({ bucket: value });
  }

  const sortOptions = [
    { value: "revenue", label: "Net order value" },
    { value: "orders", label: "Order count" },
    ...(tab === "partners"
      ? [{ value: "last_order", label: "Last order" }]
      : []),
  ];

  const sharedFilters = [
    { key: "brandId", dimension: "brand", label: "Brand" },
    { key: "categoryId", dimension: "category", label: "Category" },
    { key: "partnerId", dimension: "partner", label: "Partner" },
    ...(tab === "partners" && view !== "concentration"
      ? [{ key: "stage", dimension: "stage", label: "Stage" }]
      : []),
  ].filter((item) => !!params[item.key]);

  // ----- Render -----

  function renderHeader() {
    return (
      <header className="analytics-header">
        <Typography.Title level={3} className="!m-0">
          {section.label}
        </Typography.Title>

        <Typography.Text type="secondary">
          {section.description}
        </Typography.Text>

        {report && (
          <div className="analytics-observed">
            {tab === "executive"
              ? "Fixed business windows"
              : `${report.from} to ${report.to}`}
            {" · Report generated "}
            {watTimestamp(report.generatedAtUtc)} WAT
          </div>
        )}
      </header>
    );
  }

  function renderToolbar() {
    return (
      <div className="analytics-toolbar">
        {tab === "executive" ? (
          <Typography.Text type="secondary">
            All partners and products · refreshes every minute
          </Typography.Text>
        ) : (
          <>
            <div className="w-full sm:w-72">
              <label className="mb-1 block text-sm">Date range (WAT)</label>
              <DatePicker.RangePicker
                aria-label="Analytics date range in WAT"
                className="w-full"
                allowClear={false}
                value={[dayjs(String(params.from)), dayjs(String(params.to))]}
                onChange={handleDateChange}
              />
            </div>

            <Button
              icon={<FilterOutlined aria-hidden />}
              aria-expanded={filtersOpen}
              aria-controls="analytics-filters"
              onClick={() => setFiltersOpen((value) => !value)}
            >
              Filters
              {sharedFilters.length ? ` (${sharedFilters.length})` : ""}
            </Button>
          </>
        )}

        <div className="analytics-toolbar-actions">
          <Button
            icon={<ReloadOutlined aria-hidden />}
            loading={active.isFetching}
            onClick={() =>
              void queryClient.invalidateQueries({
                queryKey: ["analytics", scope],
              })
            }
          >
            Reload
          </Button>

          {"exportable" in section && section.exportable && canExport && (
            <Dropdown
              menu={{
                items: exportMenuItems(tab),
                onClick: ({ key }) =>
                  void exportFile(key as AnalyticsExportFormat),
              }}
              disabled={!report || active.isError || exporting}
            >
              <Button
                icon={<DownloadOutlined aria-hidden />}
                loading={exporting}
              >
                Export report
              </Button>
            </Dropdown>
          )}
        </div>
      </div>
    );
  }

  function renderFilterPanel() {
    return (
      <div
        id="analytics-filters"
        className="analytics-filter-panel"
        hidden={!filtersOpen}
      >
        <div className="grid items-end gap-4 md:grid-cols-3">
          <Lookup
            dimension="brand"
            value={params.brandId as string | undefined}
            onChange={(id) => update({ brandId: id })}
            scope={scope}
          />
          <Lookup
            dimension="category"
            value={params.categoryId as string | undefined}
            onChange={(id) => update({ categoryId: id })}
            scope={scope}
          />
          <Lookup
            dimension="partner"
            value={params.partnerId as string | undefined}
            onChange={(id) => update({ partnerId: id })}
            scope={scope}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {tab !== "partners" && (
            <>
              <span>
                {RANGE_ONLY_TABS.includes(tab) ? "Date-range mode" : "Group by"}
              </span>
              <Select
                aria-label="Time bucket"
                value={params.bucket as string}
                options={BUCKET_OPTIONS}
                onChange={handleBucketChange}
              />
            </>
          )}

          {tab === "volume" && (
            <>
              <span>Growth</span>
              <Select
                aria-label="Growth dimension"
                value={params.dimension}
                options={GROWTH_DIMENSION_OPTIONS}
                onChange={(value) => update({ dimension: String(value) })}
              />
            </>
          )}

          {!UNSORTED_TABS.includes(tab) && (
            <>
              <span>Sort by</span>
              <Select
                aria-label="Sort analytics"
                className="min-w-36"
                value={params.sortBy}
                options={sortOptions}
                onChange={(value) => update({ sortBy: String(value) })}
              />
            </>
          )}

          <Button
            onClick={() =>
              update({
                brandId: undefined,
                categoryId: undefined,
                partnerId: undefined,
                stage: undefined,
              })
            }
          >
            Clear shared filters
          </Button>
        </div>
      </div>
    );
  }

  function renderFilterChips() {
    if (!sharedFilters.length) return null;

    return (
      <div className="analytics-filter-chips" aria-label="Active filters">
        {sharedFilters.map((item) => (
          <ActiveFilter
            key={item.key}
            dimension={item.dimension}
            label={item.label}
            value={String(params[item.key])}
            scope={scope}
            remove={() => update({ [item.key]: undefined })}
          />
        ))}
      </div>
    );
  }

  function renderReport() {
    if (active.isError) {
      return (
        <AnalyticsError
          error={active.error}
          retry={() => void active.refetch()}
        />
      );
    }

    if (active.isPending) return <LoadingCard />;

    const {
      executive,
      temporal,
      credit,
      overview,
      behaviour,
      geography,
      products,
      partners,
      concentration,
    } = reports;

    switch (tab) {
      case "executive":
        return (
          executive.data && (
            <AnalyticsExecutivePanel
              data={executive.data.data}
              navigate={update}
            />
          )
        );

      case "volume":
        return (
          overview.data && (
            <AnalyticsVolumePanel
              overview={overview.data.data}
              params={params}
              scope={scope}
              page={page}
              update={update}
            />
          )
        );

      case "partners":
        if (view === "concentration") {
          return (
            concentration.data && (
              <ConcentrationReport
                concentration={concentration.data.data}
                top={params.top}
                openPartner={openPartner}
              />
            )
          );
        }

        return (
          partners.data && (
            <PartnerList
              partners={partners.data.data}
              view={view}
              currentPage={page("page")}
              openPartner={openPartner}
              update={update}
            />
          )
        );

      case "behaviour":
        return (
          behaviour.data && (
            <AnalyticsBehaviourPanel
              data={behaviour.data.data}
              params={params}
              scope={scope}
              dimension={
                search.get("cancellationDimension") === "partner"
                  ? "partner"
                  : "product"
              }
              cancellationPage={page("cancellationPage")}
              cartPage={page("cartPage")}
              update={update}
            />
          )
        );

      case "geography":
        return (
          geography.data && (
            <AnalyticsGeographyPanel
              data={geography.data.data}
              params={params}
              scope={scope}
              zone={search.get("geoZone") || undefined}
              state={search.get("geoState") || undefined}
              categoryPage={page("geoCategoryPage")}
              update={update}
            />
          )
        );

      case "products":
        return (
          products.data && (
            <AnalyticsProductsPanel
              data={products.data.data}
              generatedAt={products.data.generatedAtUtc}
              params={productParams}
              scope={scope}
              performancePage={page("productPage")}
              stockPage={page("stockPage")}
              detailKey={search.get("skuDetail") || undefined}
              update={update}
            />
          )
        );

      case "temporal":
        return (
          temporal.data && (
            <AnalyticsTemporalPanel
              key={JSON.stringify(params)}
              data={temporal.data.data}
              openPartner={openPartner}
            />
          )
        );

      case "credit":
        return (
          credit.data && (
            <AnalyticsCreditPanel
              data={credit.data.data}
              params={params}
              scope={scope}
              partnerPage={page("creditPartnerPage")}
              debtPage={page("debtPage")}
              debtBucket={search.get("debtBucket") || "all"}
              debtPartner={search.get("debtPartner") || undefined}
              debtOrderPage={page("debtOrderPage")}
              update={update}
            />
          )
        );
    }
  }

  function renderMethodology() {
    return (
      <>
        <Typography.Text type="secondary" className="text-xs">
          Net order value includes eligible unpaid orders. USD is unavailable
          where saved dollar amounts are incomplete.
        </Typography.Text>

        <details className="analytics-methodology">
          <summary>How this is calculated</summary>
          <p>
            Net order value excludes pending, failed and cancelled orders.
            Discounts are allocated across items. AOV uses revenue-eligible
            orders. Dates and partner recency use WAT. NGN and USD use saved
            checkout amounts; current reference rates do not recalculate these
            values. Sorting, shares and growth use NGN. Results and reference
            rates may be cached for five minutes.
          </p>
        </details>
      </>
    );
  }

  return (
    <AnalyticsWorkspace
      section={tab}
      onChange={(value) =>
        update({ tab: value, detail: undefined, skuDetail: undefined })
      }
    >
      {renderHeader()}

      <Card>
        {renderToolbar()}

        {tab !== "executive" && (
          <>
            {renderFilterPanel()}
            {renderFilterChips()}
          </>
        )}
      </Card>

      {tab === "partners" && (
        <PartnerReportControls view={view} params={params} update={update} />
      )}

      {renderReport()}

      {!OWN_METHODOLOGY_TABS.includes(tab) && renderMethodology()}

      <PartnerDetail
        id={search.get("detail") || undefined}
        params={{ ...params, page: page("detailPage") }}
        scope={scope}
        onClose={() =>
          update({ detail: undefined, detailPage: undefined }, false)
        }
        onPageChange={(value) => update({ detailPage: String(value) }, false)}
      />
    </AnalyticsWorkspace>
  );
}
