import { useMemo } from "react";
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
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission: Permission;
  /** If true, only exact match on pathname counts as active (for the home route). */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: <DashboardOutlined />, permission: Permission.CanViewDashboard, exact: true },
  { to: "/products", label: "Products", icon: <AppstoreOutlined />, permission: Permission.CanViewProducts },
  { to: "/orders", label: "Orders", icon: <ShoppingCartOutlined />, permission: Permission.CanViewOrders },
  { to: "/debt-collection", label: "Debt Collection", icon: <AccountBookOutlined />, permission: Permission.CanViewOrders },
  { to: "/customers", label: "Customers", icon: <TeamOutlined />, permission: Permission.CanViewUser },
  { to: "/employees", label: "Employees", icon: <UsergroupAddOutlined />, permission: Permission.CanViewDashboard },
  { to: "/cac-data", label: "CAC Data", icon: <IdcardOutlined />, permission: Permission.CanViewUser },
  { to: "/kyc", label: "KYC", icon: <SafetyCertificateOutlined />, permission: Permission.CanEditUser },
  { to: "/promos", label: "Promos", icon: <PercentageOutlined />, permission: Permission.CanViewPromos },
  { to: "/promos-audit-logs", label: "Promos Audit Logs", icon: <HistoryOutlined />, permission: Permission.CanViewPromos },
  { to: "/product-groups", label: "Product Groups", icon: <GroupOutlined />, permission: Permission.CanViewProductGroup },
  { to: "/brands", label: "Brands", icon: <ShopOutlined />, permission: Permission.CanViewBrands },
  { to: "/deals", label: "Deals", icon: <TagsOutlined />, permission: Permission.CanViewBrands },
  { to: "/deals-audit-logs", label: "Deals Audit Logs", icon: <HistoryOutlined />, permission: Permission.CanViewBrands },
  { to: "/warehouses", label: "Warehouses", icon: <ContainerOutlined />, permission: Permission.CanViewWarehouses },
  { to: "/tickets", label: "Tickets", icon: <CustomerServiceOutlined />, permission: Permission.CanViewTicket },
  { to: "/ratings", label: "Ratings", icon: <StarOutlined />, permission: Permission.CanViewRatings },
  { to: "/email-requests", label: "Email Change Requests", icon: <MailOutlined />, permission: Permission.CanViewEmailChangeRequests },
  { to: "/request-appeals", label: "Request Appeals", icon: <SolutionOutlined />, permission: Permission.CanViewRequestAppeals },
  { to: "/admin-users", label: "Admin Users", icon: <UserSwitchOutlined />, permission: Permission.CanViewSubUser },
  { to: "/roles", label: "Roles", icon: <KeyOutlined />, permission: Permission.CanViewRoles },
];

interface NavMenuProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavMenu({ collapsed, onNavigate }: NavMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const items: MenuProps["items"] = useMemo(
    () =>
      NAV_ITEMS.filter((i) => hasPermission(i.permission)).map((i) => ({
        key: i.to,
        icon: i.icon,
        label: i.label,
      })),
    [hasPermission],
  );

  const activeKey = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return "/";
    // Pick the longest matching prefix among available nav items.
    const matches = NAV_ITEMS.filter((i) => !i.exact && path.startsWith(i.to)).sort(
      (a, b) => b.to.length - a.to.length,
    );
    return matches[0]?.to ?? "/";
  }, [location.pathname]);

  function onClick({ key }: { key: string }) {
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
        onClick={onClick}
        items={items}
        inlineCollapsed={collapsed}
        className="border-0 bg-transparent py-3"
      />
    </>
  );
}
