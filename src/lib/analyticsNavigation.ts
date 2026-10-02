import dayjs from "dayjs";

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

/** Geography has no time grouping; infer its range mode from the selected dates.
 * Other sections infer a compatible default when entering with dates only.
 */
export function resolveAnalyticsBucket(
  from: string,
  to: string,
  requested: string | null,
  automatic: boolean,
): string {
  const fallback = dayjs(to).diff(dayjs(from), "day") > 365 ? "Year" : "Month";
  return automatic ? fallback : requested ?? fallback;
}

/** Section changes inherit dates only. Explicit drill-down values are then applied
 * as new selections; filters from the previous section are never copied across.
 */
export function updateAnalyticsSearch(
  previous: URLSearchParams,
  values: Record<string, string | undefined>,
  current: { from: string; to: string; tab: string },
  reset = true,
): URLSearchParams {
  const switchingSection = !!values.tab && values.tab !== current.tab;
  const next = switchingSection
    ? new URLSearchParams({ from: current.from, to: current.to })
    : new URLSearchParams(previous);

  if (!next.has("from")) next.set("from", current.from);
  if (!next.has("to")) next.set("to", current.to);

  if (reset) {
    PAGE_KEYS.forEach((key) => next.delete(key));
    next.delete("debtPartner");
  }

  Object.entries(values).forEach(([key, value]) => {
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
  });

  return next;
}
