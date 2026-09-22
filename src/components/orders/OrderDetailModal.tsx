import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Modal,
  Button,
  Skeleton,
  Tag,
  Descriptions,
  Typography,
  App as AntdApp,
  Checkbox,
  InputNumber,
  Table,
  Tooltip,
  Card,
  Flex,
  Space,
  Statistic,
  Tabs,
} from "antd";
import type { DescriptionsProps, TableColumnsType } from "antd";
import { CloudUploadOutlined, FilePdfOutlined } from "@ant-design/icons";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { downloadOrderInvoice } from "@/lib/orderExports";
import type { OrderProductReturnDto, OrderReturnDto } from "@/lib/types";
import { PaymentMethodId } from "@/lib/paymentMethods";
import {
  chargedTotal,
  formatPercent,
  hasInvoice,
  hasSettlementDiscrepancy,
  orderStatusColor,
  paymentSummary,
} from "@/lib/orderStatus";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

interface InvoiceRow {
  salesId: string;
  invoiceId: string;
  invoiceCreationDate: string | null;
  amountDueInNaira: number;
  amountPaid: number;
  isFullySettled: boolean;
  isFullyPosted: boolean;
}

export function OrderDetailModal({ orderId, open, onOpenChange, onUpdated }: Props) {
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditOrders));
  const [isPDCCollected, setIsPDCCollected] = useState(false);
  const [isFullyPaid, setIsFullyPaid] = useState(false);
  const [invoiceEdits, setInvoiceEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productOpen, setProductOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await apiGet<OrderReturnDto>(`Order/GetOrder/${orderId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load order");
      return res.data;
    },
    enabled: !!orderId && open,
  });

  useEffect(() => {
    if (data) {
      setIsPDCCollected(data.isPDCCollected);
      setIsFullyPaid(data.isFullyPaid);
      setInvoiceEdits({});
    }
  }, [data]);

  const isCredit = data?.paymentMethod?.id === PaymentMethodId.Credit;
  const showInvoiceTable = !!data && isCredit && !data.isFullyPaid && data.isInvoiced;

  const invoiceRows = useMemo<InvoiceRow[]>(() => {
    if (!data?.orderedProducts) return [];
    const seen = new Map<string, InvoiceRow>();
    for (const op of data.orderedProducts) {
      if (!op.salesID || seen.has(op.salesID)) continue;
      seen.set(op.salesID, {
        salesId: op.salesID,
        invoiceId: op.invoiceID ?? "—",
        invoiceCreationDate: op.invoiceCreationDate,
        amountDueInNaira: op.amountInNaira * op.quantity,
        amountPaid: op.amountPaid,
        isFullySettled: op.isFullySettled,
        isFullyPosted: op.isFullyPosted,
      });
    }
    return Array.from(seen.values());
  }, [data]);

  const totalNaira = useMemo(
    () =>
      data?.orderedProducts?.reduce(
        (acc, op) => acc + op.amountInNaira * op.quantity,
        0,
      ) ?? 0,
    [data],
  );
  const totalDollar = useMemo(
    () =>
      data?.orderedProducts?.reduce(
        (acc, op) => acc + op.amountInDollar * op.quantity,
        0,
      ) ?? 0,
    [data],
  );

  // A sales ID on any line is what "posted to Dynamics" means server-side — it
  // is the same check RetrySalesOrder uses as its idempotency guard, so an order
  // that has one would be a no-op retry (the API still answers 200/true).
  const salesIds = useMemo(() => {
    const ids = new Set<string>();
    for (const op of data?.orderedProducts ?? []) {
      const id = op.salesID?.trim();
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [data]);
  const postedToDynamics = salesIds.length > 0;

  const summary = data ? paymentSummary(data) : null;
  // Dollar lines are the exception, so the USD row only earns its space when the
  // order actually has one.
  const hasDollarLines = !!data && chargedTotal(data, "USD") !== 0;
  const discrepancy = !!data && hasSettlementDiscrepancy(data);

  const paymentItems: DescriptionsProps["items"] = useMemo(() => {
    if (!data) return [];
    const money = (v: number, currency: "NGN" | "USD") => formatCurrency(v, currency);

    // A fully-paid order owes nothing by definition. Where the journal split says
    // otherwise it is misread, not a real balance, so show the truth and let the
    // alert below explain the disagreement.
    const settledFor = (raw: number, currency: "NGN" | "USD") =>
      money(discrepancy ? chargedTotal(data, currency) : raw, currency);
    const dueFor = (raw: number, currency: "NGN" | "USD") => {
      const value = discrepancy ? 0 : raw;
      return (
        <span className={value > 0 ? "font-medium text-amber-600" : undefined}>
          {money(value, currency)}
        </span>
      );
    };

    const items: DescriptionsProps["items"] = [
      { key: "received", label: "Received", children: money(data.amountPaid, "NGN") },
      {
        key: "invoiced-ngn",
        label: "Invoiced (NGN)",
        children: money(chargedTotal(data, "NGN"), "NGN"),
      },
      {
        key: "settled-ngn",
        label: "Settled (NGN)",
        children: settledFor(data.amountSettledInNaira, "NGN"),
      },
      {
        key: "due-ngn",
        label: "Outstanding (NGN)",
        children: dueFor(data.amountDueInNaira, "NGN"),
      },
    ];
    if (hasDollarLines) {
      items.push(
        {
          key: "invoiced-usd",
          label: "Invoiced (USD)",
          children: money(chargedTotal(data, "USD"), "USD"),
        },
        {
          key: "settled-usd",
          label: "Settled (USD)",
          children: settledFor(data.amountSettledInDollar, "USD"),
        },
        {
          key: "due-usd",
          label: "Outstanding (USD)",
          children: dueFor(data.amountDueInDollar, "USD"),
        },
      );
    }
    return items;
  }, [data, hasDollarLines, discrepancy]);

  const customerItems: DescriptionsProps["items"] = useMemo(() => {
    if (!data) return [];
    return [
      { key: "company", label: "Company", children: data.companyName ?? "—" },
      { key: "recipient", label: "Recipient", children: data.name ?? "—" },
      { key: "phone", label: "Phone", children: data.phoneNumber ?? "—" },
      { key: "warehouse", label: "Warehouse", children: data.location?.name ?? "—" },
      { key: "payment", label: "Payment method", children: data.paymentMethod?.method ?? "—" },
      { key: "delivery", label: "Delivery method", children: data.deliveryMethod?.method ?? "—" },
      { key: "ordered", label: "Date ordered", children: formatDate(data.dateCreated) },
      { key: "due", label: "Due date", children: data.dueDate ? formatDate(data.dueDate) : "N/A" },
      {
        key: "address",
        label: "Delivery address",
        children: data.deliveryAddress ?? data.location?.name ?? "—",
        span: 3,
      },
    ];
  }, [data]);

  function openProduct(id: string) {
    setSelectedProductId(id);
    setProductOpen(true);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const payload = {
      isPDCCollected,
      isFullyPaid,
      invoicePayments: Object.entries(invoiceEdits)
        .filter(([, v]) => !Number.isNaN(v))
        .map(([salesId, amountPaid]) => ({ salesId, amountPaid })),
    };
    const res = await apiPatch<boolean>(`order/updateOrder/${data.id}`, payload);
    setSaving(false);
    if (res.status) {
      message.success(res.message ?? "Order updated");
      onUpdated?.();
      refetch();
    } else {
      message.error(res.message ?? "Update failed");
    }
  }

  // Re-runs the whole Dynamics posting for this order: sales order, payment
  // journal, then auto-settle. Only offered while the order is unposted, since
  // the endpoint short-circuits once any line has a sales ID.
  async function handleRetry() {
    if (!data) return;
    setRetrying(true);
    try {
      const res = await apiPost<boolean>(`Order/RetrySalesOrder/${data.id}`);
      if (!res.status) {
        message.error(res.message ?? "Posting to Dynamics failed");
        return;
      }
      message.success(res.message ?? "Order posted to Dynamics");
      onUpdated?.();
      // The sales/voucher IDs only appear on a fresh read.
      await refetch();
    } finally {
      setRetrying(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!data) return;
    setDownloadingInvoice(true);
    try {
      const err = await downloadOrderInvoice(data.id);
      if (err) message.error(err);
    } finally {
      setDownloadingInvoice(false);
    }
  }

  const invoiceAvailable = !!data && hasInvoice(data);

  const hasDirtyEdits =
    !!data &&
    (isPDCCollected !== data.isPDCCollected ||
      isFullyPaid !== data.isFullyPaid ||
      Object.keys(invoiceEdits).length > 0);

  const invoiceColumns: TableColumnsType<InvoiceRow> = [
    { title: "Invoice ID", dataIndex: "invoiceId", render: (v) => <span className="font-medium">{v}</span> },
    { title: "Created", dataIndex: "invoiceCreationDate", render: (v) => formatDate(v) },
    {
      title: "Due (NGN)",
      dataIndex: "amountDueInNaira",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    {
      title: "Amount paid",
      key: "amountPaid",
      width: 220,
      render: (_, row) => {
        const locked = row.isFullyPosted && row.isFullySettled;
        const current = invoiceEdits[row.salesId] ?? row.amountPaid;
        return (
          <InputNumber
            disabled={!canEdit || locked}
            value={current}
            min={0}
            step={1000}
            onChange={(v) =>
              setInvoiceEdits((prev) => ({ ...prev, [row.salesId]: Number(v) }))
            }
            style={{ width: "100%" }}
          />
        );
      },
    },
  ];

  const productColumns: TableColumnsType<OrderProductReturnDto> = [
    {
      title: "Product",
      dataIndex: ["product", "productName"],
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Dynamics ID",
      dataIndex: ["product", "dynamicsId"],
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    { title: "Warehouse", dataIndex: ["warehouse", "name"], render: (v) => v ?? "—" },
    { title: "Qty", dataIndex: "quantity", align: "right", render: (v) => formatNumber(v) },
    { title: "Sales ID", dataIndex: "salesID", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    { title: "Voucher ID", dataIndex: "voucherID", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    {
      title: "USD",
      dataIndex: "amountInDollar",
      align: "right",
      render: (v: number) => formatCurrency(v, "USD"),
    },
    {
      title: "NGN",
      dataIndex: "amountInNaira",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    {
      title: "Paid (NGN)",
      dataIndex: "amountPaid",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title="Order details"
        width={1100}
        footer={[
          // antd suppresses pointer events on a disabled button, so the tooltip
          // that explains why it is disabled needs the wrapper to hover over.
          !!data && (
            <Tooltip
              key="invoice"
              title={
                invoiceAvailable
                  ? "Customer invoice PDF"
                  : "No invoice yet — Dynamics has not invoiced this order."
              }
            >
              <span className="inline-block">
                <Button
                  icon={<FilePdfOutlined />}
                  loading={downloadingInvoice}
                  disabled={!invoiceAvailable}
                  onClick={handleDownloadInvoice}
                >
                  Download invoice
                </Button>
              </span>
            </Tooltip>
          ),
          canEdit && !!data && !postedToDynamics && (
            <Button
              key="retry"
              icon={<CloudUploadOutlined />}
              loading={retrying}
              onClick={() => setRetryOpen(true)}
            >
              Post to Dynamics
            </Button>
          ),
          <Button key="close" onClick={() => onOpenChange(false)}>
            Close
          </Button>,
          canEdit && isCredit && (
            <Button
              key="save"
              type="primary"
              loading={saving}
              disabled={!hasDirtyEdits}
              onClick={handleSave}
            >
              Update order
            </Button>
          ),
        ]}
        destroyOnClose
      >
        {isLoading || !data ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <div className="space-y-5">
            {/* Summary header */}
            <Card size="small" className="bg-muted/40">
              <Flex justify="space-between" align="center" gap={16} wrap>
                <Space direction="vertical" size={6}>
                  <Space size={6} wrap>
                    <Tag
                      color={orderStatusColor(data.orderStatus?.id)}
                      className="!m-0 !py-0.5 !text-sm"
                    >
                      {data.orderStatus?.status ?? "—"}
                    </Tag>
                    {summary && (
                      <Tag
                        color={
                          summary.state === "paid"
                            ? "success"
                            : summary.state === "partial"
                              ? "orange"
                              : "error"
                        }
                        className="!m-0 !py-0.5"
                      >
                        {summary.state === "paid"
                          ? "Paid in full"
                          : summary.state === "partial"
                            ? "Partially paid"
                            : "Unpaid"}
                      </Tag>
                    )}
                    {data.isPoaTransaction && (
                      <Tag color="gold" className="!m-0 !py-0.5">
                        POA transaction
                      </Tag>
                    )}
                    {postedToDynamics ? (
                      <Tag color="success" className="!m-0 !py-0.5">
                        Dynamics · posted
                      </Tag>
                    ) : (
                      <Tag color="warning" className="!m-0 !py-0.5">
                        Dynamics · not posted
                      </Tag>
                    )}
                  </Space>
                  <Typography.Text type="secondary" className="text-xs">
                    Order ID{" "}
                    <Typography.Text copyable className="font-mono text-xs">
                      {data.id}
                    </Typography.Text>
                  </Typography.Text>
                </Space>

                <Space size={24} wrap>
                  <Statistic
                    title="Total (NGN)"
                    value={totalNaira}
                    formatter={(v) => formatCurrency(Number(v), "NGN")}
                  />
                  <Statistic
                    title="Total (USD)"
                    value={totalDollar}
                    formatter={(v) => formatCurrency(Number(v), "USD")}
                  />
                </Space>
              </Flex>
            </Card>

            <Tabs
              defaultActiveKey="overview"
              items={[
                {
                  key: "overview",
                  label: "Overview",
                  children: (
                    <div className="space-y-6 pt-1">
                      <section>
                        <Typography.Title level={5} className="!mb-3 !mt-0">
                          Customer & delivery
                        </Typography.Title>
                        <Descriptions
                          column={{ xs: 1, sm: 2, md: 3 }}
                          size="small"
                          colon={false}
                          items={customerItems}
                        />
                      </section>

                      <section>
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Typography.Title level={5} className="!mb-0 !mt-0">
                            Payment
                          </Typography.Title>
                          {summary &&
                            (summary.state === "paid" ? (
                              <span className="text-xs text-emerald-600">
                                Paid in full
                              </span>
                            ) : summary.state === "unpaid" ? (
                              <span className="text-xs text-muted-foreground">
                                Nothing received
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600">
                                {formatCurrency(summary.received, "NGN")} of{" "}
                                {formatCurrency(summary.charged, "NGN")}
                                {summary.percent !== null &&
                                  ` · ${formatPercent(summary.percent)} received`}
                              </span>
                            ))}
                        </div>
                        <Descriptions
                          column={{ xs: 1, sm: 2, md: 4 }}
                          size="small"
                          bordered
                          items={paymentItems}
                        />
                        <Typography.Paragraph
                          type="secondary"
                          className="!mb-0 !mt-2 text-xs"
                        >
                          "Received" is the total banked against the order;
                          invoiced/settled figures come from the Dynamics payment
                          journal, so the two move independently until an invoice
                          is settled.
                        </Typography.Paragraph>

                        {discrepancy && (
                          <Alert
                            className="mt-3"
                            type="info"
                            showIcon
                            message="Journal split misreports this order"
                            description={
                              <span className="text-xs">
                                The order is fully paid, but the Dynamics journal
                                reports {formatCurrency(data.amountDueInNaira, "NGN")}{" "}
                                still due. Its lines carry per-line payments rather
                                than the group total the settlement reader expects,
                                so the other lines' payments get counted as debt.
                                Shown as settled above — no balance to chase.
                              </span>
                            }
                          />
                        )}
                      </section>

                      <section>
                        <Typography.Title level={5} className="!mb-3 !mt-0">
                          Flags
                        </Typography.Title>
                        <div className="flex flex-wrap items-center gap-6">
                          <Checkbox
                            checked={isPDCCollected}
                            disabled={!canEdit}
                            onChange={(e) => setIsPDCCollected(e.target.checked)}
                          >
                            Post-dated check collected
                          </Checkbox>
                          <Checkbox
                            checked={isFullyPaid}
                            disabled={!canEdit}
                            onChange={(e) => setIsFullyPaid(e.target.checked)}
                          >
                            Fully paid
                          </Checkbox>
                        </div>
                      </section>
                    </div>
                  ),
                },
                {
                  key: "products",
                  label: `Products (${data.orderedProducts?.length ?? 0})`,
                  children: (
                    <Table<OrderProductReturnDto>
                      rowKey={(r) => `${r.product.id}-${r.salesID ?? ""}`}
                      dataSource={data.orderedProducts ?? []}
                      columns={productColumns}
                      pagination={false}
                      size="small"
                      className="mt-3"
                      scroll={{ x: 1000 }}
                      onRow={(record) => ({
                        onClick: () => openProduct(record.product.id),
                        style: { cursor: "pointer" },
                      })}
                    />
                  ),
                },
                ...(showInvoiceTable
                  ? [
                      {
                        key: "invoices",
                        label: `Credit invoices (${invoiceRows.length})`,
                        children: (
                          <Table<InvoiceRow>
                            rowKey="salesId"
                            dataSource={invoiceRows}
                            columns={invoiceColumns}
                            pagination={false}
                            size="small"
                            className="mt-3"
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={retryOpen}
        onOpenChange={setRetryOpen}
        title="Post this order to Dynamics?"
        description="Creates the sales order, posts the payment journal, and attempts auto-settlement in D365. Records created there cannot be undone from this console."
        confirmLabel="Post to Dynamics"
        onConfirm={handleRetry}
      />

      <ProductDetailModal
        productId={selectedProductId}
        open={productOpen}
        onOpenChange={(v) => {
          setProductOpen(v);
          if (!v) setSelectedProductId(null);
        }}
      />
    </>
  );
}
