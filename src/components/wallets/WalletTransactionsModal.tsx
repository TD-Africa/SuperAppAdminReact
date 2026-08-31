import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ReloadOutlined, SyncOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type {
  CustomerResponse,
  PaginationResponse,
  WalletTransactionResponse,
} from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { directionOf, StatusTag, TypeTag } from "./WalletTransactionTags";

interface WalletTransactionsModalProps {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs SyncWalletBalance for this customer; resolves once the sync settles. */
  onSync?: (customer: CustomerResponse) => Promise<void>;
  syncing?: boolean;
  canSync?: boolean;
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

export function WalletTransactionsModal({
  customer,
  open,
  onOpenChange,
  onSync,
  syncing = false,
  canSync = false,
}: WalletTransactionsModalProps) {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset paging/search whenever the modal is pointed at a different customer.
  useEffect(() => {
    setKeyword("");
    setPage(1);
  }, [customer?.id]);

  const userId = customer?.id ?? null;

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["wallet-transactions", userId, debouncedKeyword, page, pageSize],
    enabled: open && !!userId,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("userId", userId!);
      params.set("PageSize", String(pageSize));
      params.set("PageNumber", String(page));
      if (debouncedKeyword.trim())
        params.set("SearchString", debouncedKeyword.trim());
      // NOTE: this endpoint is only deployed on the production admin API — it
      // 404s against the test host. A 404 here usually means VITE_API_BASE_URL
      // points at test, not that the customer has no ledger.
      const res = await apiGet<PaginationResponse<WalletTransactionResponse>>(
        `Wallet/GetUserWalletTransactions?${params.toString()}`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load wallet transactions");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = Number(data?.count ?? 0);

  // Credited/debited totals cover the current page only — the endpoint returns
  // no aggregate, and paging through every transaction to sum them would be
  // far more expensive than the number is worth.
  const pageTotals = useMemo(() => {
    let credited = 0;
    let debited = 0;
    for (const t of rows) {
      const amount = Math.abs(t.amount ?? 0);
      if (directionOf(t) === "credit") credited += amount;
      else if (directionOf(t) === "debit") debited += amount;
    }
    return { credited, debited };
  }, [rows]);

  const columns: TableColumnsType<WalletTransactionResponse> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 190,
      render: (v: string) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(v)}
        </span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 130,
      render: (_, r) => <TypeTag txn={r} />,
    },
    {
      title: "Description",
      dataIndex: "description",
      render: (v: string | null) => (
        <span className="text-sm">{v?.trim() || "—"}</span>
      ),
    },
    {
      title: "Reference",
      dataIndex: "reference",
      width: 200,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span className="block max-w-[180px] truncate font-mono text-xs text-muted-foreground">
              {v}
            </span>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: string | null) => <StatusTag status={v} />,
    },
    {
      title: "Amount (₦)",
      dataIndex: "amount",
      width: 150,
      align: "right",
      render: (v: number, r) => {
        const dir = directionOf(r);
        const cls =
          dir === "credit"
            ? "text-green-600"
            : dir === "debit"
              ? "text-red-600"
              : "";
        const sign = dir === "credit" ? "+" : dir === "debit" ? "−" : "";
        return (
          <span className={`whitespace-nowrap font-medium tabular-nums ${cls}`}>
            {sign}
            {formatCurrency(Math.abs(v ?? 0), "NGN")}
          </span>
        );
      },
    },
    {
      title: "Balance after (₦)",
      dataIndex: "balanceAfter",
      width: 160,
      align: "right",
      render: (v: number) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatCurrency(v ?? 0, "NGN")}
        </span>
      ),
    },
  ];

  const displayName = customer?.companyName || customer?.email || "Customer";

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      width={1100}
      destroyOnClose
      title={
        <div className="pr-8">
          <div className="text-base font-semibold leading-tight">
            Wallet — {displayName}
          </div>
          <div className="text-xs font-normal text-muted-foreground">
            {customer?.email ?? "—"}
            {customer?.dynamicsId ? ` · Dynamics ${customer.dynamicsId}` : ""}
          </div>
        </div>
      }
      footer={[
        <Button key="close" onClick={() => onOpenChange(false)}>
          Close
        </Button>,
      ]}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="Wallet balance"
            value={formatCurrency(customer?.walletBalance ?? 0, "NGN")}
          />
          <Tile label="Transactions" value={total || rows.length} />
          <Tile
            label="Credited (page)"
            value={
              <span className="text-green-600">
                {formatCurrency(pageTotals.credited, "NGN")}
              </span>
            }
          />
          <Tile
            label="Debited (page)"
            value={
              <span className="text-red-600">
                {formatCurrency(pageTotals.debited, "NGN")}
              </span>
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Input.Search
            className="w-full sm:max-w-sm"
            placeholder="Search reference, description…"
            allowClear
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Space>
            {customer?.isSuspended && <Tag color="error">Suspended</Tag>}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isFetching && !isLoading}
            >
              Refresh
            </Button>
            {canSync && onSync && customer && (
              <Button
                type="primary"
                icon={<SyncOutlined spin={syncing} />}
                loading={syncing}
                onClick={async () => {
                  await onSync(customer);
                  refetch();
                }}
              >
                Sync balance
              </Button>
            )}
          </Space>
        </div>

        {isError && (
          <Alert
            type="error"
            showIcon
            message="Could not load wallet transactions"
            description={(error as Error).message}
            action={
              <Button size="small" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        )}

        <Table<WalletTransactionResponse>
          size="small"
          rowKey={(r, i) =>
            r.reference || `${r.transactionDate}-${r.amount}-${i}`
          }
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `${t} transaction${t === 1 ? "" : "s"}`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: isError
              ? "Transactions unavailable."
              : "No wallet transactions found.",
          }}
        />

        <Typography.Text type="secondary" className="text-xs">
          Balances shown come from the customer record. Run a sync to pull the
          latest balance from the payment provider.
        </Typography.Text>
      </div>
    </Modal>
  );
}
