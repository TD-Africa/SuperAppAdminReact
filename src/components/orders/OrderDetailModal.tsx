import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Button,
  Skeleton,
  Tag,
  Descriptions,
  Divider,
  Typography,
  App as AntdApp,
  Checkbox,
  InputNumber,
  Table,
} from "antd";
import type { TableColumnsType } from "antd";
import { apiGet, apiPatch } from "@/lib/api";
import type { OrderProductReturnDto, OrderReturnDto } from "@/lib/types";
import { PaymentMethodId } from "@/lib/paymentMethods";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

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
            <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small" colon={false}>
              <Descriptions.Item label="Order ID" span={4}>
                <Typography.Text copyable className="text-xs font-mono">
                  {data.id}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Company">
                {data.companyName ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Recipient">{data.name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Phone">{data.phoneNumber ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Warehouse">
                {data.location?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Total (NGN)">
                {formatCurrency(totalNaira, "NGN")}
              </Descriptions.Item>
              <Descriptions.Item label="Total (USD)">
                {formatCurrency(totalDollar, "USD")}
              </Descriptions.Item>
              <Descriptions.Item label="Payment">
                {data.paymentMethod?.method ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Delivery">
                {data.deliveryMethod?.method ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Date ordered">
                {formatDate(data.dateCreated)}
              </Descriptions.Item>
              <Descriptions.Item label="Due date">
                {data.dueDate ? formatDate(data.dueDate) : "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Delivery address" span={2}>
                {data.deliveryAddress ?? data.location?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag>{data.orderStatus?.status ?? "—"}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider className="!my-2" />

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
              {data.isPoaTransaction && <Tag color="gold">POA transaction</Tag>}
            </div>

            {showInvoiceTable && (
              <div>
                <Typography.Text strong>Credit invoices</Typography.Text>
                <Table<InvoiceRow>
                  rowKey="salesId"
                  dataSource={invoiceRows}
                  columns={invoiceColumns}
                  pagination={false}
                  size="small"
                  className="mt-2"
                />
              </div>
            )}

            <div>
              <Typography.Text strong>
                Products ({data.orderedProducts?.length ?? 0})
              </Typography.Text>
              <Table<OrderProductReturnDto>
                rowKey={(r) => `${r.product.id}-${r.salesID ?? ""}`}
                dataSource={data.orderedProducts ?? []}
                columns={productColumns}
                pagination={false}
                size="small"
                className="mt-2"
                scroll={{ x: 1000 }}
                onRow={(record) => ({
                  onClick: () => openProduct(record.product.id),
                  style: { cursor: "pointer" },
                })}
              />
            </div>
          </div>
        )}
      </Modal>

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
