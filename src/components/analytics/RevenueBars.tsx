import { money } from "@/lib/analyticsFormat";
import { ComparisonBars } from "./ComparisonBars";

interface RevenueRow {
  revenueNaira: number;
  name?: string;
  companyName?: string;
}

/** Net order value (NGN) per row; `nameKey` picks the field used as the label. */
export function RevenueBars<T extends RevenueRow>({
  data,
  nameKey,
}: {
  data: T[];
  nameKey: "name" | "companyName";
}) {
  const rows = data.map((row) => ({
    name: String(row[nameKey]),
    revenueNaira: row.revenueNaira,
  }));

  return (
    <ComparisonBars
      rows={rows}
      series={[{ key: "revenueNaira", label: "Net order value (NGN)" }]}
      label="Net order value by name; exact values and USD amounts in the table below"
      format={money}
    />
  );
}
