import { Empty } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compact } from "@/lib/analyticsFormat";

interface ComparisonRow {
  name: string;
  [key: string]: string | number | null;
}

interface Series {
  key: string;
  label: string;
  color?: string;
}

const PRIMARY_COLOR = "#800020";
const SECONDARY_COLOR = "#94a3b8";

const number = (value: number) =>
  value.toLocaleString("en-NG", { maximumFractionDigits: 2 });

/** Truncates long category labels so the axis stays readable. */
const shortLabel = (name: string) =>
  name.length > 19 ? `${name.slice(0, 18)}…` : name;

/** Absolute comparisons only; rows may represent a labelled page, never an inferred distribution. */
export function ComparisonBars({
  rows,
  series,
  label,
  format = number,
}: {
  rows: ComparisonRow[];
  series: Series[];
  label: string;
  format?: (value: number) => string;
}) {
  if (!rows.length) return <Empty description="No data for this comparison" />;

  // Grow the chart with the row count; grouped bars need more room per row.
  const rowHeight = series.length > 1 ? 54 : 36;
  const height = Math.max(200, rows.length * rowHeight + 60);

  return (
    <div
      className="analytics-comparison overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={label}
      style={{ height }}
    >
      <div className="h-full min-w-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 18, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#e5e7eb"
            />
            <XAxis type="number" tickFormatter={compact} />
            <YAxis
              type="category"
              dataKey="name"
              width={136}
              interval={0}
              tickFormatter={shortLabel}
            />
            <Tooltip
              formatter={(value: number) => format(value)}
              wrapperStyle={{ maxWidth: "100%" }}
              contentStyle={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
            />
            <Legend />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={
                  item.color ?? (index === 0 ? PRIMARY_COLOR : SECONDARY_COLOR)
                }
                radius={[0, 3, 3, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
