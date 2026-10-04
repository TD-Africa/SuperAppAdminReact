import { Typography } from "antd";
import { dollars, money } from "@/lib/analyticsFormat";

/** NGN amount with its saved USD equivalent underneath. */
export function MoneyValue({
  naira,
  usd,
}: {
  naira: number;
  usd: number | null;
}) {
  return (
    <div className="whitespace-nowrap">
      <div>{money(naira)}</div>
      <Typography.Text type="secondary" className="text-xs">
        {usd == null ? "USD unavailable" : `USD ${dollars(usd)}`}
      </Typography.Text>
    </div>
  );
}
