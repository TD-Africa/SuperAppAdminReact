import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  getAdminStorefrontOemWallet,
  creditAdminStorefrontOemWallet,
  debitAdminStorefrontOemWallet,
  getAdminStorefrontOemWalletTransactions,
  updateAdminStorefrontOemWalletTransaction,
  deleteAdminStorefrontOemWalletTransaction,
} from "@/lib/storefrontApi";
import type {
  OemWalletDto,
  OemWalletAdjustmentRequest,
  OemWalletTransactionDto,
  OemWalletTransactionDeleteRequest,
  OemWalletTransactionUpdateRequest,
} from "@/lib/storefrontTypes";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TableColumnsType } from "antd";
import {
  App as AntdApp,
  Button,
  Card,
  Form,
  Empty,
  Input,
  InputNumber,
  Modal,
  Statistic,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";

function typeTag(v: string | null | undefined) {
  if (!v) return <Tag>—</Tag>;
  const lower = v.toLowerCase();
  if (lower === "debit") return <Tag color="error">Debit</Tag>;
  if (lower === "credit") return <Tag color="success">Credit</Tag>;
  return <Tag>{v}</Tag>;
}

export default function FranchiseOemWalletTransactionsPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [adjustMode, setAdjustMode] = useState<"credit" | "debit" | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm] = Form.useForm<OemWalletAdjustmentRequest>();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<OemWalletTransactionDto | null>(null);
  const [editForm] = Form.useForm<OemWalletTransactionUpdateRequest>();
  const [deleteForm] = Form.useForm<OemWalletTransactionDeleteRequest>();

  const walletQuery = useQuery({
    queryKey: ["oem-wallet"],
    queryFn: async () => {
      const res = await getAdminStorefrontOemWallet();
      if (!res.status) throw new Error(res.message ?? "Failed to load Global store front wallet");
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
    queryKey: ["oem-wallet-tx", queryParams],
    queryFn: async () => {
      const res = await getAdminStorefrontOemWalletTransactions(queryParams);
      if (!res.status)
        throw new Error(res.message ?? "Failed to load Global store front wallet transactions");
      return res.data;
    },
  });

  const err = walletQuery.error ?? txQuery.error;
  useEffect(() => {
    if (!err) return;
    message.error(err instanceof Error ? err.message : "Unable to load Global store front wallet.");
  }, [err, message]);

  const wallet: OemWalletDto | null = walletQuery.data ?? null;
  const currency = wallet?.currency ?? "NGN";
  const currencyCode = currency === "USD" ? "USD" : "NGN";

  const columns: TableColumnsType<OemWalletTransactionDto> = [
    {
      title: "Date",
      dataIndex: "transactionDate",
      width: 140,
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
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
      render: (v: number) => (
        <span className={v < 0 ? "text-red-600" : "font-medium"}>
          {formatCurrency(v, currencyCode)}
        </span>
      ),
    },
    {
      title: "Balance after",
      dataIndex: "balanceAfter",
      align: "right",
      render: (v: number) => formatCurrency(v, currencyCode),
    },
    {
      title: "Reference",
      key: "reference",
      render: (_, row) => row.paymentReference ?? row.reference ?? "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "Owner",
      dataIndex: "storefrontOwnerId",
      ellipsis: true,
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setSelectedTx(row);
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="small"
            danger
            onClick={() => {
              setSelectedTx(row);
              setDeleteOpen(true);
            }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    if (!selectedTx) return;
    if (!editOpen) return;
    editForm.setFieldsValue({
      amount: selectedTx.amount,
      type: selectedTx.type ?? "",
      reference: selectedTx.reference ?? "",
      description: selectedTx.description ?? "",
      metadataJson: selectedTx.metadataJson ?? null,
    });
  }, [selectedTx, editOpen, editForm]);

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Global store front wallet transactions
        </Typography.Title>
        <Typography.Text type="secondary">
          Global store front commission wallet balance and transaction history.
        </Typography.Text>
      </div>

      <Card loading={walletQuery.isLoading}>
        <Statistic
          title="Current balance"
          value={wallet?.balance ?? 0}
          formatter={() => formatCurrency(wallet?.balance ?? 0, currencyCode)}
          valueStyle={{ color: "#800020", fontWeight: 600 }}
        />
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            Commission received
          </div>
          <div className="text-right font-medium">
            {formatCurrency(wallet?.storefrontOemCommissionReceived ?? 0, currencyCode)}
          </div>
        </div>
        <Typography.Text type="secondary" className="mt-2 block text-xs">
          {wallet?.updatedAt ? `Updated ${formatDate(wallet.updatedAt)}` : wallet?.walletKey ?? "—"}
        </Typography.Text>
      </Card>

      <Card
        loading={txQuery.isLoading}
        title={
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span>Transactions</span>
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    setAdjustMode("credit");
                    setAdjustOpen(true);
                    adjustForm.resetFields();
                  }}
                >
                  Credit
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setAdjustMode("debit");
                    setAdjustOpen(true);
                    adjustForm.resetFields();
                  }}
                  danger
                >
                  Debit
                </Button>
              </Space>
            </div>
            <Input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search reference / type / status"
              className="w-64"
            />
          </div>
        }
      >
        <Table<OemWalletTransactionDto>
          rowKey="id"
          columns={columns}
          dataSource={txQuery.data?.data ?? []}
          loading={txQuery.isFetching}
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
      </Card>

      <Modal
        open={adjustOpen}
        title={adjustMode === "credit" ? "Credit Global store front wallet" : "Debit Global store front wallet"}
        onCancel={() => setAdjustOpen(false)}
        okText={adjustMode === "credit" ? "Credit" : "Debit"}
        onOk={async () => {
          const values = await adjustForm.validateFields();
          const res =
            adjustMode === "credit"
              ? await creditAdminStorefrontOemWallet(values)
              : await debitAdminStorefrontOemWallet(values);
          if (!res.status) {
            message.error(res.message ?? "Unable to adjust Global store front wallet");
            return;
          }
          setAdjustOpen(false);
          queryClient.invalidateQueries({ queryKey: ["oem-wallet"] });
          queryClient.invalidateQueries({ queryKey: ["oem-wallet-tx"] });
        }}
      >
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="amount" label="Amount (optional)">
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="reference"
            label="Reference"
            rules={[{ required: true, message: "Reference is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Description is required" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={editOpen}
        title="Edit Global store front wallet transaction"
        onCancel={() => setEditOpen(false)}
        okText="Save"
        onOk={async () => {
          if (!selectedTx) return;
          const values = await editForm.validateFields();
          const res = await updateAdminStorefrontOemWalletTransaction(selectedTx.id, values);
          if (!res.status) {
            message.error(res.message ?? "Unable to update transaction");
            return;
          }
          setEditOpen(false);
          setSelectedTx(null);
          queryClient.invalidateQueries({ queryKey: ["oem-wallet"] });
          queryClient.invalidateQueries({ queryKey: ["oem-wallet-tx"] });
        }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="amount" label="Amount (optional)">
            <InputNumber min={0} step={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: "Type is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="reference"
            label="Reference"
            rules={[{ required: true, message: "Reference is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Description is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="metadataJson" label="metadataJson (optional)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete Global store front wallet transaction"
        okText="Delete"
        okButtonProps={{ danger: true }}
        onCancel={() => setDeleteOpen(false)}
        onOk={async () => {
          if (!selectedTx) return;
          const values = await deleteForm.validateFields();
          const res = await deleteAdminStorefrontOemWalletTransaction(selectedTx.id, values);
          if (!res.status) {
            message.error(res.message ?? "Unable to delete transaction");
            return;
          }
          setDeleteOpen(false);
          setSelectedTx(null);
          queryClient.invalidateQueries({ queryKey: ["oem-wallet"] });
          queryClient.invalidateQueries({ queryKey: ["oem-wallet-tx"] });
        }}
      >
        <Form form={deleteForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: "Reason is required" }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

