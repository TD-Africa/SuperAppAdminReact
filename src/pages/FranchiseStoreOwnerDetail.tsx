import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined,
  MinusOutlined,
  PlusOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import {
  cancelStorefrontPayout,
  creditAdminStorefrontWallet,
  debitAdminStorefrontWallet,
  getAdminPayouts,
  getAdminStorefrontWallet,
  getAdminStorefrontWalletOrders,
  getAdminStorefrontWalletStats,
  getAdminStorefrontWalletTransactions,
  getSettlementWalletHistory,
  getStorefrontEarnings,
  getStorefrontEarningsSummary,
  requestStorefrontPayout,
} from "@/lib/storefrontApi";
import type {
  StorefrontEarningDto,
  StorefrontPayoutDto,
  StorefrontWalletOrderDto,
  StorefrontWalletTransactionDto,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { WalletAdjustmentModal } from "@/components/storefront/WalletAdjustmentModal";
import { PayoutDetailModal } from "@/components/storefront/PayoutDetailModal";
import { RecordStorefrontOrderModal } from "@/components/storefront/RecordStorefrontOrderModal";

function money(amount: number, currency: string | null | undefined) {
  const code = currency === "USD" ? "USD" : "NGN";
  return formatCurrency(amount, code);
}

function statusTag(status: string | null | undefined) {
  if (!status) return <Tag>—</Tag>;
  const lower = status.toLowerCase();
  if (lower === "pending" || lower === "requested") return <Tag color="processing">{status}</Tag>;
  if (lower === "available" || lower === "completed" || lower === "success" || lower === "paid") {
    return <Tag color="success">{status}</Tag>;
  }
  if (lower === "reversed" || lower === "failed" || lower === "cancelled" || lower === "rejected") {
    return <Tag color="error">{status}</Tag>;
  }
  if (lower === "withdrawn" || lower === "approved") return <Tag color="default">{status}</Tag>;
  return <Tag>{status}</Tag>;
}

export default function FranchiseStoreOwnerDetailPage() {
  const { storeOwnerId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const companyName = searchParams.get("company") ?? "";
  const ownerName = searchParams.get("owner") ?? "";
  const userName = searchParams.get("user") ?? "";

  const [earningsSearch, setEarningsSearch] = useState("");
  const debouncedEarningsSearch = useDebouncedValue(earningsSearch, 350);
  const [earningsPage, setEarningsPage] = useState(1);
  const [earningsPageSize, setEarningsPageSize] = useState(20);

  const [txSearch, setTxSearch] = useState("");
  const debouncedTxSearch = useDebouncedValue(txSearch, 350);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);

  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [ordersSearch, setOrdersSearch] = useState("");
  const debouncedOrdersSearch = useDebouncedValue(ordersSearch, 350);

  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsPageSize, setPayoutsPageSize] = useState(20);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);

  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [payoutRequestOpen, setPayoutRequestOpen] = useState(false);
  const [recordOrderOpen, setRecordOrderOpen] = useState(false);
  const [recordSettlementOpen, setRecordSettlementOpen] = useState(false);
  const [payoutForm] = Form.useForm();

  const ownerScope = useMemo(
    () => (storeOwnerId ? { ownerId: storeOwnerId } : {}),
    [storeOwnerId],
  );

  const walletQuery = useQuery({
    queryKey: ["admin-storefront-wallet", storeOwnerId],
    queryFn: async () => {
      const res = await getAdminStorefrontWallet(storeOwnerId!);
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-storefront-wallet-stats", storeOwnerId],
    queryFn: async () => {
      const res = await getAdminStorefrontWalletStats(storeOwnerId!);
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet stats");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const summaryQuery = useQuery({
    queryKey: ["storefront", "earnings-summary", ownerScope],
    queryFn: async () => {
      const res = await getStorefrontEarningsSummary(ownerScope);
      if (!res.status) throw new Error(res.message ?? "Failed to load earnings summary");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const earningsParams = useMemo(
    () => ({
      ...ownerScope,
      PageSize: earningsPageSize,
      PageNumber: earningsPage,
      SearchString: debouncedEarningsSearch.trim() || undefined,
    }),
    [ownerScope, earningsPageSize, earningsPage, debouncedEarningsSearch],
  );

  const earningsQuery = useQuery({
    queryKey: ["storefront", "earnings", earningsParams],
    queryFn: async () => {
      const res = await getStorefrontEarnings(earningsParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load earnings");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const txParams = useMemo(
    () => ({
      PageSize: txPageSize,
      PageNumber: txPage,
      SearchString: debouncedTxSearch.trim() || undefined,
    }),
    [txPageSize, txPage, debouncedTxSearch],
  );

  const txQuery = useQuery({
    queryKey: ["admin-storefront-wallet-tx", storeOwnerId, txParams],
    queryFn: async () => {
      const res = await getAdminStorefrontWalletTransactions(storeOwnerId!, txParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load transactions");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const historyQuery = useQuery({
    queryKey: ["settlement-wallet-history", ownerScope, txParams],
    queryFn: async () => {
      const res = await getSettlementWalletHistory({ ...ownerScope, ...txParams });
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet history");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const ordersParams = useMemo(
    () => ({
      PageSize: ordersPageSize,
      PageNumber: ordersPage,
      SearchString: debouncedOrdersSearch.trim() || undefined,
    }),
    [ordersPageSize, ordersPage, debouncedOrdersSearch],
  );

  const ordersQuery = useQuery({
    queryKey: ["admin-storefront-wallet-orders", storeOwnerId, ordersParams],
    queryFn: async () => {
      const res = await getAdminStorefrontWalletOrders(storeOwnerId!, ordersParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load orders");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts-owner", storeOwnerId, payoutsPage, payoutsPageSize],
    queryFn: async () => {
      const res = await getAdminPayouts({
        ownerId: storeOwnerId!,
        PageSize: payoutsPageSize,
        PageNumber: payoutsPage,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load payouts");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  useEffect(() => {
    const err =
      walletQuery.error ??
      statsQuery.error ??
      summaryQuery.error ??
      earningsQuery.error ??
      txQuery.error;
    if (err) {
      message.error(err instanceof Error ? err.message : "Unable to load store owner wallet.");
    }
  }, [
    walletQuery.error,
    statsQuery.error,
    summaryQuery.error,
    earningsQuery.error,
    txQuery.error,
    message,
  ]);

  async function invalidateWallet() {
    await queryClient.invalidateQueries({ queryKey: ["admin-storefront-wallet", storeOwnerId] });
    await queryClient.invalidateQueries({ queryKey: ["admin-storefront-wallet-stats", storeOwnerId] });
    await queryClient.invalidateQueries({ queryKey: ["admin-storefront-wallet-tx", storeOwnerId] });
    await queryClient.invalidateQueries({ queryKey: ["storefront", "earnings-summary", ownerScope] });
  }

  async function handleWalletAdjust(
    mode: "credit" | "debit",
    values: { amount: number; reference: string; description: string },
  ) {
    if (!storeOwnerId) return false;
    setAdjusting(true);
    try {
      const fn =
        mode === "credit" ? creditAdminStorefrontWallet : debitAdminStorefrontWallet;
      const res = await fn(storeOwnerId, values);
      if (!res.status) {
        message.error(res.message ?? "Adjustment failed");
        return false;
      }
      await invalidateWallet();
      return true;
    } finally {
      setAdjusting(false);
    }
  }

  const title =
    companyName.trim() ||
    ownerName.trim() ||
    userName.trim() ||
    "Store owner";

  const currency =
    walletQuery.data?.currency ??
    statsQuery.data?.currency ??
    summaryQuery.data?.currency ??
    "NGN";

  const earningsColumns: TableColumnsType<StorefrontEarningDto> = [
    {
      title: "Date",
      dataIndex: "dateCreated",
      width: 140,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">{formatDate(v)}</span>
      ),
    },
    {
      title: "External order",
      dataIndex: "externalOrderId",
      render: (v: string | null, row) => (
        <Button
          type="link"
          className="!px-0"
          onClick={() => {
            setSelectedOrderId(row.orderId);
            setOrderOpen(true);
          }}
        >
          {v?.trim() || row.orderId.slice(0, 8)}
        </Button>
      ),
    },
    {
      title: "Earned",
      dataIndex: "earnedAmount",
      align: "right",
      render: (v: number, row) => (
        <span className="font-semibold text-[#800020]">{money(v, row.currency)}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: string) => statusTag(v),
    },
  ];

  const txColumns: TableColumnsType<StorefrontWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">{formatDate(v)}</span>
      ),
    },
    { title: "Type", dataIndex: "type", width: 110, render: (v) => v ?? "—" },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v: number) => (
        <span className={v < 0 ? "text-red-600" : "font-medium"}>{money(v, currency)}</span>
      ),
    },
    {
      title: "After",
      dataIndex: "balanceAfter",
      align: "right",
      render: (v: number) => money(v, currency),
    },
    {
      title: "Reference",
      key: "ref",
      render: (_, row) => row.paymentReference ?? row.reference ?? "—",
    },
    { title: "Status", dataIndex: "status", width: 100, render: (v) => statusTag(v) },
  ];

  const ordersColumns: TableColumnsType<StorefrontWalletOrderDto> = [
    {
      title: "Date",
      dataIndex: "dateCreated",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "Order",
      dataIndex: "orderReference",
      render: (v, row) => (
        <Button
          type="link"
          className="!px-0"
          onClick={() => {
            setSelectedOrderId(row.orderId);
            setOrderOpen(true);
          }}
        >
          {v ?? row.externalOrderId ?? row.orderId.slice(0, 8)}
        </Button>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => money(v, currency),
    },
    {
      title: "Commission",
      dataIndex: "commission",
      align: "right",
      render: (v) => money(v, currency),
    },
    {
      title: "Commission status",
      dataIndex: "commissionStatus",
      render: (v) => statusTag(v),
    },
    {
      title: "Paid",
      dataIndex: "isPaid",
      width: 80,
      render: (v: boolean) => <Tag color={v ? "success" : "default"}>{v ? "Yes" : "No"}</Tag>,
    },
  ];

  const payoutsColumns: TableColumnsType<StorefrontPayoutDto> = [
    {
      title: "Requested",
      dataIndex: "requestedAt",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "Reference",
      dataIndex: "requestReference",
      render: (v, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-[#800020] hover:underline"
          onClick={() => {
            setSelectedPayoutId(row.id);
            setPayoutOpen(true);
          }}
        >
          {v ?? row.id.slice(0, 8)}
        </button>
      ),
    },
    {
      title: "Net",
      dataIndex: "netAmount",
      align: "right",
      render: (v, row) => money(v, row.currency),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, row) =>
        row.status === "Requested" ? (
          <Button
            size="small"
            danger
            onClick={async () => {
              const res = await cancelStorefrontPayout(row.id);
              if (!res.status) {
                message.error(res.message ?? "Cancel failed");
                return;
              }
              message.success("Payout cancelled");
              payoutsQuery.refetch();
            }}
          >
            Cancel
          </Button>
        ) : null,
    },
  ];

  if (!storeOwnerId) {
    return (
      <Empty description="Store owner not found">
        <Button onClick={() => navigate("/franchise-store-owners")}>Back to store owners</Button>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="!px-0"
            onClick={() => navigate("/franchise-store-owners")}
          >
            Store owners
          </Button>
          <Typography.Title level={3} className="!m-0">
            {title}
          </Typography.Title>
          <Typography.Text type="secondary">
            {[ownerName, userName].filter(Boolean).join(" · ") || "Wallet, earnings, payouts"}
          </Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setCreditOpen(true)}>
            Credit
          </Button>
          <Button danger icon={<MinusOutlined />} onClick={() => setDebitOpen(true)}>
            Debit
          </Button>
          <Button onClick={() => setPayoutRequestOpen(true)}>Request payout</Button>
          <Button icon={<ShoppingOutlined />} onClick={() => setRecordOrderOpen(true)}>
            Record order
          </Button>
          <Button onClick={() => setRecordSettlementOpen(true)}>Settlement order</Button>
        </Space>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card loading={walletQuery.isLoading}>
          <Statistic
            title="Wallet balance"
            value={walletQuery.data?.balance ?? statsQuery.data?.walletBalance ?? 0}
            formatter={() =>
              money(
                walletQuery.data?.balance ?? statsQuery.data?.walletBalance ?? 0,
                currency,
              )
            }
            valueStyle={{ color: "#800020", fontWeight: 600 }}
          />
        </Card>
        <Card loading={statsQuery.isLoading}>
          <Statistic title="Revenue" value={statsQuery.data?.revenue ?? 0} formatter={() => money(statsQuery.data?.revenue ?? 0, currency)} />
        </Card>
        <Card loading={statsQuery.isLoading}>
          <Statistic title="Paid orders" value={statsQuery.data?.paidOrders ?? 0} />
        </Card>
        <Card loading={statsQuery.isLoading}>
          <Statistic
            title="Reserved for payout"
            value={statsQuery.data?.reservedForPayout ?? 0}
            formatter={() => money(statsQuery.data?.reservedForPayout ?? 0, currency)}
          />
        </Card>
      </div>

      <Card loading={summaryQuery.isLoading || statsQuery.isLoading}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Statistic title="Pending commission" value={statsQuery.data?.pendingCommission ?? summaryQuery.data?.pending ?? 0} formatter={() => money(statsQuery.data?.pendingCommission ?? summaryQuery.data?.pending ?? 0, currency)} />
          <Statistic title="Available" value={summaryQuery.data?.available ?? 0} formatter={() => money(summaryQuery.data?.available ?? 0, currency)} />
          <Statistic title="Withdrawn" value={summaryQuery.data?.withdrawn ?? 0} formatter={() => money(summaryQuery.data?.withdrawn ?? 0, currency)} />
          <Statistic title="Total payouts paid" value={statsQuery.data?.totalPayoutsPaid ?? 0} formatter={() => money(statsQuery.data?.totalPayoutsPaid ?? 0, currency)} />
        </div>
      </Card>

      <Card styles={{ body: { paddingTop: 8 } }}>
        <Tabs
          items={[
            {
              key: "earnings",
              label: "Earnings",
              children: (
                <div className="space-y-3">
                  <Input
                    allowClear
                    placeholder="Search earnings…"
                    value={earningsSearch}
                    onChange={(e) => {
                      setEarningsPage(1);
                      setEarningsSearch(e.target.value);
                    }}
                  />
                  <Table<StorefrontEarningDto>
                    rowKey="id"
                    columns={earningsColumns}
                    dataSource={earningsQuery.data?.data ?? []}
                    loading={earningsQuery.isLoading || earningsQuery.isFetching}
                    scroll={{ x: 700 }}
                    locale={{ emptyText: <Empty description="No earnings" /> }}
                    pagination={{
                      current: earningsPage,
                      pageSize: earningsPageSize,
                      total: Number(earningsQuery.data?.count ?? 0),
                      showSizeChanger: true,
                      onChange: (p, ps) => {
                        setEarningsPage(p);
                        setEarningsPageSize(ps);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "transactions",
              label: "Transactions",
              children: (
                <div className="space-y-3">
                  <Input
                    allowClear
                    placeholder="Search transactions…"
                    value={txSearch}
                    onChange={(e) => {
                      setTxPage(1);
                      setTxSearch(e.target.value);
                    }}
                  />
                  <Table<StorefrontWalletTransactionDto>
                    rowKey="id"
                    columns={txColumns}
                    dataSource={txQuery.data?.data ?? []}
                    loading={txQuery.isLoading || txQuery.isFetching}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: <Empty description="No transactions" /> }}
                    pagination={{
                      current: txPage,
                      pageSize: txPageSize,
                      total: Number(txQuery.data?.count ?? 0),
                      showSizeChanger: true,
                      onChange: (p, ps) => {
                        setTxPage(p);
                        setTxPageSize(ps);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "history",
              label: "Settlement history",
              children: (
                <Table<StorefrontWalletTransactionDto>
                  rowKey="id"
                  columns={txColumns}
                  dataSource={historyQuery.data?.data ?? []}
                  loading={historyQuery.isLoading}
                  scroll={{ x: 900 }}
                  locale={{ emptyText: <Empty description="No history" /> }}
                  pagination={{
                    current: txPage,
                    pageSize: txPageSize,
                    total: Number(historyQuery.data?.count ?? 0),
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                      setTxPage(p);
                      setTxPageSize(ps);
                    },
                  }}
                />
              ),
            },
            {
              key: "orders",
              label: "Orders",
              children: (
                <div className="space-y-3">
                  <Input
                    allowClear
                    placeholder="Search orders…"
                    value={ordersSearch}
                    onChange={(e) => {
                      setOrdersPage(1);
                      setOrdersSearch(e.target.value);
                    }}
                  />
                  <Table<StorefrontWalletOrderDto>
                    rowKey="orderId"
                    columns={ordersColumns}
                    dataSource={ordersQuery.data?.data ?? []}
                    loading={ordersQuery.isLoading}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: <Empty description="No orders" /> }}
                    pagination={{
                      current: ordersPage,
                      pageSize: ordersPageSize,
                      total: Number(ordersQuery.data?.count ?? 0),
                      showSizeChanger: true,
                      onChange: (p, ps) => {
                        setOrdersPage(p);
                        setOrdersPageSize(ps);
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: "payouts",
              label: "Payouts",
              children: (
                <Table<StorefrontPayoutDto>
                  rowKey="id"
                  columns={payoutsColumns}
                  dataSource={payoutsQuery.data?.data ?? []}
                  loading={payoutsQuery.isLoading}
                  scroll={{ x: 700 }}
                  locale={{ emptyText: <Empty description="No payouts" /> }}
                  pagination={{
                    current: payoutsPage,
                    pageSize: payoutsPageSize,
                    total: Number(payoutsQuery.data?.count ?? 0),
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                      setPayoutsPage(p);
                      setPayoutsPageSize(ps);
                    },
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <WalletAdjustmentModal
        open={creditOpen}
        mode="credit"
        loading={adjusting}
        onOpenChange={setCreditOpen}
        onSubmit={(v) => handleWalletAdjust("credit", v)}
      />
      <WalletAdjustmentModal
        open={debitOpen}
        mode="debit"
        loading={adjusting}
        onOpenChange={setDebitOpen}
        onSubmit={(v) => handleWalletAdjust("debit", v)}
      />

      <RecordStorefrontOrderModal
        open={recordOrderOpen}
        ownerId={storeOwnerId}
        mode="order"
        onOpenChange={setRecordOrderOpen}
        onSuccess={() => {
          ordersQuery.refetch();
          invalidateWallet();
        }}
      />
      <RecordStorefrontOrderModal
        open={recordSettlementOpen}
        ownerId={storeOwnerId}
        mode="settlement"
        onOpenChange={setRecordSettlementOpen}
        onSuccess={() => {
          ordersQuery.refetch();
          invalidateWallet();
        }}
      />

      <Modal
        open={payoutRequestOpen}
        title="Request payout"
        onCancel={() => setPayoutRequestOpen(false)}
        onOk={async () => {
          try {
            const values = await payoutForm.validateFields();
            const res = await requestStorefrontPayout(values);
            if (!res.status) {
              message.error(res.message ?? "Payout request failed");
              return;
            }
            message.success("Payout requested");
            setPayoutRequestOpen(false);
            payoutsQuery.refetch();
          } catch {
            // validation
          }
        }}
        destroyOnClose
      >
        <Form form={payoutForm} layout="vertical" className="mt-4" initialValues={{ currency: "NGN" }}>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber className="!w-full" min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="bankCode" label="Bank code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accountNumber" label="Account number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accountName" label="Account name">
            <Input />
          </Form.Item>
          <Form.Item name="currency" label="Currency" rules={[{ required: true, len: 3 }]}>
            <Input maxLength={3} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={orderOpen}
        onOpenChange={(v) => {
          setOrderOpen(v);
          if (!v) setSelectedOrderId(null);
        }}
      />

      <PayoutDetailModal
        payoutId={selectedPayoutId}
        open={payoutOpen}
        onOpenChange={(v) => {
          setPayoutOpen(v);
          if (!v) setSelectedPayoutId(null);
        }}
        onUpdated={() => payoutsQuery.refetch()}
      />
    </div>
  );
}
