import { useQuery } from "@tanstack/react-query";
import { ANALYTICS_STALE_TIME, getAnalytics } from "@/lib/analytics";
import type {
  AnalyticsBehaviour,
  AnalyticsConcentration,
  AnalyticsCredit,
  AnalyticsExecutive,
  AnalyticsGeography,
  AnalyticsOverview,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsPartner,
  AnalyticsProducts,
  AnalyticsReport,
  AnalyticsTemporal,
} from "@/lib/analytics";
import type { AnalyticsSectionKey } from "@/lib/analyticsSections";

/** The overview refreshes itself every minute while it is on screen. */
const EXECUTIVE_REFRESH_MS = 60_000;

interface Options {
  scope: string;
  tab: AnalyticsSectionKey;
  /** Partner report variant: "partners", "new-partners", "inactive" or "concentration". */
  view: string;
  params: AnalyticsParams;
  productParams: AnalyticsParams;
  partnerPage: number;
}

/**
 * Main report query for each analytics tab. Only the open tab's query is
 * enabled; `active` is that query, used by the header, Reload and Export.
 */
export function useAnalyticsReports({
  scope,
  tab,
  view,
  params,
  productParams,
  partnerPage,
}: Options) {
  const executive = useQuery({
    queryKey: ["analytics", scope, "executive"],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsExecutive>>(
        "executive",
        {},
        signal,
      ),
    enabled: tab === "executive",
    staleTime: EXECUTIVE_REFRESH_MS,
    refetchInterval: tab === "executive" ? EXECUTIVE_REFRESH_MS : false,
    retry: false,
  });

  const temporal = useQuery({
    queryKey: ["analytics", scope, "temporal", params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsTemporal>>(
        "temporal",
        params,
        signal,
      ),
    enabled: tab === "temporal",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const credit = useQuery({
    queryKey: ["analytics", scope, "credit-payments", params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsCredit>>(
        "credit-payments",
        params,
        signal,
      ),
    enabled: tab === "credit",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const overview = useQuery({
    queryKey: ["analytics", scope, "overview", params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsOverview>>(
        "overview",
        params,
        signal,
      ),
    enabled: tab === "volume",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const behaviour = useQuery({
    queryKey: ["analytics", scope, "behaviour", params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsBehaviour>>(
        "behaviour",
        params,
        signal,
      ),
    enabled: tab === "behaviour",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const geography = useQuery({
    queryKey: ["analytics", scope, "geography", params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsGeography>>(
        "geography",
        params,
        signal,
      ),
    enabled: tab === "geography",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const products = useQuery({
    queryKey: ["analytics", scope, "products", productParams],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsProducts>>(
        "products",
        productParams,
        signal,
      ),
    enabled: tab === "products",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const partners = useQuery({
    queryKey: ["analytics", scope, view, params, partnerPage],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsPartner>>>(
        view,
        { ...params, page: partnerPage },
        signal,
      ),
    enabled: tab === "partners" && view !== "concentration",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const concentration = useQuery({
    queryKey: ["analytics", scope, "concentration", params],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsConcentration>>(
        "concentration",
        params,
        signal,
      ),
    enabled: tab === "partners" && view === "concentration",
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  const queriesByTab = {
    executive,
    temporal,
    credit,
    volume: overview,
    behaviour,
    geography,
    products,
    partners: view === "concentration" ? concentration : partners,
  };

  return {
    executive,
    temporal,
    credit,
    overview,
    behaviour,
    geography,
    products,
    partners,
    concentration,
    active: queriesByTab[tab],
  };
}
