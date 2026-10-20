import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Tabs, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { CartsTab } from "@/components/carts/CartsTab";
import { OrderHoldsTab } from "@/components/carts/OrderHoldsTab";

type Tab = "carts" | "orders";

/**
 * Customer carts and pending orders, side by side: what's sitting in carts
 * (no stock reserved) and what pending orders are holding (stock reserved until
 * paid or the sweep cancels them), with the tools to release either.
 */
export default function StockHoldsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewOrders = hasPermission(Permission.CanViewOrders);
  const [search, setSearch] = useSearchParams();
  const tab: Tab = search.get("tab") === "orders" && canViewOrders ? "orders" : "carts";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Carts &amp; Stock Holds
          </Typography.Title>
          <Typography.Text type="secondary">
            Which products are sitting in customer carts and pending orders, who holds them,
            and releasing them. Every release is recorded on the audit trail.
          </Typography.Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: [tab === "carts" ? "cart-admin" : "order-holds"],
            })
          }
        >
          Refresh
        </Button>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(key) => setSearch(key === "carts" ? {} : { tab: key }, { replace: true })}
        destroyOnHidden
        items={[
          {
            key: "carts",
            label: "In carts",
            children: <CartsTab canClear={hasPermission(Permission.CanClearCart)} />,
          },
          ...(canViewOrders
            ? [
                {
                  key: "orders",
                  label: "Held by pending orders",
                  children: <OrderHoldsTab canEdit={hasPermission(Permission.CanEditOrders)} />,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
