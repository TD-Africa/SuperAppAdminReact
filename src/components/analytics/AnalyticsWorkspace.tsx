import type { ReactNode } from "react";
import { Select, theme } from "antd";
import {
  AppstoreOutlined,
  BarChartOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
  GlobalOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";
import {
  ANALYTICS_SECTIONS,
  type AnalyticsSectionKey,
} from "@/lib/analyticsSections";
import "./analytics.css";

const SECTION_OPTIONS = ANALYTICS_SECTIONS.map((item) => ({
  value: item.key,
  label: item.label,
}));

const SECTION_ICONS: Record<AnalyticsSectionKey, typeof AppstoreOutlined> = {
  executive: AppstoreOutlined,
  volume: BarChartOutlined,
  partners: TeamOutlined,
  behaviour: ShoppingCartOutlined,
  geography: GlobalOutlined,
  products: TagsOutlined,
  temporal: ClockCircleOutlined,
  credit: CreditCardOutlined,
};

/** Analytics shell: section sidebar on desktop, a section picker on mobile. */
export function AnalyticsWorkspace({
  section,
  onChange,
  children,
}: {
  section: AnalyticsSectionKey;
  onChange: (section: string) => void;
  children: ReactNode;
}) {
  const { token } = theme.useToken();

  return (
    <div
      className="analytics-workspace"
      style={{
        fontFamily: token.fontFamily,
        fontSize: token.fontSize,
        lineHeight: token.lineHeight,
      }}
    >
      <aside className="analytics-submenu">
        <div className="analytics-submenu-title">Analytics and insights</div>
        <p className="analytics-submenu-caption">Explore your business</p>
        <nav aria-label="Analytics sections">
          {ANALYTICS_SECTIONS.map((item) => {
            const Icon = SECTION_ICONS[item.key];

            return (
              <button
                key={item.key}
                type="button"
                aria-current={section === item.key ? "page" : undefined}
                onClick={() => onChange(item.key)}
              >
                <Icon aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="analytics-main">
        <div className="analytics-mobile-navigation">
          <label htmlFor="analytics-section">Analytics and insights</label>
          <Select
            id="analytics-section"
            aria-label="Analytics section"
            className="w-full"
            value={section}
            placeholder="Select a report"
            onChange={onChange}
            options={SECTION_OPTIONS}
          />
        </div>

        <div className="analytics-report">{children}</div>
      </div>
    </div>
  );
}
