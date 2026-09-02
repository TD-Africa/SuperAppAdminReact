import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Form,
  InputNumber,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  creditSuperAdminWallet,
  debitSuperAdminWallet,
  deleteSuperAdminWalletTransaction,
  getSettlementWallet,
  getSettlementWalletLedger,
  getSettlementWalletOrders,
  getSettlementWalletStats,
  getSettlementWalletTransactions,
  getSuperAdminWallet,
  getSuperAdminWalletTransactions,
  updateSuperAdminWalletTransaction,
} from "@/lib/storefrontApi";
import type {
  StorefrontWalletLedgerDto,
  StorefrontWalletOrderDto,
  StorefrontWalletTransactionDto,
  SuperAdminWalletTransactionDto,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";
import { WalletAdjustmentModal } from "@/components/storefront/WalletAdjustmentModal";

export default function FranchiseSuperAdminWalletPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const [editTarget, setEditTarget] = useState<SuperAdminWalletTransactionDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminWalletTransactionDto | null>(null);
  const [editForm] = Form.useForm();
  const [deleteReason, setDeleteReason] = useState("");

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
      if (!res.status) throw new Error(res.message ?? "Failed to load settlement wallet");
      return res.data;
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

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["superadmin-wallet"] });
    await queryClient.invalidateQueries({ queryKey: ["superadmin-wallet-tx"] });
  }

  async function handleAdjust(
    mode: "credit" | "debit",
    values: { amount: number; reference: string; description: string },
  ) {
    setAdjusting(true);
    try {
      const fn = mode === "credit" ? creditSuperAdminWallet : debitSuperAdminWallet;
      const res = await fn(values);
      if (!res.status) {
        message.error(res.message ?? "Adjustment failed");
        return false;
      }
      await invalidate();
      return true;
    } finally {
      setAdjusting(false);
    }
  }

  const columns: TableColumnsType<SuperAdminWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    { title: "Type", dataIndex: "type", width: 100, render: (v) => v ?? "—" },
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
      title: "",
      key: "actions",
      width: 90,
      align: "right",
      render: (_, row) =>
        row.isDeleted ? (
          <Tag>Deleted</Tag>
        ) : (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditTarget(row);
                editForm.setFieldsValue({
                  amount: row.amount,
                  type: row.type,
                  reference: row.reference,
                  description: row.description,
                  metadataJson: row.metadataJson,
                });
              }}
            />
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteTarget(row)}
            />
          </Space>
        ),
    },
  ];

  const settlementColumns: TableColumnsType<StorefrontWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    { title: "Type", dataIndex: "type", width: 100, render: (v) => v ?? "—" },
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
    { title: "Type", dataIndex: "type", width: 100, render: (v) => v ?? "—" },
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Super admin wallet
          </Typography.Title>
          <Typography.Text type="secondary">
            Platform settlement treasury — credits, debits, and transaction history.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setCreditOpen(true)}>
            Credit
          </Button>
          <Button danger icon={<MinusOutlined />} onClick={() => setDebitOpen(true)}>
            Debit
          </Button>
        </Space>
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
            {
              key: "settlement-tx",
              label: "Settlement transactions",
              children: (
                <Table<StorefrontWalletTransactionDto>
                  rowKey="id"
                  columns={settlementColumns}
                  dataSource={settlementTxQuery.data?.data ?? []}
                  loading={settlementTxQuery.isLoading}
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: <Empty description="No settlement transactions" /> }}
                  pagination={{
                    current: page,
                    pageSize,
                    total: Number(settlementTxQuery.data?.count ?? 0),
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                />
              ),
            },
            {
              key: "settlement-ledger",
              label: "Settlement ledger",
              children: (
                <Table<StorefrontWalletLedgerDto>
                  rowKey="id"
                  columns={ledgerColumns}
                  dataSource={settlementLedgerQuery.data?.data ?? []}
                  loading={settlementLedgerQuery.isLoading}
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: <Empty description="No ledger entries" /> }}
                  pagination={{
                    current: page,
                    pageSize,
                    total: Number(settlementLedgerQuery.data?.count ?? 0),
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                />
              ),
            },
            {
              key: "settlement-orders",
              label: "Settlement orders",
              children: (
                <Table<StorefrontWalletOrderDto>
                  rowKey="orderId"
                  columns={[
                    {
                      title: "Date",
                      dataIndex: "dateCreated",
                      render: (v: string) => formatDate(v),
                    },
                    { title: "Reference", dataIndex: "orderReference", render: (v) => v ?? "—" },
                    {
                      title: "Amount",
                      dataIndex: "amount",
                      align: "right" as const,
                      render: (v: number) => formatCurrency(v, currencyCode),
                    },
                    {
                      title: "Commission",
                      dataIndex: "commission",
                      align: "right" as const,
                      render: (v: number) => formatCurrency(v, currencyCode),
                    },
                  ]}
                  dataSource={settlementOrdersQuery.data?.data ?? []}
                  loading={settlementOrdersQuery.isLoading}
                  locale={{ emptyText: <Empty description="No settlement orders" /> }}
                  pagination={{
                    current: page,
                    pageSize,
                    total: Number(settlementOrdersQuery.data?.count ?? 0),
                    showSizeChanger: true,
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {(settlementWalletQuery.data || settlementStatsQuery.data) && (
        <Card title="Settlement wallet snapshot" loading={settlementStatsQuery.isLoading}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Statistic
              title="Settlement balance"
              value={settlementWalletQuery.data?.balance ?? settlementStatsQuery.data?.walletBalance ?? 0}
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
            <Statistic title="Revenue" value={settlementStatsQuery.data?.revenue ?? 0} formatter={() => formatCurrency(settlementStatsQuery.data?.revenue ?? 0, currencyCode)} />
            <Statistic title="Pending commission" value={settlementStatsQuery.data?.pendingCommission ?? 0} formatter={() => formatCurrency(settlementStatsQuery.data?.pendingCommission ?? 0, currencyCode)} />
          </div>
        </Card>
      )}

      <WalletAdjustmentModal
        open={creditOpen}
        mode="credit"
        loading={adjusting}
        onOpenChange={setCreditOpen}
        onSubmit={(v) => handleAdjust("credit", v)}
      />
      <WalletAdjustmentModal
        open={debitOpen}
        mode="debit"
        loading={adjusting}
        onOpenChange={setDebitOpen}
        onSubmit={(v) => handleAdjust("debit", v)}
      />

      <Modal
        open={!!editTarget}
        title="Edit transaction"
        onCancel={() => setEditTarget(null)}
        onOk={async () => {
          if (!editTarget) return;
          try {
            const values = await editForm.validateFields();
            const res = await updateSuperAdminWalletTransaction(editTarget.id, values);
            if (!res.status) {
              message.error(res.message ?? "Update failed");
              return;
            }
            message.success("Transaction updated");
            setEditTarget(null);
            await invalidate();
          } catch {
            // validation
          }
        }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber className="!w-full" min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="reference" label="Reference" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="metadataJson" label="Metadata JSON">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Delete transaction"
        okText="Delete"
        okButtonProps={{ danger: true }}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteReason("");
        }}
        onOk={async () => {
          if (!deleteTarget || deleteReason.trim().length < 3) {
            message.error("Please provide a reason (min 3 characters)");
            return;
          }
          const res = await deleteSuperAdminWalletTransaction(deleteTarget.id, {
            reason: deleteReason.trim(),
          });
          if (!res.status) {
            message.error(res.message ?? "Delete failed");
            return;
          }
          message.success("Transaction deleted");
          setDeleteTarget(null);
          setDeleteReason("");
          await invalidate();
        }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Reason for deletion"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </div>
  );
}
