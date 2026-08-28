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
  { type: "leaf", to: "/customers", label: "Customers", icon: <TeamOutlined />, permission: Permission.CanViewUser },
  { type: "leaf", to: "/employees", label: "Employees", icon: <UsergroupAddOutlined />, permission: Permission.CanViewDashboard },
  { type: "leaf", to: "/cac-data", label: "CAC Data", icon: <IdcardOutlined />, permission: Permission.CanViewUser },
  { type: "leaf", to: "/kyc", label: "KYC", icon: <SafetyCertificateOutlined />, permission: Permission.CanEditUser },
  { type: "leaf", to: "/promos", label: "Promos", icon: <PercentageOutlined />, permission: Permission.CanViewPromos },
  { type: "leaf", to: "/coupons", label: "Coupons", icon: <GiftOutlined />, permission: Permission.CanViewPromos },
  { type: "leaf", to: "/promos-audit-logs", label: "Promos Audit Logs", icon: <HistoryOutlined />, permission: Permission.CanViewPromos },
  { type: "leaf", to: "/product-groups", label: "Product Groups", icon: <GroupOutlined />, permission: Permission.CanViewProductGroup },
  { type: "leaf", to: "/brands", label: "Brands", icon: <ShopOutlined />, permission: Permission.CanViewBrands },
  {
    type: "group",
    key: "storefront",
    label: "Storefront",
    icon: <ShopOutlined />,
    children: [
      { type: "leaf", to: "/franchise-products", label: "Products", icon: <AppstoreOutlined />, permission: Permission.CanViewProducts },
      { type: "leaf", to: "/franchise-orders", label: "Orders", icon: <ShoppingCartOutlined />, permission: Permission.CanViewOrders },
      { type: "leaf", to: "/franchise-brands", label: "Brands", icon: <ShopOutlined />, permission: Permission.CanViewBrands },
      { type: "leaf", to: "/franchise-store-owners", label: "Store Owners", icon: <TeamOutlined />, permission: Permission.CanViewUser },
    ],
  },
  { type: "leaf", to: "/deals", label: "Deals", icon: <TagsOutlined />, permission: Permission.CanViewBrands },
  { type: "leaf", to: "/deals-audit-logs", label: "Deals Audit Logs", icon: <HistoryOutlined />, permission: Permission.CanViewBrands },
  { type: "leaf", to: "/warehouses", label: "Warehouses", icon: <ContainerOutlined />, permission: Permission.CanViewWarehouses },
  { type: "leaf", to: "/tickets", label: "Tickets", icon: <CustomerServiceOutlined />, permission: Permission.CanViewTicket },
  { type: "leaf", to: "/ratings", label: "Ratings", icon: <StarOutlined />, permission: Permission.CanViewRatings },
  { type: "leaf", to: "/email-requests", label: "Email Change Requests", icon: <MailOutlined />, permission: Permission.CanViewEmailChangeRequests },
  { type: "leaf", to: "/request-appeals", label: "Request Appeals", icon: <SolutionOutlined />, permission: Permission.CanViewRequestAppeals },
  { type: "leaf", to: "/admin-users", label: "Admin Users", icon: <UserSwitchOutlined />, permission: Permission.CanViewSubUser },
  { type: "leaf", to: "/roles", label: "Roles", icon: <KeyOutlined />, permission: Permission.CanViewRoles },
];

const STOREFRONT_PATHS = [
  "/franchise-products",
  "/franchise-orders",
  "/franchise-brands",
  "/franchise-store-owners",
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

    if (children.length === 0) return [];

    return [{ key: node.key, icon: node.icon, label: node.label, children }];
  });
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
    const matches = visibleLeaves
      .filter((leaf) => !leaf.exact && path.startsWith(leaf.to))
      .sort((a, b) => b.to.length - a.to.length);
    return matches[0]?.to ?? "/";
  }, [location.pathname, visibleLeaves]);

  useEffect(() => {
    if (STOREFRONT_PATHS.some((p) => location.pathname.startsWith(p))) {
      setOpenKeys((prev) => (prev.includes("storefront") ? prev : [...prev, "storefront"]));
    }
  }, [location.pathname]);

  function onClick({ key }: { key: string }) {
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
