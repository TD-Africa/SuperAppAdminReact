import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  getStorefrontEarnings,
  getStorefrontEarningsSummary,
  getStorefrontWalletBalance,
  getStorefrontWalletLedger,
} from "@/lib/storefrontApi";
import type {
  StorefrontEarningDto,
  StorefrontWalletLedgerDto,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

function money(amount: number, currency: string | null | undefined) {
  const code = currency === "USD" ? "USD" : "NGN";
  return formatCurrency(amount, code);
}

function statusTag(status: string | null | undefined) {
  if (!status) return <Tag>—</Tag>;
  const lower = status.toLowerCase();
  if (lower === "pending") return <Tag color="processing">{status}</Tag>;
  if (lower === "available" || lower === "completed" || lower === "success") {
    return <Tag color="success">{status}</Tag>;
  }
  if (lower === "reversed" || lower === "failed" || lower === "cancelled") {
    return <Tag color="error">{status}</Tag>;
  }
  if (lower === "withdrawn") return <Tag color="default">{status}</Tag>;
  return <Tag>{status}</Tag>;
}

export default function FranchiseStoreOwnerDetailPage() {
  const { storeOwnerId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = AntdApp.useApp();

  const companyName = searchParams.get("company") ?? "";
  const ownerName = searchParams.get("owner") ?? "";
  const userName = searchParams.get("user") ?? "";

  const ownerScope = useMemo(
    () => (storeOwnerId ? { ownerId: storeOwnerId } : {}),
    [storeOwnerId],
  );

  const [earningsSearch, setEarningsSearch] = useState("");
  const debouncedEarningsSearch = useDebouncedValue(earningsSearch, 350);
  const [earningsPage, setEarningsPage] = useState(1);
  const [earningsPageSize, setEarningsPageSize] = useState(20);

  const [ledgerSearch, setLedgerSearch] = useState("");
  const debouncedLedgerSearch = useDebouncedValue(ledgerSearch, 350);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(20);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  const balanceQuery = useQuery({
    queryKey: ["storefront", "wallet-balance", ownerScope],
    queryFn: async () => {
      const res = await getStorefrontWalletBalance(ownerScope);
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet balance");
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

  const ledgerParams = useMemo(
    () => ({
      ...ownerScope,
      PageSize: ledgerPageSize,
      PageNumber: ledgerPage,
      SearchString: debouncedLedgerSearch.trim() || undefined,
    }),
    [ownerScope, ledgerPageSize, ledgerPage, debouncedLedgerSearch],
  );

  const ledgerQuery = useQuery({
    queryKey: ["storefront", "wallet-ledger", ledgerParams],
    queryFn: async () => {
      const res = await getStorefrontWalletLedger(ledgerParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet ledger");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  useEffect(() => {
    const err =
      balanceQuery.error ??
      summaryQuery.error ??
      earningsQuery.error ??
      ledgerQuery.error;
    if (err) {
      message.error(err instanceof Error ? err.message : "Unable to load store owner wallet.");
    }
  }, [
    balanceQuery.error,
    summaryQuery.error,
    earningsQuery.error,
    ledgerQuery.error,
    message,
  ]);

  const title =
    companyName.trim() ||
    ownerName.trim() ||
    userName.trim() ||
    "Store owner";

  const currency =
    balanceQuery.data?.currency ??
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
      title: "Gross",
      dataIndex: "grossAmount",
      align: "right",
      render: (v: number, row) => money(v, row.currency),
    },
    {
      title: "SuperApp",
      dataIndex: "superAppAmount",
      align: "right",
      render: (v: number, row) => money(v, row.currency),
    },
    {
      title: "Fees",
      dataIndex: "fees",
      align: "right",
      render: (v: number, row) => money(v, row.currency),
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

  const ledgerColumns: TableColumnsType<StorefrontWalletLedgerDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">{formatDate(v)}</span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 120,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v: number) => (
        <span className={v < 0 ? "text-red-600" : "font-medium"}>{money(v, currency)}</span>
      ),
    },
    {
      title: "Before",
      dataIndex: "balanceBefore",
      align: "right",
      render: (v: number) => money(v, currency),
    },
    {
      title: "After",
      dataIndex: "balanceAfter",
      align: "right",
      render: (v: number) => money(v, currency),
    },
    {
      title: "Reference",
      key: "reference",
      render: (_, row) => row.paymentReference ?? row.reference ?? row.externalOrderId ?? "—",
    },
    {
      title: "Description",
      dataIndex: "description",
      ellipsis: true,
      render: (v: string | null) => v?.trim() || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string | null) => statusTag(v),
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
            {[ownerName, userName].filter(Boolean).join(" · ") || "Wallet, earnings, and ledger"}
          </Typography.Text>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card loading={balanceQuery.isLoading}>
          <Statistic
            title="Current balance"
            value={balanceQuery.data?.balance ?? 0}
            formatter={() => money(balanceQuery.data?.balance ?? 0, currency)}
            valueStyle={{ color: "#800020", fontWeight: 600 }}
          />
          <Typography.Text type="secondary" className="text-xs">
            {balanceQuery.data?.updatedAt
              ? `Updated ${formatDate(balanceQuery.data.updatedAt)}`
              : "—"}
          </Typography.Text>
        </Card>
        <Card loading={summaryQuery.isLoading}>
          <Statistic
            title="Available"
            value={summaryQuery.data?.available ?? 0}
            formatter={() => money(summaryQuery.data?.available ?? 0, currency)}
          />
        </Card>
        <Card loading={summaryQuery.isLoading}>
          <Statistic
            title="Total earned"
            value={summaryQuery.data?.totalEarned ?? 0}
            formatter={() => money(summaryQuery.data?.totalEarned ?? 0, currency)}
          />
        </Card>
      </div>

      <Card loading={summaryQuery.isLoading}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Statistic
            title="Pending"
            value={summaryQuery.data?.pending ?? 0}
            formatter={() => money(summaryQuery.data?.pending ?? 0, currency)}
          />
          <Statistic
            title="Available"
            value={summaryQuery.data?.available ?? 0}
            formatter={() => money(summaryQuery.data?.available ?? 0, currency)}
          />
          <Statistic
            title="Withdrawn"
            value={summaryQuery.data?.withdrawn ?? 0}
            formatter={() => money(summaryQuery.data?.withdrawn ?? 0, currency)}
          />
          <Statistic
            title="Reversed"
            value={summaryQuery.data?.reversed ?? 0}
            formatter={() => money(summaryQuery.data?.reversed ?? 0, currency)}
          />
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
                    scroll={{ x: 900 }}
                    locale={{ emptyText: <Empty description="No earnings" /> }}
                    pagination={{
                      current: earningsPage,
                      pageSize: earningsPageSize,
                      total: Number(earningsQuery.data?.count ?? 0),
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50, 100],
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
              key: "ledger",
              label: "Ledger",
              children: (
                <div className="space-y-3">
                  <Input
                    allowClear
                    placeholder="Search ledger…"
                    value={ledgerSearch}
                    onChange={(e) => {
                      setLedgerPage(1);
                      setLedgerSearch(e.target.value);
                    }}
                  />
                  <Table<StorefrontWalletLedgerDto>
                    rowKey="id"
                    columns={ledgerColumns}
                    dataSource={ledgerQuery.data?.data ?? []}
                    loading={ledgerQuery.isLoading || ledgerQuery.isFetching}
                    scroll={{ x: 1100 }}
                    locale={{ emptyText: <Empty description="No ledger entries" /> }}
                    pagination={{
                      current: ledgerPage,
                      pageSize: ledgerPageSize,
                      total: Number(ledgerQuery.data?.count ?? 0),
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50, 100],
                      onChange: (p, ps) => {
                        setLedgerPage(p);
                        setLedgerPageSize(ps);
                      },
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Space>
        <Button type="link" className="!px-0" onClick={() => navigate("/franchise-store-owners")}>
          ← Back to store owners
        </Button>
      </Space>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={orderOpen}
        onOpenChange={(v) => {
          setOrderOpen(v);
          if (!v) setSelectedOrderId(null);
        }}
      />
    </div>
  );
}
