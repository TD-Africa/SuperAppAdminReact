import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined, CalculatorOutlined, DownOutlined, EditOutlined, EyeOutlined, MessageOutlined, ShopOutlined, UpOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import {
  addStorefrontTicketComment,
  configureStorefrontOwner,
  getLegacyStorefrontWalletBalance,
  getLegacyStorefrontWalletOrders,
  getLegacyStorefrontWalletStats,
  getLegacyStorefrontWalletLedger,
  getOwnerProduct,
  getOwnerProducts,
  getOwnerQuote,
  getStorefrontBrands,
  getStorefrontEarnings,
  getStorefrontEarningsSummary,
  getStorefrontOwner,
  getStorefrontOwnerBrands,
  getStorefrontTicket,
  getStorefrontTickets,
} from "@/lib/storefrontApi";
import type {
  StorefrontEarningDto,
  StorefrontOwnerBrandDto,
  StorefrontOwnerConfigurationRequest,
  StorefrontOwnerDetailDto,
  StorefrontProductDto,
  StorefrontVariantDto,
  StorefrontWalletOrderDto,
  StorefrontWalletTransactionDto,
} from "@/lib/storefrontTypes";
import {
  aggregateStorefrontAvailability,
  formatStorefrontNaira,
  pickDisplayVariant,
} from "@/lib/storefrontTypes";
import type { LocationReturnDTO, TicketResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

const ALL = "__all__";

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

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const [catalogSearch, setCatalogSearch] = useState("");
  const debouncedCatalogSearch = useDebouncedValue(catalogSearch, 350);
  const [catalogBrandId, setCatalogBrandId] = useState<string>(ALL);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(20);
  const [catalogProductId, setCatalogProductId] = useState<string | null>(null);
  const [catalogDetailOpen, setCatalogDetailOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const ownerScope = useMemo(
    () => (storeOwnerId ? { ownerId: storeOwnerId } : {}),
    [storeOwnerId],
  );

  const walletQuery = useQuery({
    queryKey: ["admin-storefront-wallet", storeOwnerId],
    queryFn: async () => {
      const res = await getLegacyStorefrontWalletBalance(storeOwnerId!);
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-storefront-wallet-stats", storeOwnerId],
    queryFn: async () => {
      const res = await getLegacyStorefrontWalletStats(storeOwnerId!);
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
      const res = await getLegacyStorefrontWalletLedger(storeOwnerId!, txParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load transactions");
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
      const res = await getLegacyStorefrontWalletOrders(storeOwnerId!, ordersParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load orders");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const ownerQuery = useQuery({
    queryKey: ["storefront-owner-detail", storeOwnerId],
    queryFn: async () => {
      const res = await getStorefrontOwner(storeOwnerId!);
      if (!res.status) throw new Error(res.message ?? "Failed to load owner");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const ownerBrandsQuery = useQuery({
    queryKey: ["storefront-owner-brands", storeOwnerId],
    queryFn: async () => {
      const res = await getStorefrontOwnerBrands(storeOwnerId!);
      if (!res.status) throw new Error(res.message ?? "Failed to load owner brands");
      return res.data ?? [];
    },
    enabled: !!storeOwnerId,
  });

  const ticketsQuery = useQuery({
    queryKey: ["storefront-owner-tickets", storeOwnerId],
    queryFn: async () => {
      const res = await getStorefrontTickets(storeOwnerId!, {
        PageSize: 50,
        PageNumber: 1,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load tickets");
      return res.data?.data ?? [];
    },
    enabled: !!storeOwnerId,
  });

  const catalogParams = useMemo(
    () => ({
      PageSize: catalogPageSize,
      PageNumber: catalogPage,
      SearchString: debouncedCatalogSearch.trim() || undefined,
      storefrontBrandId: catalogBrandId !== ALL ? catalogBrandId : undefined,
    }),
    [catalogPageSize, catalogPage, debouncedCatalogSearch, catalogBrandId],
  );

  const catalogProductsQuery = useQuery({
    queryKey: ["storefront", "owner-products", storeOwnerId, catalogParams],
    queryFn: async () => {
      const res = await getOwnerProducts(storeOwnerId!, catalogParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load owner products");
      return res.data;
    },
    enabled: !!storeOwnerId,
  });

  const catalogBrandOptions = useMemo(() => {
    const options = (ownerBrandsQuery.data ?? []).map((b) => ({
      value: b.storefrontBrandId,
      label: b.name ?? b.storefrontBrandId.slice(0, 8),
    }));
    return [{ value: ALL, label: "All brands" }, ...options];
  }, [ownerBrandsQuery.data]);

  useEffect(() => {
    const err =
      walletQuery.error ??
      statsQuery.error ??
      summaryQuery.error ??
      earningsQuery.error ??
      txQuery.error ??
      ordersQuery.error;
    if (err) {
      message.error(err instanceof Error ? err.message : "Unable to load store owner.");
    }
  }, [
    walletQuery.error,
    statsQuery.error,
    summaryQuery.error,
    earningsQuery.error,
    txQuery.error,
    ordersQuery.error,
    message,
  ]);

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
  const superAdminCommissionDebited = statsQuery.data?.superAdminCommissionDebited ?? 0;

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
    {
      title: "Type",
      dataIndex: "type",
      width: 110,
      render: (v: string | null) => {
        if (!v) return <Tag>—</Tag>;
        const lower = v.toLowerCase();
        if (lower === "debit") return <Tag color="error">Debit</Tag>;
        if (lower === "credit") return <Tag color="success">Credit</Tag>;
        return <Tag>{v}</Tag>;
      },
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
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrderId(row.orderId);
            setOrderOpen(true);
          }}
        >
          {v ?? row.externalOrderId ?? row.orderId.slice(0, 8)}
        </Button>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      render: (v) => v ?? "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => money(v, currency),
    },
    // {
    //   title: "Owner commission",
    //   dataIndex: "storefrontOwnerCommissionAmount",
    //   align: "right",
    //   render: (_, row) =>
    //     money(
    //       row.storefrontOwnerCommissionAmount ??
    //         row.commission ??
    //         0,
    //       currency,
    //     ),
    // },
    {
      title: "OEM commission",
      dataIndex: "storefrontOemCommissionAmount",
      align: "right",
      render: (_, row) =>
        money(
          row.storefrontOemCommissionAmount ?? 0,
          currency,
        ),
    },
    {
      title: "Super admin commission",
      dataIndex: "superAdminCommissionAmount",
      align: "right",
      render: (_, row) => money(row.superAdminCommissionAmount ?? 0, currency),
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
    {
      title: "Status",
      dataIndex: "orderStatus",
      render: (v) => statusTag(v),
    },
  ];

  const ticketColumns: TableColumnsType<TicketResponse> = [
    {
      title: "Topic",
      dataIndex: "topic",
      render: (v: string | null, row) => (
        <Button
          type="link"
          className="!px-0"
          onClick={() => {
            setSelectedTicketId(row.id);
            setTicketOpen(true);
          }}
        >
          {v ?? row.description.slice(0, 40)}
        </Button>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 130,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => {
        const lower = v.toLowerCase();
        const color =
          lower === "opened" ? "success" : lower === "pending" ? "warning" : "default";
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: "Opened",
      dataIndex: "dateOpened",
      width: 160,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
  ];

  const catalogColumns: TableColumnsType<StorefrontProductDto> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v: string, row) => {
        const img = row.images?.[0];
        return (
          <Space>
            {img ? <img src={img} alt="" className="h-8 w-8 rounded object-cover" /> : null}
            <span className="font-medium">{v ?? row.productId}</span>
          </Space>
        );
      },
    },
    { title: "Brand", dataIndex: "brandName", render: (v) => v ?? "—" },
    {
      title: "Variants",
      dataIndex: "variants",
      align: "right",
      width: 90,
      render: (v: StorefrontVariantDto[] | null) => (v?.length ?? 0).toString(),
    },
    {
      title: "Available qty",
      align: "right",
      width: 120,
      render: (_, row) => formatNumber(aggregateStorefrontAvailability(row).totalQty),
    },
    {
      title: "Price",
      align: "right",
      width: 130,
      render: (_, row) => {
        const v = pickDisplayVariant(row);
        return v ? (
          <span className="font-medium">{formatStorefrontNaira(v.storefrontPrice)}</span>
        ) : (
          "—"
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setCatalogProductId(row.productId);
            setCatalogDetailOpen(true);
          }}
        />
      ),
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
          {[ownerName, userName].filter(Boolean).join(" · ") ||
            "Read-only storefront activity for this owner"}
        </Typography.Text>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card loading={walletQuery.isLoading || statsQuery.isLoading}>
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
          <Statistic
            title="Total orders"
            value={statsQuery.data?.totalOrders ?? 0}
          />
        </Card>

        <Card loading={statsQuery.isLoading}>
          <Statistic
            title="Revenue"
            value={statsQuery.data?.revenue ?? 0}
            formatter={() => money(statsQuery.data?.revenue ?? 0, currency)}
          />
        </Card>

        <Card loading={statsQuery.isLoading}>
          <Statistic
            title="Super admin commission"
            value={superAdminCommissionDebited}
            formatter={() => money(superAdminCommissionDebited, currency)}
          />
        </Card>
      </div>

      <Card
        title="Owner overview"
        loading={ownerQuery.isLoading}
        extra={
          <Space size={4}>
            <Button
              size="small"
              icon={overviewOpen ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setOverviewOpen((v) => !v)}
            >
              {overviewOpen ? "Hide details" : "View details"}
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setConfigOpen(true)}
            >
              Configure
            </Button>
          </Space>
        }
      >
        {overviewOpen ? (
          <div className="space-y-4">
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small" colon={false}>
            <Descriptions.Item label="Email">
              {ownerQuery.data?.email ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              {ownerQuery.data?.phoneNumber ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="CAC verified">
              <Tag color={ownerQuery.data?.isCacVerified ? "success" : "default"}>
                {ownerQuery.data?.isCacVerified ? "Yes" : "No"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="User status">
              {ownerQuery.data ? (
                <Tag
                  color={
                    ownerQuery.data.isSuspended
                      ? "error"
                      : (ownerQuery.data.userStatus ?? "").toLowerCase() === "active"
                        ? "success"
                        : "default"
                  }
                >
                  {ownerQuery.data.isSuspended
                    ? "Suspended"
                    : ownerQuery.data.userStatus ?? ownerQuery.data.isActive
                      ? "Active"
                      : "—"}
                </Tag>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Invite">
              {ownerQuery.data?.isInvitationAccepted ? (
                <Tag color="success">Accepted</Tag>
              ) : ownerQuery.data?.isInvited ? (
                <Tag color="processing">Invited</Tag>
              ) : (
                <Tag>Not invited</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Default margin">
              {ownerQuery.data?.defaultStorefrontPriceMargin != null
                ? `${ownerQuery.data.defaultStorefrontPriceMargin}%`
                : "—"}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Typography.Text strong className="mb-2 block">
              Brands ({ownerBrandsQuery.data?.length ?? 0})
            </Typography.Text>
            <Table<StorefrontOwnerBrandDto>
              rowKey="storefrontBrandId"
              size="small"
              loading={ownerBrandsQuery.isLoading}
              dataSource={ownerBrandsQuery.data ?? []}
              locale={{ emptyText: <Empty description="No brands configured" /> }}
              pagination={false}
              columns={[
                {
                  title: "Brand",
                  dataIndex: "name",
                  render: (v: string | null, row) => (
                    <span>
                      {v ?? "—"}
                      {row.isPrimary && (
                        <Tag color="gold" className="ml-2">
                          Primary
                        </Tag>
                      )}
                    </span>
                  ),
                },
                {
                  title: "Margin",
                  dataIndex: "storefrontPriceMargin",
                  align: "right",
                  render: (v: number | null, row) =>
                    v != null
                      ? `${v}%`
                      : row.ownerDefaultStorefrontPriceMargin != null
                        ? `${row.ownerDefaultStorefrontPriceMargin}% (owner default)`
                        : `${row.globalStorefrontPriceMargin}% (global)`,
                },
              ]}
            />
          </div>
        </div>
        ) : null}
      </Card>

      <Card styles={{ body: { paddingTop: 8 } }}>
        <Tabs
          defaultActiveKey="orders"
          items={[
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
                    onRow={(row) => ({
                      onClick: () => {
                        setSelectedOrderId(row.orderId);
                        setOrderOpen(true);
                      },
                      style: { cursor: "pointer" },
                    })}
                    loading={ordersQuery.isLoading || ordersQuery.isFetching}
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
                    scroll={{ x: 900 }}
                  />
                </div>
              ),
            },
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
                    scroll={{ x: 700 }}
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
                    scroll={{ x: 800 }}
                  />
                </div>
              ),
            },
            {
              key: "tickets",
              label: "Tickets",
              children: (
                <div className="space-y-3">
                  <Table<TicketResponse>
                    rowKey="id"
                    columns={ticketColumns}
                    dataSource={ticketsQuery.data ?? []}
                    loading={ticketsQuery.isLoading || ticketsQuery.isFetching}
                    locale={{ emptyText: <Empty description="No tickets" /> }}
                    pagination={false}
                    scroll={{ x: 600 }}
                  />
                </div>
              ),
            },
            {
              key: "catalog",
              label: "Catalog",
              children: (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      allowClear
                      placeholder="Search products…"
                      value={catalogSearch}
                      onChange={(e) => {
                        setCatalogPage(1);
                        setCatalogSearch(e.target.value);
                      }}
                      style={{ width: 260 }}
                      prefix={<ShopOutlined className="text-muted-foreground" />}
                    />
                    <Select
                      value={catalogBrandId}
                      onChange={(v) => {
                        setCatalogPage(1);
                        setCatalogBrandId(v);
                      }}
                      options={catalogBrandOptions}
                      loading={ownerBrandsQuery.isLoading}
                      style={{ width: 200 }}
                    />
                    <Button
                      type="primary"
                      icon={<CalculatorOutlined />}
                      onClick={() => setQuoteOpen(true)}
                    >
                      Get quote
                    </Button>
                  </div>
                  <Table<StorefrontProductDto>
                    rowKey="productId"
                    columns={catalogColumns}
                    dataSource={catalogProductsQuery.data?.data ?? []}
                    loading={catalogProductsQuery.isLoading || catalogProductsQuery.isFetching}
                    locale={{ emptyText: <Empty description="No products for this owner" /> }}
                    pagination={{
                      current: catalogPage,
                      pageSize: catalogPageSize,
                      total: Number(catalogProductsQuery.data?.count ?? 0),
                      showSizeChanger: true,
                      onChange: (p, ps) => {
                        setCatalogPage(p);
                        setCatalogPageSize(ps);
                      },
                    }}
                    scroll={{ x: 800 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={orderOpen}
        onOpenChange={(v) => {
          setOrderOpen(v);
          if (!v) setSelectedOrderId(null);
        }}
        onUpdated={() => ordersQuery.refetch()}
      />

      <StorefrontTicketModal
        ownerId={storeOwnerId}
        ticketId={selectedTicketId}
        open={ticketOpen}
        onOpenChange={(v) => {
          setTicketOpen(v);
          if (!v) setSelectedTicketId(null);
        }}
        onUpdated={() => ticketsQuery.refetch()}
      />

      <OwnerConfigModal
        ownerId={storeOwnerId}
        owner={ownerQuery.data ?? null}
        brands={ownerBrandsQuery.data ?? []}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onUpdated={() => {
          ownerQuery.refetch();
          ownerBrandsQuery.refetch();
        }}
      />

      <OwnerProductModal
        ownerId={storeOwnerId}
        productId={catalogProductId}
        open={catalogDetailOpen}
        onOpenChange={(v) => {
          setCatalogDetailOpen(v);
          if (!v) setCatalogProductId(null);
        }}
      />

      <OwnerQuoteModal
        ownerId={storeOwnerId}
        ownerName={title}
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
      />
    </div>
  );
}

function StorefrontTicketModal({
  ownerId,
  ticketId,
  open,
  onOpenChange,
  onUpdated,
}: {
  ownerId: string;
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["storefront-owner-ticket", ownerId, ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const res = await getStorefrontTicket(ownerId, ticketId);
      if (!res.status) throw new Error(res.message ?? "Failed to load ticket");
      return res.data;
    },
    enabled: !!ticketId && open,
  });

  useEffect(() => {
    if (!open) setComment("");
  }, [open]);

  async function addComment() {
    if (!data || !ticketId) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      message.error("Comment cannot be empty");
      return;
    }
    setPosting(true);
    const res = await addStorefrontTicketComment(ownerId, ticketId, {
      comment: trimmed,
    });
    setPosting(false);
    if (!res.status) {
      message.error(res.message ?? "Failed to post comment");
      return;
    }
    setComment("");
    refetch();
    onUpdated();
  }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={
        <div>
          <div>{data?.topic ?? "Ticket"}</div>
          <div className="mt-0.5 text-xs font-normal text-muted-foreground">
            {data ? `#${data.id.slice(0, 8)}` : "Loading…"}
          </div>
        </div>
      }
      width={760}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Card loading />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Tag>{data.category}</Tag>
            <Tag
              color={
                data.status === "Opened"
                  ? "success"
                  : data.status === "Pending"
                    ? "warning"
                    : "default"
              }
            >
              {data.status}
            </Tag>
          </div>

          <div>
            <Typography.Text type="secondary" className="text-xs uppercase">
              Description
            </Typography.Text>
            <p className="mt-1 whitespace-pre-wrap text-sm">{data.description}</p>
          </div>

          <div className="space-y-2">
            <Typography.Text strong>
              Conversation ({data.comments?.length ?? 0})
            </Typography.Text>
            {!data.comments || data.comments.length === 0 ? (
              <Empty description="No comments yet." />
            ) : (
              data.comments.map((c) => (
                <Card
                  key={c.id}
                  size="small"
                  className={c.isAdmin ? "border-primary bg-primary/5" : undefined}
                  title={c.isAdmin ? "Admin" : data.user?.companyName ?? "Customer"}
                  extra={
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.dateCreated)}
                    </span>
                  }
                >
                  <p className="whitespace-pre-wrap text-sm">{c.comment}</p>
                </Card>
              ))
            )}
          </div>

          {data.status !== "Closed" && (
            <div className="space-y-2">
              <Typography.Text strong>Add a comment</Typography.Text>
              <Input.TextArea
                rows={3}
                maxLength={600}
                showCount
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type your response…"
              />
              <Button
                type="primary"
                icon={<MessageOutlined />}
                loading={posting}
                onClick={addComment}
              >
                Post comment
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function OwnerConfigModal({
  ownerId,
  owner,
  brands,
  open,
  onOpenChange,
  onUpdated,
}: {
  ownerId: string;
  owner: StorefrontOwnerDetailDto | null;
  brands: StorefrontOwnerBrandDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [saving, setSaving] = useState(false);
  const [primaryBrandId, setPrimaryBrandId] = useState<string | null>(null);
  const [defaultMargin, setDefaultMargin] = useState<number | null>(null);
  const [margins, setMargins] = useState<Record<string, number | null>>({});
  const [assignedBrandIds, setAssignedBrandIds] = useState<string[]>([]);

  // All storefront brands — the pool an owner can be assigned to.
  const allBrandsQuery = useQuery({
    queryKey: ["storefront", "brands", "all"],
    queryFn: async () => {
      const res = await getStorefrontBrands({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setPrimaryBrandId(owner?.primaryStorefrontBrandId ?? null);
    setDefaultMargin(owner?.defaultStorefrontPriceMargin ?? null);
    const next: Record<string, number | null> = {};
    for (const b of brands) {
      next[b.storefrontBrandId] = b.storefrontPriceMargin;
    }
    setMargins(next);
    setAssignedBrandIds(brands.map((b) => b.storefrontBrandId));
  }, [open, owner, brands]);

  async function save() {
    setSaving(true);
    try {
      const body: StorefrontOwnerConfigurationRequest = {
        storefrontBrandIds: assignedBrandIds,
        primaryStorefrontBrandId: primaryBrandId,
        defaultStorefrontPriceMargin: defaultMargin,
        brandMargins: brands
          .filter((b) => margins[b.storefrontBrandId] !== b.storefrontPriceMargin)
          .map((b) => ({
            ownerId,
            storefrontBrandId: b.storefrontBrandId,
            storefrontPriceMargin: margins[b.storefrontBrandId],
          })),
      };
      const res = await configureStorefrontOwner(ownerId, body);
      if (!res.status) {
        message.error(res.message ?? "Save failed");
        return;
      }
      message.success(res.message ?? "Configuration saved");
      onUpdated();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const allBrands = allBrandsQuery.data ?? [];

  const brandOptions = allBrands.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="Configure owner"
      okText="Save"
      confirmLoading={saving}
      onOk={save}
      width={640}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label="Assigned brands">
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Assign storefront brands…"
            value={assignedBrandIds}
            onChange={setAssignedBrandIds}
            options={brandOptions}
            loading={allBrandsQuery.isLoading}
            style={{ width: "100%" }}
            notFoundContent={
              allBrandsQuery.isLoading
                ? "Loading brands…"
                : "No storefront brands found"
            }
          />
        </Form.Item>
        <Form.Item label="Primary brand">
          <Select
            allowClear
            placeholder="Select primary brand"
            value={primaryBrandId ?? undefined}
            onChange={(v) => setPrimaryBrandId(v ?? null)}
            options={brandOptions}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item label="Default storefront price margin (%)">
          <InputNumber
            min={0}
            value={defaultMargin}
            onChange={(v) => setDefaultMargin(v ?? null)}
            style={{ width: "100%" }}
            placeholder="e.g. 15"
          />
        </Form.Item>

        {brands.length > 0 && (
          <div>
            <Typography.Text strong className="mb-2 block">
              Per-brand margins
            </Typography.Text>
            <div className="space-y-2">
              {brands.map((b) => (
                <div
                  key={b.storefrontBrandId}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    {b.name ?? b.storefrontBrandId.slice(0, 8)}
                    {b.isPrimary && <Tag color="gold">Primary</Tag>}
                  </span>
                  <InputNumber
                    min={0}
                    value={margins[b.storefrontBrandId]}
                    onChange={(v) =>
                      setMargins((prev) => ({
                        ...prev,
                        [b.storefrontBrandId]: v ?? null,
                      }))
                    }
                    addonAfter="%"
                    style={{ width: 140 }}
                    placeholder={b.globalStorefrontPriceMargin.toString()}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
}

function OwnerProductModal({
  ownerId,
  productId,
  open,
  onOpenChange,
}: {
  ownerId: string;
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["storefront", "owner-product", ownerId, productId],
    queryFn: async () => {
      if (!productId) return null;
      const res = await getOwnerProduct(ownerId, productId);
      if (!res.status) throw new Error(res.message ?? "Failed to load product");
      return res.data;
    },
    enabled: !!productId && open,
  });

  const variants = data?.variants ?? [];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data ? data.productName : "Product"}
      width={720}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Card loading />
      ) : (
        <div className="space-y-4">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="Brand">{data.brandName ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Published">
              <Tag color={data.isStorefrontPublished ? "success" : "default"}>
                {data.isStorefrontPublished ? "Yes" : "No"}
              </Tag>
            </Descriptions.Item>
            {data.shortDescription && (
              <Descriptions.Item label="Description" span={2}>
                {data.shortDescription}
              </Descriptions.Item>
            )}
          </Descriptions>

          <Table<StorefrontVariantDto>
            size="small"
            rowKey="id"
            title={() => <span className="font-medium">Variants</span>}
            dataSource={variants}
            pagination={false}
            scroll={{ x: 600 }}
            columns={[
              {
                title: "Variant ID",
                dataIndex: "id",
                render: (v: string) => <span className="font-mono text-xs">{v.slice(0, 8)}</span>,
              },
              {
                title: "Default",
                dataIndex: "isDefault",
                width: 80,
                render: (v: boolean) => (v ? <Tag color="gold">Default</Tag> : null),
              },
              {
                title: "Base price",
                dataIndex: "priceInNaira",
                align: "right",
                render: (v: number) => formatStorefrontNaira(v),
              },
              {
                title: "Storefront price",
                dataIndex: "storefrontPrice",
                align: "right",
                render: (v: number) => (
                  <span className="font-medium">{formatStorefrontNaira(v)}</span>
                ),
              },
              {
                title: "Available",
                dataIndex: "availableQuantity",
                align: "right",
                render: (v: number) => formatNumber(v),
              },
              {
                title: "Status",
                dataIndex: "isAvailable",
                width: 90,
                render: (v: boolean) => (
                  <Tag color={v ? "success" : "default"}>{v ? "Available" : "Unavailable"}</Tag>
                ),
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}

type QuoteLine = {
  productId?: string;
  variantId?: string;
  locationId?: string;
  quantity?: number;
};

function OwnerQuoteModal({
  ownerId,
  ownerName,
  open,
  onOpenChange,
}: {
  ownerId: string;
  ownerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { message } = AntdApp.useApp();
  const [lines, setLines] = useState<QuoteLine[]>([{}]);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof getOwnerQuote>>["data"] | null>(
    null,
  );

  const productsQuery = useQuery({
    queryKey: ["storefront", "owner-products", ownerId, "quote-picker"],
    queryFn: async () => {
      const res = await getOwnerProducts(ownerId, { PageSize: 200, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load products");
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", "owner-quote"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load locations");
      return res.data ?? [];
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (open) {
      setLines([{}]);
      setQuote(null);
    }
  }, [open]);

  const productOptions = (productsQuery.data ?? []).map((p) => ({
    value: p.productId,
    label: p.productName ?? p.productId,
  }));

  const variantOptions = (productId?: string) => {
    const product = (productsQuery.data ?? []).find((p) => p.productId === productId);
    return (product?.variants ?? []).map((v) => ({
      value: v.id,
      label: `${v.id.slice(0, 8)} — ${formatStorefrontNaira(v.storefrontPrice)}${v.isDefault ? " (default)" : ""}`,
    }));
  };

  async function handleQuote() {
    const valid = lines
      .filter((l) => l.productId && l.variantId && l.locationId && (l.quantity ?? 0) > 0)
      .map((l) => ({
        productId: l.productId!,
        variantId: l.variantId!,
        locationId: l.locationId!,
        quantity: l.quantity!,
      }));
    if (valid.length === 0) {
      message.warning("Complete at least one line (product, variant, location, quantity).");
      return;
    }
    setQuoting(true);
    try {
      const res = await getOwnerQuote(ownerId, { products: valid });
      if (!res.status || !res.data) {
        message.error(res.message ?? "Quote failed");
        return;
      }
      setQuote(res.data);
    } finally {
      setQuoting(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={ownerName ? `Owner quote — ${ownerName}` : "Owner quote"}
      width={680}
      footer={[
        <Button key="close" onClick={() => onOpenChange(false)}>
          Close
        </Button>,
        <Button key="quote" type="primary" icon={<CalculatorOutlined />} loading={quoting} onClick={handleQuote}>
          Quote
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4">
        {lines.map((line, idx) => (
          <div key={idx} className="grid gap-2 rounded border border-border p-3 sm:grid-cols-12">
            <Select
              className="sm:col-span-4"
              placeholder="Product"
              showSearch
              optionFilterProp="label"
              value={line.productId}
              onChange={(v) =>
                setLines((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, productId: v, variantId: undefined } : l)),
                )
              }
              options={productOptions}
            />
            <Select
              className="sm:col-span-4"
              placeholder="Variant"
              showSearch
              optionFilterProp="label"
              value={line.variantId}
              disabled={!line.productId}
              onChange={(v) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, variantId: v } : l)))
              }
              options={variantOptions(line.productId)}
            />
            <Select
              className="sm:col-span-2"
              placeholder="Location"
              showSearch
              optionFilterProp="label"
              value={line.locationId}
              onChange={(v) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, locationId: v } : l)))
              }
              options={(locationsQuery.data ?? []).map((l) => ({ value: l.id, label: l.name ?? l.id }))}
            />
            <InputNumber
              className="sm:col-span-2"
              placeholder="Qty"
              min={1}
              value={line.quantity}
              onChange={(v) =>
                setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: v ?? undefined } : l)))
              }
            />
            <div className="flex items-center sm:col-span-1">
              {lines.length > 1 && (
                <Button
                  type="link"
                  danger
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button
          type="dashed"
          block
          onClick={() => setLines((prev) => [...prev, {}])}
        >
          Add product line
        </Button>

        {quote && (
          <div className="rounded border border-border bg-muted/40 p-3">
            <Typography.Text strong>Quote result</Typography.Text>
            <Table
              size="small"
              className="mt-2"
              rowKey={(_, i) => String(i)}
              dataSource={quote.lines ?? []}
              pagination={false}
              columns={[
                { title: "Variant", dataIndex: "variantId", render: (v) => <span className="font-mono text-xs">{v?.slice(0, 8)}</span> },
                { title: "Qty", dataIndex: "quantity", align: "right" },
                {
                  title: "Unit",
                  dataIndex: "unitPriceInNaira",
                  align: "right",
                  render: (v: number) => formatStorefrontNaira(v),
                },
                {
                  title: "Line total",
                  dataIndex: "lineTotalInNaira",
                  align: "right",
                  render: (v: number) => (
                    <span className="font-medium">{formatStorefrontNaira(v)}</span>
                  ),
                },
              ]}
            />
            <div className="mt-2 flex justify-end">
              <Typography.Text strong>
                Total: {formatStorefrontNaira(quote.totalInNaira)}
              </Typography.Text>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
