export function formatNumber(n: number | null | undefined, locale = "en-US") {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat(locale).format(n);
}

export function formatCurrency(
  n: number | null | undefined,
  currency: "USD" | "NGN" = "USD",
) {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}
