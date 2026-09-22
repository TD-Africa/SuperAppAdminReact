/**
 * Display formatters shared by the analytics pages.
 * Dates are shown in WAT (Africa/Lagos), the timezone the reports are bucketed in.
 */

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});

const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactFormatter = new Intl.NumberFormat("en-NG", {
  notation: "compact",
});

const watDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
});

/** ₦1,234.50 */
export const money = (value: number) => nairaFormatter.format(value);

/** $1,234.50 */
export const dollars = (value: number) => dollarFormatter.format(value);

/** $1,234.50, or "Unavailable" when saved USD amounts are incomplete. */
export const usdMoney = (value: number | null | undefined) =>
  value == null ? "Unavailable" : dollars(value);

/** 12.5% from a 0–1 ratio, or "—" when there is no ratio. */
export const percent = (value: number | null) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

/** 1,234 */
export const count = (value: number) => value.toLocaleString();

/** 1.2M — for chart axes. */
export const compact = (value: number) => compactFormatter.format(value);

/** 19 Sept 2026 */
export const watDate = (value: string) =>
  watDateFormatter.format(new Date(value));

/** 19/09/2026, 13:15:14 */
export const watTimestamp = (value: string) =>
  new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos" });

/** "at_risk" → "at risk" */
export const stageLabel = (value: string) => value.replaceAll("_", " ");
