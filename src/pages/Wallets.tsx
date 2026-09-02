import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  BankOutlined,
  EyeOutlined,
  ReloadOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import type {
  CustomerResponse,
  PaginationResponse,
  ProvisionVaResultItem,
  UserStatus,
} from "@/lib/types";
import { UserStatusValues } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import {
  PROVISION_BATCH_SIZE,
  PROVISION_VA_URL,
  vaBlockers,
} from "@/lib/virtualAccount";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { WalletTransactionsModal } from "@/components/wallets/WalletTransactionsModal";
import { WalletBalancesDownload } from "@/components/wallets/WalletExportButtons";
import {
  ProvisionResultsModal,
  type ProvisionOutcome,
} from "@/components/wallets/ProvisionResultsModal";

const ALL = "__all__";
const BULK_SYNC_KEY = "wallet-bulk-sync";
const PROVISION_KEY = "wallet-bulk-provision";

type BalanceFilter = typeof ALL | "funded" | "empty";
type ReadyFilter = typeof ALL | "ready" | "blocked";
type SortKey = "walletBalance" | "creditBalance";
type SortState = { key: SortKey; order: "ascend" | "descend" } | null;

const statusColor: Record<UserStatus, "success" | "warning" | "error" | "default"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "error",
  Rejected: "error",
  Incomplete: "default",
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card styles={{ body: { padding: 16 } }}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </Card>
  );
}

export default function WalletsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  // Syncing writes a customer's balance, so it is gated behind customer edit
  // rights rather than the read-only transactions permission.
  const canSync = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));
  // Matches the HasPermission attribute on VirtualAccountController.provision.
  const canProvision = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditOrders),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [status, setStatus] = useState<string>(ALL);
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>(ALL);
  const [readyFilter, setReadyFilter] = useState<ReadyFilter>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [sort, setSort] = useState<SortState>({
    key: "walletBalance",
    order: "descend",
  });
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResults, setProvisionResults] = useState<
    ProvisionOutcome[] | null
  >(null);
  const [txnRow, setTxnRow] = useState<CustomerResponse | null>(null);

  // Wallet balances ride along on the customer record; there is no list endpoint
  // for wallets, so page through GetUsers and filter client-side (same approach
  // as the Customers page).
  const serverParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedKeyword.trim())
      params.set("SearchString", debouncedKeyword.trim());
    if (status !== ALL) params.set("status", status);
    return params;
  }, [debouncedKeyword, status]);

  const queryKey = ["wallet-customers", serverParams.toString()];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const FETCH_SIZE = 200;
      const all: CustomerResponse[] = [];
      let pageNumber = 1;
      let total = Infinity;
      while (all.length < total) {
        const params = new URLSearchParams(serverParams);
        params.set("PageSize", String(FETCH_SIZE));
        params.set("PageNumber", String(pageNumber));
        const res = await apiGet<PaginationResponse<CustomerResponse>>(
          `User/GetUsers?${params.toString()}`,
        );
        if (!res.status)
          throw new Error(res.message ?? "Failed to load wallets");
        const chunk = res.data?.data ?? [];
        all.push(...chunk);
        total = Number(res.data?.count ?? all.length);
        if (chunk.length === 0) break;
        pageNumber += 1;
      }
      return all;
    },
  });

  const allRows = useMemo(() => data ?? [], [data]);

  const filteredRows = useMemo(() => {
    let out = allRows;
    if (balanceFilter !== ALL) {
      const wantFunded = balanceFilter === "funded";
      out = out.filter((r) => ((r.walletBalance ?? 0) !== 0) === wantFunded);
    }
    if (readyFilter !== ALL) {
      const wantReady = readyFilter === "ready";
      out = out.filter((r) => (vaBlockers(r).length === 0) === wantReady);
    }
    return out;
  }, [allRows, balanceFilter, readyFilter]);

  // Sorting has to happen before the page slice — antd would otherwise only
  // sort the rows already on screen.
  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const dir = sort.order === "ascend" ? 1 : -1;
    return [...filteredRows].sort(
      (a, b) => ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * dir,
    );
  }, [filteredRows, sort]);

  const rows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const stats = useMemo(() => {
    let totalBalance = 0;
    let funded = 0;
    let blocked = 0;
    for (const r of filteredRows) {
      const balance = r.walletBalance ?? 0;
      totalBalance += balance;
      if (balance !== 0) funded += 1;
      if (vaBlockers(r).length > 0) blocked += 1;
    }
    return {
      totalBalance,
      funded,
      blocked,
      empty: filteredRows.length - funded,
      count: filteredRows.length,
    };
  }, [filteredRows]);

  const selectedCustomers = useMemo(
    () => filteredRows.filter((r) => selectedIds.includes(r.id)),
    [filteredRows, selectedIds],
  );

  // Prefer the freshly fetched row so the modal's balance updates after a sync,
  // falling back to the clicked row if the refetch filtered it out.
  const txnTarget = useMemo(
    () => (txnRow ? (allRows.find((r) => r.id === txnRow.id) ?? txnRow) : null),
    [allRows, txnRow],
  );

  function labelFor(c: CustomerResponse) {
    return c.companyName || c.email || c.id;
  }

  async function refreshBalances() {
    // Both pages read GetUsers, so a sync invalidates the Customers list too.
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
    ]);
  }

  async function syncOne(c: CustomerResponse) {
    setSyncingId(c.id);
    try {
      const res = await apiPost<boolean>(`Wallet/SyncWalletBalance/${c.id}`);
      if (!res.status) {
        message.error(res.message ?? `Sync failed for ${labelFor(c)}`);
        return;
      }
      message.success(res.message ?? `Wallet synced for ${labelFor(c)}`);
      await refreshBalances();
    } finally {
      setSyncingId(null);
    }
  }

  // Sequential rather than parallel: the sync hits the payment provider per
  // user, and firing a few hundred at once reliably trips its rate limit.
  async function syncSelected() {
    const targets = selectedCustomers;
    if (targets.length === 0) return;
    setBulkSyncing(true);
    const failed: string[] = [];
    let done = 0;
    try {
      for (const c of targets) {
        message.open({
          key: BULK_SYNC_KEY,
          type: "loading",
          content: `Syncing wallets… ${done}/${targets.length}`,
          duration: 0,
        });
        const res = await apiPost<boolean>(`Wallet/SyncWalletBalance/${c.id}`);
        if (!res.status) failed.push(labelFor(c));
        done += 1;
      }
      const ok = targets.length - failed.length;
      message.open({
        key: BULK_SYNC_KEY,
        type: failed.length === 0 ? "success" : "warning",
        content:
          failed.length === 0
            ? `Synced ${ok} wallet${ok === 1 ? "" : "s"}.`
            : `Synced ${ok} of ${targets.length}. Failed: ${failed
                .slice(0, 3)
                .join(", ")}${failed.length > 3 ? `, +${failed.length - 3} more` : ""}`,
        duration: 5,
      });
      setSelectedIds([]);
      await refreshBalances();
    } finally {
      setBulkSyncing(false);
    }
  }

  // One request per batch rather than one per customer: the endpoint already
  // loops server-side with its own Paystack rate-limit delay, so batching keeps
  // each request short enough to survive the gateway timeout.
  async function provisionSelected() {
    const targets = selectedCustomers;
    if (targets.length === 0) return;
    setProvisioning(true);
    const outcomes: ProvisionOutcome[] = [];
    try {
      for (let i = 0; i < targets.length; i += PROVISION_BATCH_SIZE) {
        const batch = targets.slice(i, i + PROVISION_BATCH_SIZE);
        message.open({
          key: PROVISION_KEY,
          type: "loading",
          content: `Provisioning virtual accounts… ${i}/${targets.length}`,
          duration: 0,
        });
        // Never send an empty list: that makes the endpoint sweep every user in
        // the system that is missing a virtual account.
        const res = await apiPost<ProvisionVaResultItem[]>(PROVISION_VA_URL, {
          userIds: batch.map((c) => c.id),
        });
        if (!res.status) {
          // The whole batch failed (auth, timeout) — record each one so the
          // report still accounts for every customer that was selected.
          outcomes.push(
            ...batch.map((c) => ({
              userId: c.id,
              email: c.email,
              success: false,
              message: res.message ?? "Provisioning request failed",
              label: labelFor(c),
            })),
          );
          continue;
        }
        // The envelope is 200/true even when provisioning failed — the real
        // outcome is on each per-user item.
        for (const item of res.data ?? []) {
          const row = batch.find((c) => c.id === item.userId);
          outcomes.push({ ...item, label: row ? labelFor(row) : item.userId });
        }
      }

      const ok = outcomes.filter((r) => r.success).length;
      message.open({
        key: PROVISION_KEY,
        type: ok === outcomes.length ? "success" : "warning",
        content: `Provisioned ${ok} of ${outcomes.length} virtual account${
          outcomes.length === 1 ? "" : "s"
        }.`,
        duration: 5,
      });
      setProvisionResults(outcomes);
      setSelectedIds([]);
      await refreshBalances();
    } finally {
      setProvisioning(false);
    }
  }

  function clearFilters() {
    setKeyword("");
    setStatus(ALL);
    setBalanceFilter(ALL);
    setReadyFilter(ALL);
    setPage(1);
  }

  const columns: TableColumnsType<CustomerResponse> = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v: string | null, r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{v || "—"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.email ?? "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phoneNumber",
      width: 140,
      render: (v: string | null) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      width: 150,
      render: (v: string | null) =>
        v ? (
          <span className="text-xs text-muted-foreground">{v}</span>
        ) : (
          <Tag color="warning">Not linked</Tag>
        ),
    },
    {
      title: "Status",
      dataIndex: "userStatus",
      width: 120,
      render: (v: UserStatus) => (
        <Tag color={statusColor[v] ?? "default"}>{v}</Tag>
      ),
    },
    {
      // The user DTO carries no "has virtual account" flag, so this reports
      // whether the record satisfies Paystack's requirements — i.e. whether
      // provisioning can succeed at all, not whether it has already run.
      title: "Paystack details",
      key: "vaReadiness",
      width: 190,
      render: (_, r) => {
        const blockers = vaBlockers(r);
        return blockers.length === 0 ? (
          <Tag color="success">Ready</Tag>
        ) : (
          <Tooltip title={`Missing: ${blockers.join(", ")}`}>
            <Tag color="warning">Missing {blockers.length} field(s)</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Wallet balance (₦)",
      dataIndex: "walletBalance",
      width: 180,
      align: "right",
      sorter: true,
      sortOrder: sort?.key === "walletBalance" ? sort.order : null,
      render: (v: number) => (
        <span
          className={`whitespace-nowrap font-semibold tabular-nums ${
            (v ?? 0) > 0 ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {formatCurrency(v ?? 0, "NGN")}
        </span>
      ),
    },
    {
      title: "Credit balance (₦)",
      dataIndex: "creditBalance",
      width: 170,
      align: "right",
      sorter: true,
      sortOrder: sort?.key === "creditBalance" ? sort.order : null,
      render: (v: number) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {formatCurrency(v ?? 0, "NGN")}
        </span>
      ),
    },
    {
      title: "Last order",
      dataIndex: "lastOrderDate",
      width: 150,
      render: (v: string | null) => (
        <span className="text-xs text-muted-foreground">
          {v ? formatDate(v) : "—"}
        </span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "right",
      fixed: "right",
      render: (_, r) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="View transactions">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setTxnRow(r)}
            />
          </Tooltip>
          {canSync && (
            <Tooltip title="Sync wallet balance">
              <Button
                size="small"
                icon={<SyncOutlined spin={syncingId === r.id} />}
                loading={syncingId === r.id}
                disabled={bulkSyncing}
                onClick={() => syncOne(r)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Wallets
          </Typography.Title>
          <Typography.Text type="secondary">
            Sync customer wallet balances, provision virtual accounts, and
            monitor wallet transactions.
          </Typography.Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isFetching && !isLoading}
          >
            Refresh
          </Button>
          <WalletBalancesDownload />
          {canProvision && (
            <Tooltip title="Creates dedicated Paystack accounts for the selected customers. Safe to re-run — customers that already have one are skipped.">
              <Button
                icon={<BankOutlined />}
                loading={provisioning}
                disabled={selectedCustomers.length === 0 || bulkSyncing}
                onClick={provisionSelected}
              >
                {selectedCustomers.length > 0
                  ? `Provision ${selectedCustomers.length} selected`
                  : "Provision virtual accounts"}
              </Button>
            </Tooltip>
          )}
          {canSync && (
            <Button
              type="primary"
              icon={<SyncOutlined spin={bulkSyncing} />}
              loading={bulkSyncing}
              disabled={selectedCustomers.length === 0 || provisioning}
              onClick={syncSelected}
            >
              {selectedCustomers.length > 0
                ? `Sync ${selectedCustomers.length} selected`
                : "Sync selected"}
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard label="Wallets" value={formatNumber(stats.count)} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            label="Total wallet balance"
            value={formatCurrency(stats.totalBalance, "NGN")}
            hint="Across the current filters"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard label="Funded wallets" value={formatNumber(stats.funded)} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            label="Zero balance"
            value={formatNumber(stats.empty)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            label="Missing Paystack details"
            value={formatNumber(stats.blocked)}
            hint="Cannot be provisioned until the record is fixed"
          />
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <Form layout="vertical">
          <div className="grid gap-3 md:grid-cols-12">
            <Form.Item className="md:col-span-12 !mb-0" label="Search">
              <Input
                placeholder="Search by company, email, phone, Dynamics ID…"
                value={keyword}
                allowClear
                onChange={(e) => {
                  setPage(1);
                  setKeyword(e.target.value);
                }}
              />
            </Form.Item>
            <Form.Item className="md:col-span-4 !mb-0" label="Status">
              <Select
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                options={[
                  { value: ALL, label: "All statuses" },
                  ...UserStatusValues.map((s) => ({ value: s, label: s })),
                ]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-4 !mb-0" label="Wallet balance">
              <Select
                value={balanceFilter}
                onChange={(v: BalanceFilter) => {
                  setPage(1);
                  setBalanceFilter(v);
                }}
                options={[
                  { value: ALL, label: "All wallets" },
                  { value: "funded", label: "Has balance" },
                  { value: "empty", label: "Zero balance" },
                ]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-4 !mb-0" label="Paystack details">
              <Select
                value={readyFilter}
                onChange={(v: ReadyFilter) => {
                  setPage(1);
                  setReadyFilter(v);
                }}
                options={[
                  { value: ALL, label: "All customers" },
                  { value: "ready", label: "Ready to provision" },
                  { value: "blocked", label: "Missing details" },
                ]}
              />
            </Form.Item>
          </div>
          <div className="mt-3">
            <Button size="small" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CustomerResponse>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          rowSelection={
            canSync || canProvision
              ? {
                  selectedRowKeys: selectedIds,
                  onChange: setSelectedIds,
                  preserveSelectedRowKeys: true,
                }
              : undefined
          }
          pagination={{
            current: page,
            pageSize,
            total: filteredRows.length,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: "No wallets match the current filters." }}
          onChange={(_pagination, _filters, sorter) => {
            // Fires for paging too, so only act when the sort really changed —
            // otherwise every page click would bounce back to page 1.
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const key = s?.field as SortKey | undefined;
            const next: SortState =
              s?.order && key
                ? { key, order: s.order as "ascend" | "descend" }
                : null;
            if (next?.key === sort?.key && next?.order === sort?.order) return;
            setSort(next);
            setPage(1);
          }}
          onRow={(record) => ({
            onClick: () => setTxnRow(record),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <ProvisionResultsModal
        results={provisionResults}
        open={!!provisionResults}
        onOpenChange={(v) => !v && setProvisionResults(null)}
      />

      <WalletTransactionsModal
        customer={txnTarget}
        open={!!txnRow}
        onOpenChange={(v) => !v && setTxnRow(null)}
        canSync={canSync}
        syncing={syncingId === txnTarget?.id}
        onSync={syncOne}
      />
    </div>
  );
}
