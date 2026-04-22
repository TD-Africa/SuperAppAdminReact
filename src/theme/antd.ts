import type { ThemeConfig } from "antd";

// Burgundy brand palette. Primary is the canonical #800020; hover/active are
// derived shades that keep the WCAG contrast ratio usable on white surfaces.
const BURGUNDY = {
  50: "#fbf0f2",
  100: "#f2d3d9",
  200: "#e5a8b4",
  300: "#d17b8d",
  400: "#b94d67",
  500: "#9a1e3d",
  600: "#800020",
  700: "#6a001b",
  800: "#550016",
  900: "#3f0010",
} as const;

const GEIST_STACK =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const antdTheme: ThemeConfig = {
  cssVar: { key: "superapp" },
  hashed: false,
  token: {
    colorPrimary: BURGUNDY[600],
    colorPrimaryHover: BURGUNDY[500],
    colorPrimaryActive: BURGUNDY[700],
    colorInfo: BURGUNDY[600],
    colorLink: BURGUNDY[600],
    colorLinkHover: BURGUNDY[500],

    colorSuccess: "#16a34a",
    colorWarning: "#d97706",
    colorError: "#dc2626",

    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,

    fontFamily: GEIST_STACK,
    fontFamilyCode:
      '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 14,

    controlHeight: 38,
    controlHeightSM: 30,
    controlHeightLG: 44,

    wireframe: false,
  },
  components: {
    Button: {
      fontWeight: 500,
      primaryShadow: "0 1px 2px rgba(128, 0, 32, 0.12)",
    },
    Layout: {
      siderBg: "#1a0a0e",
      headerBg: "#ffffff",
      headerHeight: 64,
      headerPadding: "0 24px",
      bodyBg: "#faf7f8",
    },
    Menu: {
      darkItemBg: "transparent",
      darkItemColor: "rgba(255, 255, 255, 0.72)",
      darkItemHoverBg: "rgba(255, 255, 255, 0.08)",
      darkItemHoverColor: "#ffffff",
      darkItemSelectedBg: BURGUNDY[600],
      darkItemSelectedColor: "#ffffff",
      darkSubMenuItemBg: "transparent",
      itemBorderRadius: 8,
      iconSize: 16,
      collapsedIconSize: 18,
    },
    Card: {
      borderRadiusLG: 12,
      headerBg: "transparent",
      headerFontSize: 15,
    },
    Table: {
      headerBg: "#faf5f6",
      headerColor: "#6b2435",
      rowHoverBg: "#fbf0f2",
      borderColor: "#f0e4e7",
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Input: {
      activeShadow: "0 0 0 2px rgba(128, 0, 32, 0.12)",
    },
    Select: {
      optionSelectedBg: BURGUNDY[50],
      optionSelectedColor: BURGUNDY[700],
    },
    Switch: {
      colorPrimary: BURGUNDY[600],
      colorPrimaryHover: BURGUNDY[500],
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Segmented: {
      itemSelectedBg: BURGUNDY[600],
      itemSelectedColor: "#ffffff",
    },
  },
};

export { BURGUNDY };
