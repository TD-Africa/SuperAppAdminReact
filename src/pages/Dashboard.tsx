import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  Row,
  Statistic,
  Button,
  DatePicker,
  Skeleton,
  Tag,
  Table,
  Typography,
  Space,
  App as AntdApp,
  theme,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import {
  TransactionOutlined,
  DollarCircleOutlined,
  CreditCardOutlined,
  BankOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  CustomerServiceOutlined,
  AppstoreOutlined,
  ShoppingOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { apiGet } from "@/lib/api";
import type {
  AdminDashboardResponse,
  TopRankingOrderResponse,
  TopRankingProductResponse,
} from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { AbandonedCartUsersModal } from "@/components/dashboard/AbandonedCartUsersModal";

const { RangePicker } = DatePicker;

function buildUrl(startDate: string | null, endDate: string | null) {
  const qs = new URLSearchParams();
  if (startDate) qs.set("startDate", new Date(startDate).toISOString());
  if (endDate) qs.set("endDate", new Date(endDate).toISOString());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `Component/GetAdminDashboard${suffix}`;
}

const TRANSACTION_COLORS = ["#800020", "#b94d67", "#d17b8d"];
const STATUS_COLORS = [
  "#800020",
  "#b94d67",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#64748b",
];
const TICKET_COLORS = ["#800020", "#d97706", "#16a34a"];

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  onClick?: () => void;
  accentClass?: string;
}

function KpiCard({ title, value, icon, onClick, accentClass }: KpiCardProps) {
  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      className={onClick ? "cursor-pointer" : undefined}
      styles={{ body: { padding: 20 } }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-muted-foreground">{title}</div>
          <div className="mt-2 truncate text-2xl font-semibold tracking-tight">
            {value}
          </div>
        </div>
        <div
          className={
            "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-lg " +
            (accentClass ?? "text-primary")
          }
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [appliedRange, setAppliedRange] = useState<{
    s: string | null;
    e: string | null;
  }>({ s: null, e: null });
  const [abandonedCartOpen, setAbandonedCartOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard", appliedRange.s, appliedRange.e],
    queryFn: async () => {
      const res = await apiGet<AdminDashboardResponse>(
        buildUrl(appliedRange.s, appliedRange.e),
      );
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load dashboard");
      }
      return res.data;
    },
  });

  const transactionData = useMemo(
    () =>
      data
        ? [
            { name: "POA", value: data.totalNumberOfPoaTransactions },
            { name: "Cash", value: data.totalNumberOfCashTransactions },
            { name: "Credit", value: data.totalNumberOfCreditTransactions },
          ]
        : [],
    [data],
  );

  const statusData = useMemo(
    () =>
      data
        ? [
            { name: "Pending", value: data.totalNumberOfPendingOrders },
            { name: "In progress", value: data.totalNumberOfInProgressOrders },
            { name: "Completed", value: data.totalNumberOfCompletedOrders },
            { name: "Unpaid", value: data.totalNumberOfUnpaidOrders },
            { name: "Failed", value: data.totalNumberOfFailedOrders },
            { name: "Cancelled", value: data.totalNumberOfCancelledOrders },
          ]
        : [],
    [data],
  );

  const ticketData = useMemo(
    () =>
      data
        ? [
            { name: "Open", value: data.totalNumberOfOpenTickets },
            { name: "Pending", value: data.totalNumberOfPendingTickets },
            { name: "Closed", value: data.totalNumberOfClosedTickets },
          ]
        : [],
    [data],
  );

  function applyFilter() {
    const [start, end] = range ?? [null, null];
    if (start && start.isAfter(new Date())) {
      message.error("Start date cannot be in the future");
      return;
    }
    if (start && end && start.isAfter(end)) {
      message.error("Start date cannot be after end date");
      return;
    }
    setAppliedRange({
      s: start ? start.toISOString() : null,
      e: end ? end.toISOString() : null,
    });
  }

  function resetFilter() {
    setRange(null);
    setAppliedRange({ s: null, e: null });
  }

  const productColumns: TableColumnsType<TopRankingProductResponse> = [
    { title: "Product", dataIndex: "productName", render: (v) => v ?? "—" },
    {
      title: "Units sold",
      dataIndex: "unitSold",
      align: "right",
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Revenue",
      dataIndex: "totalRevenue",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
  ];

  const orderColumns: TableColumnsType<TopRankingOrderResponse> = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v) => v ?? "—",
    },
    {
      title: "Date",
      dataIndex: "orderDate",
      render: (v) => formatDate(v),
    },
    {
      title: "USD",
      dataIndex: "totalAmountInDollars",
      align: "right",
      render: (v: number) => formatCurrency(v, "USD"),
    },
    {
      title: "NGN",
      dataIndex: "totalAmountInNaira",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    { title: "Payment", dataIndex: "paymentMethod" },
    {
      title: "POA",
      dataIndex: "isPoaTransaction",
      render: (v: boolean) =>
        v ? <Tag color="success">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v: string) => <Tag color="default">{v}</Tag>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Dashboard
        </Typography.Title>
        <Typography.Text type="secondary">
          Overview of transactions, orders, customers, and support tickets.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap className="w-full" size={12}>
          <RangePicker
            showTime
            value={range}
            onChange={(v) =>
              setRange(v ? [v[0] ?? null, v[1] ?? null] : null)
            }
          />
          <Button type="primary" onClick={applyFilter}>
            Apply
          </Button>
          <Button onClick={resetFilter}>Reset</Button>
        </Space>
      </Card>

      {isLoading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Col key={i} xs={24} sm={12} xl={6}>
              <Card>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : data ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Total transactions"
                value={formatCurrency(data.totalAmountForAllTransactions, "NGN")}
                icon={<TransactionOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Cash transactions"
                value={formatCurrency(data.totalAmountForCashTransactions, "NGN")}
                icon={<DollarCircleOutlined />}
                accentClass="text-emerald-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Credit transactions"
                value={formatCurrency(
                  data.totalAmountForCreditTransactions,
                  "NGN",
                )}
                icon={<CreditCardOutlined />}
                accentClass="text-sky-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="POA transactions"
                value={formatCurrency(data.totalAmountForPoaTransactions, "NGN")}
                icon={<BankOutlined />}
                accentClass="text-amber-600"
              />
            </Col>

            <Col xs={24} sm={12} xl={6}>
              <Card hoverable onClick={() => navigate("/orders")}>
                <Statistic
                  title="Total orders"
                  value={data.totalNumberOfOrders}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: token.colorPrimary }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card hoverable onClick={() => navigate("/customers")}>
                <Statistic
                  title="Total customers"
                  value={data.totalNumberOfCustomers}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: token.colorPrimary }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card hoverable onClick={() => navigate("/tickets")}>
                <Statistic
                  title="Total tickets"
                  value={data.totalNumberOfTickets}
                  prefix={<CustomerServiceOutlined />}
                  valueStyle={{ color: token.colorPrimary }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card hoverable onClick={() => navigate("/products")}>
                <Statistic
                  title="Available products"
                  value={data.totalNumberOfAvailableProducts}
                  prefix={<AppstoreOutlined />}
                  valueStyle={{ color: token.colorPrimary }}
                />
              </Card>
            </Col>
          </Row>

          {/* Action items — clickable to open detail modals */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                hoverable
                onClick={() => setAbandonedCartOpen(true)}
                className="!border-l-4 !border-l-amber-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">
                      Abandoned carts
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">
                      {formatNumber(data.totalNumberOfAbandonedCarts)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Tap to view users with items left behind
                    </div>
                  </div>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-lg text-amber-600">
                    <ShoppingOutlined />
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                hoverable
                onClick={() => navigate("/debt-collection")}
                className="!border-l-4 !border-l-rose-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">
                      Debt collection
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">
                      {formatNumber(data.totalNumberOfUnpaidOrders)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Unpaid credit orders awaiting collection
                    </div>
                  </div>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-100 text-lg text-rose-700">
                    <ExclamationCircleOutlined />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Transaction mix">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={transactionData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {transactionData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={TRANSACTION_COLORS[i % TRANSACTION_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Order status">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={100}
                      >
                        {statusData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Top 5 selling products" styles={{ body: { padding: 0 } }}>
                <Table<TopRankingProductResponse>
                  rowKey="id"
                  dataSource={data.topFiveSellingProducts ?? []}
                  columns={productColumns}
                  pagination={false}
                  size="middle"
                  locale={{ emptyText: "No sales in this range" }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Ticket status">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ticketData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                      >
                        {ticketData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={TICKET_COLORS[i % TICKET_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="Last 5 orders" styles={{ body: { padding: 0 } }}>
            <Table<TopRankingOrderResponse>
              rowKey="id"
              dataSource={data.lastFiveOrders ?? []}
              columns={orderColumns}
              pagination={false}
              size="middle"
              scroll={{ x: 720 }}
              locale={{ emptyText: "No recent orders" }}
            />
          </Card>
        </>
      ) : null}

      <AbandonedCartUsersModal
        open={abandonedCartOpen}
        onOpenChange={setAbandonedCartOpen}
        startDate={range?.[0] ?? null}
        endDate={range?.[1] ?? null}
      />
    </div>
  );
}
