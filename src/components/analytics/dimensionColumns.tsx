import type { TableColumnsType } from "antd";
import type {
  AnalyticsDimension,
  AnalyticsExchangeRates,
} from "@/lib/analytics";
import { percent } from "@/lib/analyticsFormat";
import { MoneyValue } from "./MoneyValue";
import { RateValue } from "./RateValue";

/** Brand and category rows have no id for "uncategorised". */
export const dimensionRowKey = (row: { id: string | null }) =>
  row.id ?? "uncategorised";

/** Columns for brand and category breakdown tables. */
export const dimensionColumns: TableColumnsType<AnalyticsDimension> = [
  { title: "Name", dataIndex: "name" },
  { title: "Orders", dataIndex: "orderCount", align: "right" },
  {
    title: "Net order value",
    dataIndex: "revenueNaira",
    align: "right",
    render: (value: number, row) => (
      <MoneyValue naira={value} usd={row.revenueUsd} />
    ),
  },
  {
    title: "Exchange rate",
    dataIndex: "exchangeRates",
    render: (rates: AnalyticsExchangeRates | null) => (
      <RateValue rates={rates} />
    ),
  },
  {
    title: "Share (NGN)",
    dataIndex: "share",
    align: "right",
    render: percent,
  },
];
