import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Card,
  Empty,
  Input,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  getSettlementWallet,
  getSettlementWalletBalance,
  getSettlementWalletLedger,
  getSettlementWalletOrders,
  getSettlementWalletStats,
  getSettlementWalletTransactions,
  getSuperAdminWallet,
  getSuperAdminWalletTransactions,
} from "@/lib/storefrontApi";
import type {
  StorefrontWalletLedgerDto,
  StorefrontWalletOrderDto,
  StorefrontWalletTransactionDto,
  SuperAdminWalletTransactionDto,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";

function typeTag(v: string | null | undefined) {
  if (!v) return <Tag>—</Tag>;
  const lower = v.toLowerCase();
  if (lower === "debit") return <Tag color="error">Debit</Tag>;
  if (lower === "credit") return <Tag color="success">Credit</Tag>;
  return <Tag>{v}</Tag>;
}

export default function FranchiseSuperAdminWalletPage() {
  const { message } = AntdApp.useApp();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const walletQuery = useQuery({
    queryKey: ["superadmin-wallet"],
    queryFn: async () => {
      const res = await getSuperAdminWallet();
      if (!res.status) throw new Error(res.message ?? "Failed to load wallet");
      return res.data;
    },
  });

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
    }),
    [pageSize, page, debouncedSearch],
  );

  const txQuery = useQuery({
    queryKey: ["superadmin-wallet-tx", queryParams],
    queryFn: async () => {
      const res = await getSuperAdminWalletTransactions(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load transactions");
      return res.data;
    },
  });

  const settlementWalletQuery = useQuery({
    queryKey: ["settlement-wallet"],
    queryFn: async () => {
      const res = await getSettlementWallet();
      if (res.status && res.data) return res.data;
      const fallback = await getSettlementWalletBalance();
      if (!fallback.status) {
        throw new Error(res.message ?? fallback.message ?? "Failed to load settlement wallet");
      }
      return fallback.data;
    },
  });

  const settlementStatsQuery = useQuery({
    queryKey: ["settlement-wallet-stats"],
    queryFn: async () => {
      const res = await getSettlementWalletStats();
      if (!res.status) throw new Error(res.message ?? "Failed to load settlement stats");
      return res.data;
    },
  });

  const settlementTxQuery = useQuery({
    queryKey: ["settlement-wallet-tx", queryParams],
    queryFn: async () => {
      const res = await getSettlementWalletTransactions(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load settlement transactions");
      return res.data;
    },
  });

  const settlementLedgerQuery = useQuery({
    queryKey: ["settlement-wallet-ledger", queryParams],
    queryFn: async () => {
      const res = await getSettlementWalletLedger(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load settlement ledger");
      return res.data;
    },
  });

  const settlementOrdersQuery = useQuery({
    queryKey: ["settlement-wallet-orders", queryParams],
    queryFn: async () => {
      const res = await getSettlementWalletOrders(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load settlement orders");
      return res.data;
    },
  });

  useEffect(() => {
    const err = walletQuery.error ?? txQuery.error;
    if (err) {
      message.error(err instanceof Error ? err.message : "Unable to load super admin wallet.");
    }
  }, [walletQuery.error, txQuery.error, message]);

  const currency = walletQuery.data?.currency ?? "NGN";
  const currencyCode = currency === "USD" ? "USD" : "NGN";
  const pendingOemCommission =
    settlementStatsQuery.data?.storefrontOemCommissionPending ??
    settlementStatsQuery.data?.pendingCommission ??
    0;

  const columns: TableColumnsType<SuperAdminWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 100,
      render: (v) => typeTag(v),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => (
        <span className={v < 0 ? "text-red-600" : "font-medium"}>
          {formatCurrency(v, currencyCode)}
        </span>
      ),
    },
    {
      title: "Balance after",
      dataIndex: "balanceAfter",
      align: "right",
      render: (v) => formatCurrency(v, currencyCode),
    },
    { title: "Reference", dataIndex: "reference", ellipsis: true, render: (v) => v ?? "—" },
    { title: "Description", dataIndex: "description", ellipsis: true, render: (v) => v ?? "—" },
    {
      title: "Owner",
      dataIndex: "storefrontOwnerId",
      ellipsis: true,
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, row) =>
        row.isDeleted ? <Tag>Deleted</Tag> : <Tag color="success">Active</Tag>,
    },
  ];

  const settlementColumns: TableColumnsType<StorefrontWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    { title: "Type", dataIndex: "type", width: 100, render: (v) => typeTag(v) },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => formatCurrency(v, currencyCode),
    },
    {
      title: "After",
      dataIndex: "balanceAfter",
      align: "right",
      render: (v) => formatCurrency(v, currencyCode),
    },
    { title: "Reference", dataIndex: "reference", ellipsis: true, render: (v) => v ?? "—" },
    { title: "Description", dataIndex: "description", ellipsis: true, render: (v) => v ?? "—" },
  ];

  const ledgerColumns: TableColumnsType<StorefrontWalletLedgerDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    { title: "Type", dataIndex: "type", width: 100, render: (v) => typeTag(v) },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => formatCurrency(v, currencyCode),
    },
    {
      title: "After",
      dataIndex: "balanceAfter",
      align: "right",
      render: (v) => formatCurrency(v, currencyCode),
    },
    { title: "Reference", dataIndex: "reference", ellipsis: true, render: (v) => v ?? "—" },
    { title: "Description", dataIndex: "description", ellipsis: true, render: (v) => v ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Settlement wallet
        </Typography.Title>
        <Typography.Text type="secondary">
          Read-only platform treasury balance and transaction history.
        </Typography.Text>
      </div>

      <Card loading={walletQuery.isLoading}>
        <Statistic
          title="Current balance"
          value={walletQuery.data?.balance ?? 0}
          formatter={() => formatCurrency(walletQuery.data?.balance ?? 0, currencyCode)}
          valueStyle={{ color: "#800020", fontWeight: 600 }}
        />
        <Typography.Text type="secondary" className="text-xs">
          {walletQuery.data?.updatedAt
            ? `Updated ${formatDate(walletQuery.data.updatedAt)}`
            : walletQuery.data?.walletKey ?? "—"}
        </Typography.Text>
      </Card>

      {(settlementWalletQuery.data || settlementStatsQuery.data) && (
        <Card title="Settlement snapshot" loading={settlementStatsQuery.isLoading}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Statistic
              title="Settlement balance"
              value={
                settlementWalletQuery.data?.balance ??
                settlementStatsQuery.data?.walletBalance ??
                0
              }
              formatter={() =>
                formatCurrency(
                  settlementWalletQuery.data?.balance ??
                    settlementStatsQuery.data?.walletBalance ??
                    0,
                  currencyCode,
                )
              }
            />
            <Statistic title="Total orders" value={settlementStatsQuery.data?.totalOrders ?? 0} />
            <Statistic
              title="Revenue"
              value={settlementStatsQuery.data?.revenue ?? 0}
              formatter={() =>
                formatCurrency(settlementStatsQuery.data?.revenue ?? 0, currencyCode)
              }
            />
            <Statistic
              title="Pending commission"
              value={pendingOemCommission}
              formatter={() => formatCurrency(pendingOemCommission, currencyCode)}
            />
          </div>
        </Card>
      )}

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search transactions…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </Card>

      <Card styles={{ body: { paddingTop: 8 } }}>
        <Tabs
          items={[
            {
              key: "superadmin",
              label: "Super admin ledger",
              children: (
                <Table<SuperAdminWalletTransactionDto>
                  rowKey="id"
                  columns={columns}
                  dataSource={txQuery.data?.data ?? []}
                  loading={txQuery.isLoading || txQuery.isFetching}
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: <Empty description="No transactions" /> }}
                  pagination={{
                    current: page,
                    pageSize,
                    total: Number(txQuery.data?.count ?? 0),
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                />
              ),
            },
            // {
            //   key: "settlement-tx",
            //   label: "Settlement transactions",
            //   children: (
            //     <Table<StorefrontWalletTransactionDto>
            //       rowKey="id"
            //       columns={settlementColumns}
            //       dataSource={settlementTxQuery.data?.data ?? []}
            //       loading={settlementTxQuery.isLoading}
            //       scroll={{ x: 1100 }}
            //       locale={{ emptyText: <Empty description="No settlement transactions" /> }}
            //       pagination={{
            //         current: page,
            //         pageSize,
            //         total: Number(settlementTxQuery.data?.count ?? 0),
            //         showSizeChanger: true,
            //         onChange: (p, ps) => {
            //           setPage(p);
            //           setPageSize(ps);
            //         },
            //       }}
            //     />
            //   ),
            // },
            // {
            //   key: "settlement-ledger",
            //   label: "Settlement ledger",
            //   children: (
            //     <Table<StorefrontWalletLedgerDto>
            //       rowKey="id"
            //       columns={ledgerColumns}
            //       dataSource={settlementLedgerQuery.data?.data ?? []}
            //       loading={settlementLedgerQuery.isLoading}
            //       scroll={{ x: 1100 }}
            //       locale={{ emptyText: <Empty description="No ledger entries" /> }}
            //       pagination={{
            //         current: page,
            //         pageSize,
            //         total: Number(settlementLedgerQuery.data?.count ?? 0),
            //         showSizeChanger: true,
            //         onChange: (p, ps) => {
            //           setPage(p);
            //           setPageSize(ps);
            //         },
            //       }}
            //     />
            //   ),
            // },
            // {
            //   key: "settlement-orders",
            //   label: "Settlement orders",
            //   children: (
            //     <Table<StorefrontWalletOrderDto>
            //       rowKey="orderId"
            //       columns={[
            //         {
            //           title: "Date",
            //           dataIndex: "dateCreated",
            //           render: (v: string) => formatDate(v),
            //         },
            //         { title: "Reference", dataIndex: "orderReference", render: (v) => v ?? "—" },
            //         {
            //           title: "Amount",
            //           dataIndex: "amount",
            //           align: "right" as const,
            //           render: (v: number) => formatCurrency(v, currencyCode),
            //         },
            //         // {
            //         //   title: "Owner commission",
            //         //   dataIndex: "storefrontOwnerCommissionAmount",
            //         //   align: "right" as const,
            //         //   render: (_, row) =>
            //         //     formatCurrency(
            //         //       row.storefrontOwnerCommissionAmount ??
            //         //         row.commission ??
            //         //         0,
            //         //       currencyCode,
            //         //     ),
            //         // },
            //         {
            //           title: "OEM commission",
            //           dataIndex: "storefrontOemCommissionAmount",
            //           align: "right" as const,
            //           render: (_, row) =>
            //             formatCurrency(
            //               row.storefrontOemCommissionAmount ?? 0,
            //               currencyCode,
            //             ),
            //         },
            //       ]}
            //       dataSource={settlementOrdersQuery.data?.data ?? []}
            //       loading={settlementOrdersQuery.isLoading}
            //       locale={{ emptyText: <Empty description="No settlement orders" /> }}
            //       pagination={{
            //         current: page,
            //         pageSize,
            //         total: Number(settlementOrdersQuery.data?.count ?? 0),
            //         showSizeChanger: true,
            //         onChange: (p, ps) => {
            //           setPage(p);
            //           setPageSize(ps);
            //         },
            //       }}
            //     />
            //   ),
            // },
          ]}
        />
      </Card>
    </div>
  );
}
