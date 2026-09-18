import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  Row,
  Select,
  Button,
  DatePicker,
  Skeleton,
  Empty,
  Table,
  Typography,
  Space,
  App as AntdApp,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import {
  DollarCircleOutlined,
  WalletOutlined,
  ShoppingCartOutlined,
  PercentageOutlined,
  BankOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  getStorefrontOwners,
  getStorefrontOwnerDashboard,
} from "@/lib/storefrontApi";
import type {
  StorefrontDashboardActivityDto,
  StorefrontDashboardDto,
} from "@/lib/storefrontTypes";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

const { RangePicker } = DatePicker;

const COMMISSION_COLORS = ["#800020", "#16a34a", "#d97706"];
const ORDER_COLORS = ["#800020", "#16a34a"];
const ALL = "__all__";

/** Sum numeric metrics across every owner's dashboard into one aggregate. */
function aggregateDashboards(list: StorefrontDashboardDto[]): StorefrontDashboardDto {
  const merged = list.reduce<StorefrontDashboardDto>(
    (acc, d) => {
      acc.totalOrders += d.totalOrders ?? 0;
      acc.paidOrders += d.paidOrders ?? 0;
      acc.grossSales += d.grossSales ?? 0;
      acc.superAppOrderValue += d.superAppOrderValue ?? 0;
      acc.currentWalletBalance += d.currentWalletBalance ?? 0;
      acc.totalCommission += d.totalCommission ?? 0;
      acc.currentCommission += d.currentCommission ?? 0;
      acc.commissionPaid += d.commissionPaid ?? 0;
      acc.pendingCommission += d.pendingCommission ?? 0;
      acc.ordersWaitingForCommission += d.ordersWaitingForCommission ?? 0;
      acc.reservedForPayout += d.reservedForPayout ?? 0;
      acc.totalPayoutsPaid += d.totalPayoutsPaid ?? 0;
      return acc;
    },
    {
      ownerId: null,
      currency: "NGN",
      totalOrders: 0,
      paidOrders: 0,
      grossSales: 0,
      superAppOrderValue: 0,
      currentWalletBalance: 0,
      totalCommission: 0,
      currentCommission: 0,
      commissionPaid: 0,
      pendingCommission: 0,
      ordersWaitingForCommission: 0,
      reservedForPayout: 0,
      totalPayoutsPaid: 0,
      recentActivity: [],
    },
  );

  merged.currency = list.find((d) => d.currency)?.currency ?? "NGN";
  merged.recentActivity = list
    .flatMap((d) => d.recentActivity ?? [])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50);

  return merged;
}

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accentClass?: string;
}

function KpiCard({ title, value, icon, accentClass }: KpiCardProps) {
  return (
    <Card styles={{ body: { padding: 20 } }}>
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

function ownerDisplayName(owner: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  userName: string | null;
}) {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
  return owner.companyName?.trim() || name || owner.userName || "Unknown";
}

export default function StorefrontDashboard() {
  const { message } = AntdApp.useApp();
  const [ownerId, setOwnerId] = useState<string>(ALL);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [appliedRange, setAppliedRange] = useState<{
    s: string | null;
    e: string | null;
  }>({ s: null, e: null });

  // Fetch all storefront owners
  const ownersQuery = useQuery({
    queryKey: ["storefront", "store-owners", "dashboard-picker"],
    queryFn: async () => {
      const res = await getStorefrontOwners({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load store owners");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  // Fetch dashboards for every owner (aggregate view).
  const allDashboardsQuery = useQuery({
    queryKey: [
      "storefront",
      "owner-dashboards",
      "all",
      ownersQuery.data?.map((o) => o.id),
      appliedRange.s,
      appliedRange.e,
    ],
    queryFn: async () => {
      const owners = (ownersQuery.data ?? []).filter((o) => !!o.id);
      if (owners.length === 0) return {};
      const params = {
        StartDate: appliedRange.s ?? undefined,
        EndDate: appliedRange.e ?? undefined,
      };
      const results = await Promise.allSettled(
        owners.map((owner) => getStorefrontOwnerDashboard(owner.id!, params)),
      );
      const map: Record<string, StorefrontDashboardDto> = {};
      owners.forEach((owner, idx) => {
        const r = results[idx];
        if (r.status === "fulfilled" && r.value.status && r.value.data) {
          map[owner.id!] = r.value.data;
        }
      });
      return map;
    },
    enabled: ownerId === ALL && !!ownersQuery.data && ownersQuery.data.length > 0,
    staleTime: 60_000,
  });

  // Fetch dashboard data for a single owner.
  const singleDashboardQuery = useQuery({
    queryKey: [
      "storefront",
      "owner-dashboard",
      ownerId,
      appliedRange.s,
      appliedRange.e,
    ],
    queryFn: async () => {
      if (!ownerId) return null;
      const res = await getStorefrontOwnerDashboard(ownerId, {
        StartDate: appliedRange.s ?? undefined,
        EndDate: appliedRange.e ?? undefined,
      });
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load dashboard");
      }
      return res.data;
    },
    enabled: ownerId !== ALL && !!ownerId,
  });

  const data = useMemo(
    () =>
      ownerId === ALL
        ? aggregateDashboards(Object.values(allDashboardsQuery.data ?? {}))
        : singleDashboardQuery.data,
    [ownerId, allDashboardsQuery.data, singleDashboardQuery.data],
  );

  const isLoading =
    ownerId === ALL ? allDashboardsQuery.isLoading : singleDashboardQuery.isLoading;

  // Per-owner breakdown rows (only used in the "All owners" view).
  const ownerBreakdownRows = useMemo(() => {
    if (ownerId !== ALL) return [];
    const owners = ownersQuery.data ?? [];
    const map = allDashboardsQuery.data ?? {};
    return owners
      .filter((o) => o.id && map[o.id])
      .map((o) => ({
        id: o.id!,
        name: ownerDisplayName(o),
        email: o.email,
        totalOrders: map[o.id!].totalOrders,
        grossSales: map[o.id!].grossSales,
        totalCommission: map[o.id!].totalCommission,
        currency: map[o.id!].currency ?? "NGN",
      }))
      .sort((a, b) => b.grossSales - a.grossSales);
  }, [ownerId, ownersQuery.data, allDashboardsQuery.data]);

  const breakdownColumns: TableColumnsType<(typeof ownerBreakdownRows)[number]> = [
    { title: "Store owner", dataIndex: "name", render: (v) => v ?? "—" },
    {
      title: "Orders",
      dataIndex: "totalOrders",
      align: "right",
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Gross sales",
      dataIndex: "grossSales",
      align: "right",
      render: (v: number, row) =>
        formatCurrency(v, row.currency as "USD" | "NGN"),
    },
    {
      title: "Commission",
      dataIndex: "totalCommission",
      align: "right",
      render: (v: number, row) =>
        formatCurrency(v, row.currency as "USD" | "NGN"),
    },
  ];

  const commissionData = useMemo(
    () =>
      data
        ? [
            { name: "Current", value: data.currentCommission },
            { name: "Paid", value: data.commissionPaid },
            { name: "Pending", value: data.pendingCommission },
          ].filter((item) => item.value > 0)
        : [],
    [data],
  );

  const orderData = useMemo(
    () =>
      data
        ? [
            { name: "Paid", value: data.paidOrders },
            { name: "Unpaid", value: Math.max(0, data.totalOrders - data.paidOrders) },
          ].filter((item) => item.value > 0)
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

  const activityColumns: TableColumnsType<StorefrontDashboardActivityDto> = [
    {
      title: "Date",
      dataIndex: "date",
      render: (v) => formatDate(v),
      width: 140,
    },
    {
      title: "Type",
      dataIndex: "type",
      render: (v) => <Tag>{v ?? "—"}</Tag>,
      width: 120,
    },
    {
      title: "Description",
      dataIndex: "description",
      render: (v) => v ?? "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v: number) =>
        formatCurrency(v, currency as "USD" | "NGN"),
      width: 140,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v) => (v ? <Tag color="default">{v}</Tag> : "—"),
      width: 120,
    },
  ];

  const currency = data?.currency ?? "NGN";
  const selectedOwner = ownersQuery.data?.find((o) => o.id === ownerId);

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Storefront Dashboard
        </Typography.Title>
        <Typography.Text type="secondary">
          Financial metrics, commissions, and activity for store owners.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            showSearch
            className="w-full sm:w-80"
            placeholder="Select a store owner"
            value={ownerId}
            onChange={(v) => {
              setOwnerId(v);
              setRange(null);
              setAppliedRange({ s: null, e: null });
            }}
            loading={ownersQuery.isLoading}
            filterOption={(input, option) =>
              (option?.label?.toString() ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            options={[
              { value: ALL, label: "All store owners" },
              ...(ownersQuery.data ?? [])
                .filter((owner) => !!owner.id)
                .map((owner) => ({
                  value: owner.id as string,
                  label: ownerDisplayName(owner),
                })),
            ]}
            suffixIcon={<UserOutlined />}
          />
          {(
            <Space wrap size={12}>
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
          )}
        </div>
      </Card>

      {ownersQuery.data && ownersQuery.data.length === 0 ? (
        <Card>
          <Empty description="No store owners found" className="py-8" />
        </Card>
      ) : isLoading ? (
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
          {ownerId === ALL ? (
            <Card>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-xl text-primary">
                  <TeamOutlined />
                </div>
                <div>
                  <div className="font-semibold">All store owners</div>
                  <div className="text-sm text-muted-foreground">
                    {ownerBreakdownRows.length} owner
                    {ownerBreakdownRows.length === 1 ? "" : "s"} with dashboard data
                  </div>
                </div>
              </div>
            </Card>
          ) : selectedOwner ? (
            <Card>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-xl text-primary">
                  <UserOutlined />
                </div>
                <div>
                  <div className="font-semibold">
                    {ownerDisplayName(selectedOwner)}
                  </div>
                  {selectedOwner.email && (
                    <div className="text-sm text-muted-foreground">
                      {selectedOwner.email}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Gross sales"
                value={formatCurrency(data.grossSales, currency as "USD" | "NGN")}
                icon={<DollarCircleOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="SuperApp order value"
                value={formatCurrency(data.superAppOrderValue, currency as "USD" | "NGN")}
                icon={<ShoppingCartOutlined />}
                accentClass="text-emerald-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Current wallet balance"
                value={formatCurrency(data.currentWalletBalance, currency as "USD" | "NGN")}
                icon={<WalletOutlined />}
                accentClass="text-sky-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Total commission"
                value={formatCurrency(data.totalCommission, currency as "USD" | "NGN")}
                icon={<PercentageOutlined />}
                accentClass="text-amber-600"
              />
            </Col>

            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Current commission"
                value={formatCurrency(data.currentCommission, currency as "USD" | "NGN")}
                icon={<CheckCircleOutlined />}
                accentClass="text-green-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Commission paid"
                value={formatCurrency(data.commissionPaid, currency as "USD" | "NGN")}
                icon={<BankOutlined />}
                accentClass="text-blue-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Pending commission"
                value={formatCurrency(data.pendingCommission, currency as "USD" | "NGN")}
                icon={<ClockCircleOutlined />}
                accentClass="text-orange-600"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <KpiCard
                title="Reserved for payout"
                value={formatCurrency(data.reservedForPayout, currency as "USD" | "NGN")}
                icon={<BankOutlined />}
                accentClass="text-purple-600"
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} lg={8}>
              <Card>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Total orders</div>
                  <div className="text-3xl font-bold text-primary">
                    {formatNumber(data.totalOrders)}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Card>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Paid orders</div>
                  <div className="text-3xl font-bold text-green-600">
                    {formatNumber(data.paidOrders)}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12} lg={8}>
              <Card>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Orders waiting for commission
                  </div>
                  <div className="text-3xl font-bold text-orange-600">
                    {formatNumber(data.ordersWaitingForCommission)}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Commission breakdown">
                {commissionData.length === 0 ? (
                  <Empty description="No commission data" className="py-8" />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={commissionData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {commissionData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={COMMISSION_COLORS[i % COMMISSION_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) =>
                            formatCurrency(value, currency as "USD" | "NGN")
                          }
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Order status">
                {orderData.length === 0 ? (
                  <Empty description="No order data" className="py-8" />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={orderData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={100}
                        >
                          {orderData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={ORDER_COLORS[i % ORDER_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {ownerId === ALL && (
            <Card
              title={`Store owners breakdown (${ownerBreakdownRows.length})`}
              styles={{ body: { padding: 0 } }}
            >
              <Table
                dataSource={ownerBreakdownRows}
                columns={breakdownColumns}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                size="middle"
                scroll={{ x: 640 }}
                locale={{ emptyText: "No store owner data" }}
              />
            </Card>
          )}

          <Card
            title={`Recent activity${data.recentActivity?.length ? ` (${data.recentActivity.length})` : ""}`}
            styles={{ body: { padding: 0 } }}
          >
            <Table<StorefrontDashboardActivityDto>
              dataSource={data.recentActivity ?? []}
              columns={activityColumns}
              pagination={false}
              size="middle"
              scroll={{ x: 800 }}
              locale={{ emptyText: "No recent activity" }}
              rowKey={(record, index) =>
                `${record.date}-${record.orderId ?? record.payoutId ?? record.description ?? "activity"}-${index ?? 0}`
              }
            />
          </Card>

          <Card>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Total payouts paid
                  </div>
                  <div className="text-2xl font-semibold">
                    {formatCurrency(data.totalPayoutsPaid, currency as "USD" | "NGN")}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Currency</div>
                  <div className="text-2xl font-semibold">
                    <Tag color="blue">{currency}</Tag>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </>
      ) : null}
    </div>
  );
}
