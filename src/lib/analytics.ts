import axios from "axios";
import { http } from "./api";
import type { ApiResult } from "./types";

export interface AnalyticsExchangeRates {
  minimum: number | null;
  maximum: number | null;
  source:
    | "recorded"
    | "current_brand"
    | "current_base"
    | "mixed"
    | "unavailable";
}

export interface AnalyticsReport<T> {
  from: string;
  to: string;
  generatedAtUtc: string;
  data: T;
}

export interface AnalyticsPage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AnalyticsSummary {
  ordersTotal: number;
  revenueOrdersTotal: number;
  revenueNairaTotal: number;
  averageOrderValueNaira: number;
  distinctPartnersInWindow: number;
  revenueUsdTotal: number | null;
  averageOrderValueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsPoint {
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  revenueNaira: number;
  aov: number;
  revenueUsd: number | null;
  aovUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsDimension {
  id: string | null;
  name: string;
  orderCount: number;
  revenueNaira: number;
  share: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  exchangeRates: AnalyticsExchangeRates;
}

export interface AnalyticsGrowth {
  id: string | null;
  name: string;
  currentRevenue: number;
  previousRevenue: number;
  deltaPct: number | null;
  currentRevenueUsd: number | null;
  previousRevenueUsd: number | null;
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary;
  timeseries: AnalyticsPoint[];
  brands: AnalyticsPage<AnalyticsDimension>;
  categories: AnalyticsPage<AnalyticsDimension>;
  growth: AnalyticsPage<AnalyticsGrowth>;
}

export interface AnalyticsPartner {
  partnerId: string;
  companyName: string;
  orderCount: number;
  revenueNaira: number;
  aov: number;
  firstOrderAt: string;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  lifecycleStage: string;
  firstOrderRevenue: number | null;
  ordersSince: number;
  avgIntervalDaysBefore: number | null;
  lifetimeRevenue: number;
  revenueUsd: number | null;
  aovUsd: number | null;
  firstOrderRevenueUsd: number | null;
  lifetimeRevenueUsd: number | null;
  missingUsdLineCount: number;
  lifetimeMissingUsdLineCount: number;
  exchangeRates: AnalyticsExchangeRates | null;
}

export interface AnalyticsConcentrationRow {
  rank: number;
  partnerId: string;
  companyName: string;
  revenueNaira: number;
  cumulativeShare: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  exchangeRates: AnalyticsExchangeRates;
}

export interface AnalyticsConcentration {
  items: AnalyticsConcentrationRow[];
  overallRevenue: number;
  topNShare: number;
  overallRevenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsRecentOrder {
  id: string;
  orderReference: string;
  placedAt: string;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  exchangeRates: AnalyticsExchangeRates;
}

export interface AnalyticsDetail {
  partner: AnalyticsPartner;
  timeseries: AnalyticsPoint[];
  brands: AnalyticsPage<AnalyticsDimension>;
  categories: AnalyticsPage<AnalyticsDimension>;
  recentOrders: AnalyticsRecentOrder[];
  reactivated: boolean;
}

export interface AnalyticsLookup {
  id: string;
  name: string;
}

export type AnalyticsParams = Record<string, string | number | undefined>;

/** Merges values into the page URL; `reset` (default true) sends every pager back to page 1. */
export type UpdateSearch = (
  values: Record<string, string | undefined>,
  reset?: boolean,
) => void;

export interface AnalyticsBehaviourSummary {
  ordersPlaced: number;
  completedOrders: number;
  cancelledOrders: number;
  otherOrders: number;
  completionRate: number | null;
  cancellationRate: number | null;
}

export interface AnalyticsBehaviourPoint {
  periodStart: string;
  ordersPlaced: number;
  completedOrders: number;
  cancelledOrders: number;
  cancellationRate: number | null;
}

export interface AnalyticsPaymentTiming {
  paymentMethod: string;
  eligibleOrders: number;
  ordersWithRecordedPayment: number;
  paidOrdersWithoutTiming: number;
  ordersWithoutRecordedPayment: number;
  averageHours: number | null;
  medianHours: number | null;
  p90Hours: number | null;
}

export interface AnalyticsBehaviour {
  summary: AnalyticsBehaviourSummary;
  timeseries: AnalyticsBehaviourPoint[];
  paymentTiming: AnalyticsPaymentTiming[];
}

export interface AnalyticsCancellation {
  id: string;
  name: string;
  ordersPlaced: number;
  cancelledOrders: number;
  cancellationRate: number;
}

export interface AnalyticsCart {
  cartId: string;
  partnerId: string;
  companyName: string;
  lastItemAddedAt: string;
  daysSinceLastAddition: number;
  productCount: number;
  units: number;
}

export interface AnalyticsCartSnapshot {
  inactivityThresholdHours: number;
  openCarts: number;
  potentiallyAbandonedCarts: number;
  affectedPartners: number;
  carts: AnalyticsPage<AnalyticsCart>;
}

/** Analytics results are cached server-side for five minutes, so match that on the client. */
export const ANALYTICS_STALE_TIME = 5 * 60 * 1000;

export const ANALYTICS_PAGE_SIZE = 25;

/** Paging is capped at 10,000 rows (plus one page so the cap itself is reachable). */
export const ANALYTICS_MAX_ROWS = 10_000 + ANALYTICS_PAGE_SIZE;

const EXPORT_CONTENT_TYPES = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export type AnalyticsExportFormat = keyof typeof EXPORT_CONTENT_TYPES;

export function analyticsError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 403) {
      return "Your role does not have the required analytics permission. Contact an administrator.";
    }

    if (status === 429) {
      return "Analytics is busy. Please retry shortly.";
    }

    const body = error.response?.data;
    if (body && typeof body.message === "string") return body.message;
    if (body?.errors) return Object.values(body.errors).flat().join(" ");
  }

  return error instanceof Error
    ? error.message
    : "Analytics could not be loaded. Please retry.";
}

export async function getAnalytics<T>(
  resource: string,
  params: AnalyticsParams,
  signal?: AbortSignal,
): Promise<T> {
  const response = await http.get<ApiResult<T>>(`Analytics/${resource}`, {
    params,
    signal,
  });

  if (!response.data.status || response.data.data == null) {
    throw new Error(response.data.message ?? "Analytics could not be loaded.");
  }

  return response.data.data;
}

export async function downloadAnalytics(
  resource: string,
  format: AnalyticsExportFormat,
  params: AnalyticsParams,
  signal: AbortSignal,
) {
  try {
    const response = await http.get<Blob>(`Analytics/${resource}/export`, {
      params: { ...params, format, page: 1 },
      responseType: "blob",
      signal,
    });

    if (!response.data.type.startsWith(EXPORT_CONTENT_TYPES[format])) {
      throw new Error("The server did not return an export file.");
    }

    // The filename is deliberately constructed from allowlisted resource/format and ISO dates.
    const name = resource === "overview" ? "volume-revenue" : resource;
    const url = URL.createObjectURL(response.data);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analytics-${name}-${params.from}-${params.to}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    // Blob error responses hide the server's JSON message; parse it so analyticsError can read it.
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* Keep the status-based message. */
      }
    }
    throw error;
  }
}

export interface AnalyticsGeographySummary {
  registeredPartners: number;
  mappedPartners: number;
  orderingPartners: number;
  orderCount: number;
  mappedOrders: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsRegion {
  key: string;
  name: string;
  zone: string | null;
  registeredPartners: number;
  orderingPartners: number;
  orderingRate: number | null;
  orderCount: number;
  revenueNaira: number;
  revenueShare: number | null;
  revenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsGeography {
  summary: AnalyticsGeographySummary;
  zones: AnalyticsRegion[];
  states: AnalyticsRegion[];
}

export interface AnalyticsRegionalCategory {
  id: string | null;
  name: string;
  orderCount: number;
  revenueNaira: number;
  revenueShare: number | null;
  revenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsProductSummary {
  skusOrdered: number;
  orderCount: number;
  orderingPartners: number;
  orderedUnits: number;
  chargedUnits: number;
  freeUnits: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  stockedSkus: number;
  stockedSkusWithoutOrders: number;
  stockUnavailableSkus: number;
  missingSkuCount: number;
  invalidQuantityLineCount: number;
}

export interface AnalyticsProductRow {
  key: string;
  sku: string | null;
  name: string;
  productRecordCount: number;
  orderCount: number;
  orderingPartners: number;
  orderedUnits: number;
  chargedUnits: number;
  freeUnits: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  lastOrderedAt: string | null;
  remainingStock: number | null;
  stockStatus:
    | "recorded"
    | "ambiguous_sku"
    | "unavailable"
    | "invalid_stock"
    | "incomplete_stock";
}

export interface AnalyticsProducts {
  summary: AnalyticsProductSummary;
  performance: AnalyticsPage<AnalyticsProductRow>;
  stock: AnalyticsPage<AnalyticsProductRow>;
}

export interface AnalyticsProductPoint {
  periodStart: string;
  orderCount: number;
  orderedUnits: number;
  chargedUnits: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsProductWarehouse {
  warehouseId: string | null;
  name: string;
  orderCount: number;
  orderedUnits: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  remainingStock: number | null;
  stockStatus: AnalyticsProductRow["stockStatus"];
}

export interface AnalyticsProductDetail {
  product: AnalyticsProductRow;
  timeseries: AnalyticsProductPoint[];
  warehouses: AnalyticsProductWarehouse[];
}

export interface AnalyticsExecutivePeriod {
  fromUtc: string;
  toUtc: string;
  orders: number;
  partners: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsExecutivePartner {
  partnerId: string;
  companyName: string;
  revenueNaira: number;
  previousRevenueNaira: number;
  changePercent: number | null;
  revenueUsd: number | null;
  previousRevenueUsd: number | null;
}

export interface AnalyticsExecutive {
  asOfUtc: string;
  today: AnalyticsExecutivePeriod;
  lastWeekDay: AnalyticsExecutivePeriod;
  twoWeeksAgoDay: AnalyticsExecutivePeriod;
  monthToDate: AnalyticsExecutivePeriod;
  previousMonthToDate: AnalyticsExecutivePeriod;
  activeWeek: AnalyticsExecutivePeriod;
  previousWeek: AnalyticsExecutivePeriod;
  completedDays: number;
  daysInMonth: number;
  dailyRunRateNaira: number | null;
  projectedRevenueNaira: number | null;
  topPartners: AnalyticsExecutivePartner[];
}

export interface AnalyticsTemporalWeekday {
  weekday: number;
  observedDays: number;
  orders: number;
  partners: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  averageOrders: number | null;
}

export interface AnalyticsTemporalSlot extends AnalyticsTemporalWeekday {
  hour: number;
}

export interface AnalyticsTemporalCycle {
  period: "month" | "quarter";
  periodStart: string;
  observedDays: number;
  calendarDays: number;
  endDays: number;
  orders: number;
  endOrders: number;
  endShare: number | null;
  endDailyOrders: number | null;
  otherDailyOrders: number | null;
  dailyOrderRatio: number | null;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
}

export interface AnalyticsTemporalCadence {
  partnerId: string;
  companyName: string;
  orders: number;
  previousOrders: number;
  medianIntervalDays: number;
  previousMedianIntervalDays: number | null;
}

export interface AnalyticsTemporal {
  observedThroughUtc: string;
  previousFromUtc: string;
  completedDays: number;
  summary: AnalyticsSummary;
  heatmap: AnalyticsTemporalSlot[];
  weekdays: AnalyticsTemporalWeekday[];
  cycles: AnalyticsTemporalCycle[];
  cadence: AnalyticsTemporalCadence[];
}

export interface AnalyticsCreditMix {
  key: string;
  name: string;
  orders: number;
  eligibleOrders: number;
  revenueNaira: number;
  revenueUsd: number | null;
  missingUsdLineCount: number;
  poaOrders: number;
  splitPaymentOrders: number;
  requestedDownPaymentNaira: number;
  settledDownPaymentOrders: number;
  ordersWithTiming: number;
  paidWithoutTiming: number;
  withoutPaymentEvidence: number;
  averageFirstPaymentHours: number | null;
  medianFirstPaymentHours: number | null;
  p90FirstPaymentHours: number | null;
}

export interface AnalyticsCreditPartner {
  partnerId: string;
  companyName: string;
  currentTerms: string | null;
  currentCreditDays: number | null;
  orderingAccounts: number;
  accountsWithDifferentTerms: number;
  orders: number;
  creditOrders: number;
  revenueNaira: number;
  revenueUsd: number | null;
  eligibleOrders: number;
  ordersWithTiming: number;
  paidWithoutTiming: number;
  withoutPaymentEvidence: number;
  medianFirstPaymentHours: number | null;
}

export interface AnalyticsCredit {
  asOfUtc: string;
  summary: AnalyticsSummary;
  paymentMix: AnalyticsCreditMix[];
  partners: AnalyticsPage<AnalyticsCreditPartner>;
}

export interface AnalyticsDebtSummary {
  orders: number;
  partners: number;
  knownBalanceNaira: number;
  balanceUnavailableOrders: number;
  overdueOrders: number;
  knownOverdueNaira: number;
  missingDueDateOrders: number;
  excludedNonPositiveBalanceOrders: number;
}

export interface AnalyticsDebtBucket {
  key: string;
  name: string;
  orders: number;
  knownBalanceNaira: number;
  balanceUnavailableOrders: number;
}

export interface AnalyticsDebtPartner {
  partnerId: string;
  companyName: string;
  orders: number;
  knownBalanceNaira: number;
  balanceUnavailableOrders: number;
  overdueOrders: number;
  knownOverdueNaira: number;
  missingDueDateOrders: number;
}

export interface AnalyticsDebtOrder {
  orderId: string;
  orderReference: string;
  partnerId: string;
  companyName: string;
  placedAtUtc: string;
  recordedDueDateUtc: string | null;
  daysUntilDue: number | null;
  bucket: string;
  localBalanceNaira: number | null;
  balanceStatus: string;
  recordedPaidNaira: number;
}

export interface AnalyticsDebt {
  asOfUtc: string;
  summary: AnalyticsDebtSummary;
  buckets: AnalyticsDebtBucket[];
  partners: AnalyticsPage<AnalyticsDebtPartner>;
}
