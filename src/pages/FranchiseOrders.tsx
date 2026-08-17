import { useEffect, useMemo, useState } from "react";
import {
  App as AntdApp, Button, Card, Descriptions, Drawer, Empty, Input, Select, Table, Tag, Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import {
  commissionMockStore,
  formatNaira,
  type FranchiseOrder,
  type FranchiseOrderLine,
} from "@/components/brand-commission/mockStore";

function orderTotal(order: FranchiseOrder) {
  return order.lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

function statusTag(status: FranchiseOrder["status"]) {
  if (status === "Completed") return <Tag color="success">Completed</Tag>;
  if (status === "Pending") return <Tag color="processing">Pending</Tag>;
  return <Tag color="error">Cancelled</Tag>;
}

export default function FranchiseOrdersPage() {
  const { message } = AntdApp.useApp();
  const [orders, setOrders] = useState<FranchiseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FranchiseOrder["status"] | "all">("all");
  const [selected, setSelected] = useState<FranchiseOrder | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await commissionMockStore.getOrders();
        if (active) setOrders(rows);
      } catch {
        message.error("Unable to load mock franchise orders.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return commissionMockStore.subscribe(() => void load());
  }, [message]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!q) return true;
      return order.orderNumber.toLowerCase().includes(q)
        || order.founderName.toLowerCase().includes(q)
        || order.tdCustomerName.toLowerCase().includes(q);
    });
  }, [orders, search, statusFilter]);

  const columns: TableColumnsType<FranchiseOrder> = [
    {
      title: "Order",
      dataIndex: "orderNumber",
      render: (value: string) => <span className="font-medium">{value}</span>,
    },
    { title: "Franchise Founder", dataIndex: "founderName" },
    { title: "TD Customer", dataIndex: "tdCustomerName" },
    {
      title: "Storefront total",
      key: "total",
      align: "right",
      render: (_, order) => <span className="font-medium">{formatNaira(orderTotal(order))}</span>,
    },
    {
      title: "Lines",
      key: "lines",
      render: (_, order) => `${order.lines.length} item${order.lines.length === 1 ? "" : "s"}`,
    },
    { title: "Status", dataIndex: "status", render: (status: FranchiseOrder["status"]) => statusTag(status) },
    {
      title: "Date",
      dataIndex: "dateCreated",
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      render: (_, order) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(order)}>
          View
        </Button>
      ),
    },
  ];

  const lineColumns: TableColumnsType<FranchiseOrderLine> = [
    { title: "Product", dataIndex: "productName" },
    { title: "Qty", dataIndex: "quantity", width: 70 },
    {
      title: "Product price",
      dataIndex: "productPrice",
      render: (price: number) => formatNaira(price),
    },
    {
      title: "Markup",
      dataIndex: "markupPercent",
      render: (markup: number) => `${markup.toFixed(2)}%`,
    },
    {
      title: "Storefront unit",
      dataIndex: "storefrontUnitPrice",
      render: (price: number) => <span className="font-medium">{formatNaira(price)}</span>,
    },
    {
      title: "Line total",
      dataIndex: "lineTotal",
      align: "right",
      render: (total: number) => formatNaira(total),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">Franchise orders</Typography.Title>
        <Typography.Text type="secondary">
          Mock orders charged at storefront price (product price + markup), snapshotted at purchase time.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-8"
            allowClear
            placeholder="Search order, Franchise Founder, or TD Customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            className="md:col-span-4"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All statuses" },
              { value: "Pending", label: "Pending" },
              { value: "Completed", label: "Completed" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<FranchiseOrder>
          rowKey="id"
          columns={columns}
          dataSource={visible}
          loading={loading}
          locale={{ emptyText: <Empty description="No franchise orders" /> }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Drawer
        width={720}
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Order ${selected.orderNumber}` : "Order"}
      >
        {selected && (
          <div className="space-y-4">
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: "founder", label: "Franchise Founder", children: selected.founderName },
                { key: "customer", label: "TD Customer", children: selected.tdCustomerName },
                { key: "status", label: "Status", children: statusTag(selected.status) },
                { key: "date", label: "Ordered", children: new Date(selected.dateCreated).toLocaleString() },
                { key: "total", label: "Storefront total", children: <span className="font-medium">{formatNaira(orderTotal(selected))}</span> },
              ]}
            />
            <Typography.Text type="secondary">
              Line amounts are historical snapshots — later markup changes do not rewrite these orders.
            </Typography.Text>
            <Table
              rowKey={(line) => `${line.productId}-${line.storefrontUnitPrice}`}
              size="small"
              pagination={false}
              columns={lineColumns}
              dataSource={selected.lines}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
