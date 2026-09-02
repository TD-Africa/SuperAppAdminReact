import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  TagsOutlined,
  GroupOutlined,
  ShopOutlined,
  ContainerOutlined,
  CustomerServiceOutlined,
  StarOutlined,
  MailOutlined,
  SolutionOutlined,
  UserSwitchOutlined,
  KeyOutlined,
  PercentageOutlined,
  HistoryOutlined,
  AccountBookOutlined,
  UsergroupAddOutlined,
  GiftOutlined,
  SettingOutlined,
  WalletOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";

interface NavLeaf {
  type: "leaf";
  to: string;
  label: string;
  icon: React.ReactNode;
  permission: Permission;
  /** If true, only exact match on pathname counts as active (for the home route). */
  exact?: boolean;
}

interface NavGroup {
  type: "group";
  key: string;
  label: string;
  icon: React.ReactNode;
  children: NavLeaf[];
}

type NavNode = NavLeaf | NavGroup;

const NAV_TREE: NavNode[] = [
  { type: "leaf", to: "/", label: "Home", icon: <DashboardOutlined />, permission: Permission.CanViewDashboard, exact: true },
  { type: "leaf", to: "/products", label: "Products", icon: <AppstoreOutlined />, permission: Permission.CanViewProducts },
  { type: "leaf", to: "/orders", label: "Orders", icon: <ShoppingCartOutlined />, permission: Permission.CanViewOrders },
  { type: "leaf", to: "/debt-collection", label: "Debt Collection", icon: <AccountBookOutlined />, permission: Permission.CanViewOrders },
  { type: "leaf", to: "/wallets", label: "Wallets", icon: <WalletOutlined />, permission: Permission.CanViewTransactions },
  { type: "leaf", to: "/customers", label: "Customers", icon: <TeamOutlined />, permission: Permission.CanViewUser },
  { type: "leaf", to: "/employees", label: "Employees", icon: <UsergroupAddOutlined />, permission: Permission.CanViewDashboard },
  { type: "leaf", to: "/cac-data", label: "CAC Data", icon: <IdcardOutlined />, permission: Permission.CanViewUser },
  { type: "leaf", to: "/kyc", label: "KYC", icon: <SafetyCertificateOutlined />, permission: Permission.CanEditUser },
  {
    type: "group",
    key: "promos",
    label: "Promos",
    icon: <PercentageOutlined />,
    children: [
      { type: "leaf", to: "/promos", label: "All Promos", icon: <PercentageOutlined />, permission: Permission.CanViewPromos },
      { type: "leaf", to: "/promos-audit-logs", label: "Audit Logs", icon: <HistoryOutlined />, permission: Permission.CanViewPromos },
    ],
  },
  { type: "leaf", to: "/coupons", label: "Coupons", icon: <GiftOutlined />, permission: Permission.CanViewPromos },
  { type: "leaf", to: "/product-groups", label: "Product Groups", icon: <GroupOutlined />, permission: Permission.CanViewProductGroup },
  {
    type: "group",
    key: "brands",
    label: "Brands",
    icon: <ShopOutlined />,
    children: [
      { type: "leaf", to: "/brands", label: "All Brands", icon: <ShopOutlined />, permission: Permission.CanViewBrands },
      { type: "leaf", to: "/brand-restrictions", label: "Restrictions", icon: <LockOutlined />, permission: Permission.CanViewBrands },
    ],
  },
  {
    type: "group",
    key: "deals",
    label: "Deals",
    icon: <TagsOutlined />,
    children: [
      { type: "leaf", to: "/deals", label: "All Deals", icon: <TagsOutlined />, permission: Permission.CanViewBrands },
      { type: "leaf", to: "/deals-audit-logs", label: "Audit Logs", icon: <HistoryOutlined />, permission: Permission.CanViewBrands },
    ],
  },
  { type: "leaf", to: "/warehouses", label: "Warehouses", icon: <ContainerOutlined />, permission: Permission.CanViewWarehouses },
  { type: "leaf", to: "/tickets", label: "Tickets", icon: <CustomerServiceOutlined />, permission: Permission.CanViewTicket },
  { type: "leaf", to: "/ratings", label: "Ratings", icon: <StarOutlined />, permission: Permission.CanViewRatings },
  { type: "leaf", to: "/email-requests", label: "Email Change Requests", icon: <MailOutlined />, permission: Permission.CanViewEmailChangeRequests },
  { type: "leaf", to: "/request-appeals", label: "Request Appeals", icon: <SolutionOutlined />, permission: Permission.CanViewRequestAppeals },
  { type: "leaf", to: "/admin-users", label: "Admin Users", icon: <UserSwitchOutlined />, permission: Permission.CanViewSubUser },
  { type: "leaf", to: "/roles", label: "Roles", icon: <KeyOutlined />, permission: Permission.CanViewRoles },
  { type: "leaf", to: "/transaction-settings", label: "Transaction Settings", icon: <SettingOutlined />, permission: Permission.CanChangeSettings },
];

function collectLeaves(nodes: NavNode[]): NavLeaf[] {
  return nodes.flatMap((node) => (node.type === "leaf" ? [node] : node.children));
}

function buildMenuItems(
  nodes: NavNode[],
  hasPermission: (permission: Permission) => boolean,
): MenuProps["items"] {
  return nodes.flatMap((node) => {
    if (node.type === "leaf") {
      if (!hasPermission(node.permission)) return [];
      return [{ key: node.to, icon: node.icon, label: node.label }];
    }

    const children = node.children
      .filter((child) => hasPermission(child.permission))
      .map((child) => ({ key: child.to, icon: child.icon, label: child.label }));

    // Drop a group entirely rather than render an empty expander.
    if (children.length === 0) return [];

    return [{ key: node.key, icon: node.icon, label: node.label, children }];
  });
}

// Which group (if any) owns the current path, so it can be expanded on load or
// after a deep link. Derived from the tree rather than a hardcoded path list.
function groupKeyForPath(pathname: string): string | null {
  for (const node of NAV_TREE) {
    if (node.type !== "group") continue;
    if (node.children.some((child) => pathname.startsWith(child.to))) {
      return node.key;
    }
  }
  return null;
}

interface NavMenuProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavMenu({ collapsed, onNavigate }: NavMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const items: MenuProps["items"] = useMemo(
    () => buildMenuItems(NAV_TREE, hasPermission),
    [hasPermission],
  );

  const visibleLeaves = useMemo(
    () => collectLeaves(NAV_TREE).filter((leaf) => hasPermission(leaf.permission)),
    [hasPermission],
  );

  const activeKey = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return "/";
    // Pick the longest matching prefix among available nav leaves.
    const matches = visibleLeaves
      .filter((leaf) => !leaf.exact && path.startsWith(leaf.to))
      .sort((a, b) => b.to.length - a.to.length);
    return matches[0]?.to ?? "/";
  }, [location.pathname, visibleLeaves]);

  useEffect(() => {
    const groupKey = groupKeyForPath(location.pathname);
    if (!groupKey) return;
    setOpenKeys((prev) => (prev.includes(groupKey) ? prev : [...prev, groupKey]));
  }, [location.pathname]);

  function onClick({ key }: { key: string }) {
    // Group headers use a bare key (e.g. "brands") and only toggle.
    if (!key.startsWith("/")) return;
    navigate(key);
    onNavigate?.();
  }

  return (
    <>
      <div
        className={
          collapsed
            ? "flex h-16 items-center justify-center border-b border-sidebar-border"
            : "flex h-16 items-center justify-center border-b border-sidebar-border px-3"
        }
      >
        <img
          src="/logo.png"
          alt="TDAfrica SuperApp"
          className={collapsed ? "h-10 w-10 object-contain" : "max-h-12 w-auto object-contain"}
        />
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeKey]}
        openKeys={collapsed ? [] : openKeys}
        onOpenChange={setOpenKeys}
        onClick={onClick}
        items={items}
        inlineCollapsed={collapsed}
        className="border-0 bg-transparent py-3"
      />
    </>
  );
}
