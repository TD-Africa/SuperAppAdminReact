export const ANALYTICS_SECTIONS = [
  {
    key: "executive",
    label: "Overview",
    description:
      "Business performance across today, this month and the last seven days.",
  },
  {
    key: "volume",
    label: "Volume & revenue",
    description:
      "Follow order value and volume, then explore the brands and categories behind them.",
    exportable: true,
  },
  {
    key: "partners",
    label: "Partners",
    description:
      "Explore partner activity, lifecycle stages and revenue concentration.",
    exportable: true,
  },
  {
    key: "behaviour",
    label: "Order behaviour & conversion",
    description:
      "Understand current order outcomes, cancellation patterns and cart activity.",
  },
  {
    key: "geography",
    label: "Geography & zones",
    description:
      "Compare regional demand and the coverage of the registered partner network.",
  },
  {
    key: "products",
    label: "Products & SKUs",
    description:
      "Explore SKU performance and compare ordered units with current recorded stock.",
    exportable: true,
  },
  {
    key: "temporal",
    label: "Temporal & behavioural patterns",
    description: "Find ordering patterns by weekday, hour and calendar period.",
  },
  {
    key: "credit",
    label: "Credit & payments",
    description:
      "Review payment choices and timing, alongside a separate current debt snapshot.",
  },
] as const;

export type AnalyticsSectionKey = (typeof ANALYTICS_SECTIONS)[number]["key"];
