import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  getAdminStorefrontShippingWallet,
  getAdminStorefrontShippingWalletTransaction,
  getAdminStorefrontShippingWalletTransactions,
} from "@/lib/storefrontApi";
import type {
  StorefrontPagedShippingWalletTransactions,
  StorefrontShippingWalletDto,
  StorefrontShippingWalletTransactionDto,
} from "@/lib/storefrontTypes";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { TableColumnsType } from "antd";
import {
  App as AntdApp,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function currencyCode(currency: string | null | undefined): "USD" | "NGN" {
  return currency === "USD" ? "USD" : "NGN";
}

function truncateUuid(id: string, start = 8, end = 4) {
  if (!id) return "";
  if (id.length <= start + end) return id;
  return `${id.slice(0, start)}…${id.slice(-end)}`;
}

export default function StorefrontShippingWalletPage() {
  const { message } = AntdApp.useApp();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const walletQuery = useQuery({
    queryKey: ["storefront-shipping-wallet", "wallet"],
    queryFn: async () => {
      const res = await getAdminStorefrontShippingWallet();
      if (!res.status) throw new Error(res.message ?? "Failed to load shipping wallet");
      return res.data;
    },
  });

  const txQueryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
    }),
    [pageSize, page, debouncedSearch],
  );

  const txQuery = useQuery<StorefrontPagedShippingWalletTransactions>({
    queryKey: ["storefront-shipping-wallet", "transactions", txQueryParams],
    queryFn: async () => {
      const res = await getAdminStorefrontShippingWalletTransactions(txQueryParams);
      if (!res.status)
        throw new Error(res.message ?? "Failed to load shipping wallet transactions");
      return res.data as StorefrontPagedShippingWalletTransactions;
    },
  });

  const detailQuery = useQuery({
    queryKey: ["storefront-shipping-wallet", "tx-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await getAdminStorefrontShippingWalletTransaction(selectedId);
      if (!res.status) throw new Error(res.message ?? "Failed to load transaction");
      return res.data ?? null;
    },
    enabled: !!selectedId,
  });

  useEffect(() => {
    const err = walletQuery.error ?? txQuery.error ?? detailQuery.error;
    if (!err) return;
    message.error(err instanceof Error ? err.message : "Unable to load shipping wallet");
  }, [walletQuery.error, txQuery.error, detailQuery.error, message]);

  const wallet: StorefrontShippingWalletDto | null = walletQuery.data ?? null;
  const currency = wallet?.currency ?? null;
  const code = currencyCode(currency);

  const rows = txQuery.data?.data ?? [];
  const totalItems = Number(txQuery.data?.count ?? 0);

  const columns: TableColumnsType<StorefrontShippingWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 180,
      render: (v) => <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>,
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 120,
      render: (v) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      width: 160,
      align: "right",
      render: (v) => <span className="font-medium tabular-nums">{formatCurrency(v, code)}</span>,
    },
    {
      title: "Balance before",
      dataIndex: "balanceBefore",
      width: 180,
      align: "right",
      render: (v) => <span className="text-muted-foreground tabular-nums">{formatCurrency(v, code)}</span>,
    },
    {
      title: "Balance after",
      dataIndex: "balanceAfter",
      width: 180,
      align: "right",
      render: (v) => <span className="text-muted-foreground tabular-nums">{formatCurrency(v, code)}</span>,
    },
    {
      title: "Reference",
      dataIndex: "paymentReference",
      width: 220,
      render: (_, row) => row.paymentReference ?? row.reference ?? "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      render: (v) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "Order / Owner",
      width: 220,
      render: (_, row) => (
        <div>
          <div className="text-xs text-muted-foreground">
            {row.orderId ? (
              <Tooltip title={row.orderId}>
                <Link
                  className="font-mono text-[#800020] hover:underline"
                  to={`/franchise-orders?ownerId=${encodeURIComponent(
                    row.storefrontOwnerId ?? "",
                  )}&orderId=${encodeURIComponent(row.orderId)}`}
                >
                  Order: {truncateUuid(row.orderId)}
                </Link>
              </Tooltip>
            ) : (
              "Order: —"
            )}
          </div>
          <div className="text-xs">
            {row.storefrontOwnerId ? (
              <Link
                className="font-mono text-[#800020] hover:underline"
                to={`/franchise-store-owners/${row.storefrontOwnerId}`}
              >
                Owner
              </Link>
            ) : (
              "Owner: —"
            )}
          </div>
        </div>
      ),
    },
  ];

  const openDetail = !!selectedId;

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Shipping wallet
        </Typography.Title>
        <Typography.Text type="secondary">
          Read-only admin view of the storefront shipping wallet balance and transaction history.
        </Typography.Text>
      </div>

      <Card loading={walletQuery.isLoading}>
        <Statistic
          title="Current balance"
          value={wallet?.balance ?? 0}
          formatter={() => formatCurrency(wallet?.balance ?? 0, code)}
          valueStyle={{ color: "#800020", fontWeight: 600 }}
        />


      </Card>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search transactions (reference / order id / status)…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </Card>

      <Card styles={{ body: { paddingTop: 8 } }}>
        <Table<StorefrontShippingWalletTransactionDto>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={txQuery.isLoading || txQuery.isFetching}
          scroll={{ x: 1300 }}
          locale={{ emptyText: <Empty description="No shipping wallet transactions" /> }}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          onRow={(row) => ({
            onClick: () => setSelectedId(row.id),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <Modal
        open={openDetail}
        title="Transaction details"
        width={980}
        onCancel={() => setSelectedId(null)}
        footer={null}
        destroyOnClose
      >
        {detailQuery.isLoading ? (
          <Card loading />
        ) : !detailQuery.data ? (
          <Empty description="Transaction not found." />
        ) : (
          <div className="space-y-4">
            <Descriptions
              column={{ xs: 1, sm: 2, md: 3 }}
              size="small"
              bordered
            >
              <Descriptions.Item label="Transaction ID">
                <span className="font-mono break-all">{detailQuery.data.id}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {formatDateTime(detailQuery.data.transactionDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {detailQuery.data.type ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kind">
                {detailQuery.data.transactionKind ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {detailQuery.data.status ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Reference">
                <span className="font-mono break-all">
                  {detailQuery.data.paymentReference ??
                    detailQuery.data.reference ??
                    "—"}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Amount">
                {formatCurrency(detailQuery.data.amount, code)}
              </Descriptions.Item>
              <Descriptions.Item label="Balance before">
                {formatCurrency(detailQuery.data.balanceBefore, code)}
              </Descriptions.Item>
              <Descriptions.Item label="Balance after">
                {formatCurrency(detailQuery.data.balanceAfter, code)}
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {detailQuery.data.description ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Order ID">
                {detailQuery.data.orderId ? (
                  <Tooltip title={detailQuery.data.orderId}>
                    <Link
                      className="font-mono break-all text-[#800020] hover:underline"
                      to={`/franchise-orders?ownerId=${encodeURIComponent(
                        detailQuery.data.storefrontOwnerId ?? "",
                      )}&orderId=${encodeURIComponent(detailQuery.data.orderId)}`}
                    >
                      {truncateUuid(detailQuery.data.orderId)}
                    </Link>
                  </Tooltip>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="External order ID">
                <span className="font-mono break-all">
                  {detailQuery.data.externalOrderId ?? "—"}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Store owner">
                {detailQuery.data.storefrontOwnerId ? (
                  <Link
                    className="font-mono text-[#800020] hover:underline"
                    to={`/franchise-store-owners/${detailQuery.data.storefrontOwnerId}`}
                  >
                    Store owner
                  </Link>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created by">
                <span className="font-mono break-all">
                  {detailQuery.data.createdByUserId ?? "—"}
                </span>
              </Descriptions.Item>
            </Descriptions>

            {detailQuery.data.metadataJson ? (
              <div>
                <Typography.Text strong>Metadata</Typography.Text>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {detailQuery.data.metadataJson}
                </pre>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}

