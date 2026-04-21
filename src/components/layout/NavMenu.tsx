import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FileText,
  BadgeCheck,
  Tag,
  Layers,
  Store,
  Warehouse,
  Ticket,
  Star,
  MailQuestion,
  MessagesSquare,
  UserCog,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  end?: boolean;
}

// Mirror of SuperAppAdminWeb/Layout/NavMenu.razor
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard, permission: Permission.CanViewDashboard, end: true },
  { to: "/products", label: "Products", icon: Package, permission: Permission.CanViewProducts },
  { to: "/orders", label: "Orders", icon: ShoppingCart, permission: Permission.CanViewOrders },
  { to: "/customers", label: "Customers", icon: Users, permission: Permission.CanViewUser },
  { to: "/cac-data", label: "CAC Data", icon: FileText, permission: Permission.CanViewUser },
  { to: "/kyc", label: "KYC", icon: BadgeCheck, permission: Permission.CanEditUser },
  { to: "/promos", label: "Promos", icon: Tag, permission: Permission.CanViewPromos },
  { to: "/promos-audit-logs", label: "Promos Audit Logs", icon: FileText, permission: Permission.CanViewPromos },
  { to: "/product-groups", label: "Product Groups", icon: Layers, permission: Permission.CanViewProductGroup },
  { to: "/brands", label: "Brands", icon: Store, permission: Permission.CanViewBrands },
  { to: "/deals", label: "Deals", icon: Tag, permission: Permission.CanViewBrands },
  { to: "/deals-audit-logs", label: "Deals Audit Logs", icon: FileText, permission: Permission.CanViewBrands },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse, permission: Permission.CanViewWarehouses },
  { to: "/tickets", label: "Tickets", icon: Ticket, permission: Permission.CanViewTicket },
  { to: "/ratings", label: "Ratings", icon: Star, permission: Permission.CanViewRatings },
  { to: "/email-requests", label: "Email Change Requests", icon: MailQuestion, permission: Permission.CanViewEmailChangeRequests },
  { to: "/request-appeals", label: "Request Appeals", icon: MessagesSquare, permission: Permission.CanViewRequestAppeals },
  { to: "/admin-users", label: "Admin Users", icon: UserCog, permission: Permission.CanViewSubUser },
  { to: "/roles", label: "Roles", icon: ShieldCheck, permission: Permission.CanViewRoles },
];

export function NavMenu() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const items = NAV_ITEMS.filter((i) => hasPermission(i.permission));

  return (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground font-bold">
          TD
        </div>
        <span className="text-base font-semibold tracking-tight">
          SuperApp Admin
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent/20 hover:text-sidebar-foreground",
                      isActive &&
                        "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
