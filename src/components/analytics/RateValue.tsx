import { Typography } from "antd";
import type { AnalyticsExchangeRates } from "@/lib/analytics";

const RATE_SOURCE_LABELS: Record<AnalyticsExchangeRates["source"], string> = {
  recorded: "Recorded at checkout",
  current_brand: "Brand override (current)",
  current_base: "Base rate (current)",
  mixed: "Mixed rate sources",
  unavailable: "Rate unavailable",
};

const formatRate = (value: number) =>
  value.toLocaleString("en-NG", { maximumFractionDigits: 6 });

/** NGN/USD rate (or min–max range) used for a row, and where it came from. */
export function RateValue({ rates }: { rates: AnalyticsExchangeRates | null }) {
  if (!rates || rates.minimum == null) {
    return <Typography.Text type="secondary">Rate unavailable</Typography.Text>;
  }

  const range =
    rates.minimum === rates.maximum
      ? formatRate(rates.minimum)
      : `${formatRate(rates.minimum)}–${formatRate(rates.maximum!)}`;

  return (
    <div className="min-w-40 text-xs">
      <div>{range} NGN/USD</div>
      <Typography.Text type="secondary">
        {RATE_SOURCE_LABELS[rates.source]}
      </Typography.Text>
    </div>
  );
}
