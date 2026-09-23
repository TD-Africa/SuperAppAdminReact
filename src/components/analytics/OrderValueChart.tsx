import { Empty } from "antd";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPoint } from "@/lib/analytics";
import { compact } from "@/lib/analyticsFormat";
import { MoneyValue } from "./MoneyValue";

const VALUE_COLOR = "#800020";
const ORDERS_COLOR = "#2563eb";

function PointTooltip({
  active,
  point,
  label,
}: {
  active?: boolean;
  point?: AnalyticsPoint;
  label: string;
}) {
  if (!active || !point) return null;

  return (
    <div className="rounded border bg-white p-3 shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      <MoneyValue naira={point.revenueNaira} usd={point.revenueUsd} />
      <div className="mt-1">Orders: {point.orderCount.toLocaleString()}</div>
    </div>
  );
}

/** Net order value (line) and order count (bars) per WAT period. */
export function OrderValueChart({ points }: { points: AnalyticsPoint[] }) {
  if (!points.length) return <Empty description="No periods in this range" />;

  const showDots = points.length < 12;

  return (
    <div
      className="h-80 min-w-0 overflow-x-auto"
      tabIndex={0}
      role="img"
      aria-label="Orders and net order value by WAT period"
    >
      <div className="h-full min-w-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            accessibilityLayer
            data={points}
            margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="periodStart" minTickGap={30} />
            <YAxis yAxisId="value" tickFormatter={compact} />
            <YAxis yAxisId="orders" orientation="right" allowDecimals={false} />
            <Tooltip
              content={({ active, payload, label }) => (
                <PointTooltip
                  active={active}
                  point={payload?.[0]?.payload}
                  label={String(label ?? "")}
                />
              )}
            />
            <Legend />
            <Line
              yAxisId="value"
              dataKey="revenueNaira"
              name="Net order value (NGN)"
              stroke={VALUE_COLOR}
              strokeWidth={2}
              dot={showDots}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="orders"
              dataKey="orderCount"
              name="Orders"
              fill={ORDERS_COLOR}
              fillOpacity={0.25}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
