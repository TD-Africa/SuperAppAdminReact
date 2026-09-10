import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Typography,
  Table,
  Button,
  Space,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";
import { apiGet, API_BASE_URL } from "@/lib/api";
import type {
  OrderReturnDto,
  OrderStatusReturnDTO,
  PaginationResponse,
} from "@/lib/types";
import { PaymentMethodId } from "@/lib/paymentMethods";
import {
  OrderStatusId,
  formatPercent,
  orderStatusColor,
  paymentSummary,
} from "@/lib/orderStatus";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

const ALL = "__all__";

export default function OrdersPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [orderStatusId, setOrderStatusId] = useState<string>(ALL);
  const [isPaid, setIsPaid] = useState<string>(ALL);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(ALL);
  const [isPoa, setIsPoa] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: statuses } = useQuery({
    queryKey: ["order-statuses"],
    queryFn: async () => {
      const res = await apiGet<OrderStatusReturnDTO[]>("Component/GetOrderStatuses");
      if (!res.status) throw new Error(res.message ?? "Failed to load statuses");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  // Resolved from the fetched list rather than used as a literal, so the value
  // handed to the Select is byte-identical to the option the API supplied.
  const partiallyPaidStatusId = useMemo(
    () =>
      (statuses ?? []).find(
        (s) => s.id.toLowerCase() === OrderStatusId.PartiallyPaid,
      )?.id,
    [statuses],
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (orderStatusId !== ALL) params.set("orderStatusId", orderStatusId);
    if (isPaid !== ALL) params.set("isPaid", isPaid);
    if (paymentMethodId !== ALL) params.set("paymentMethodId", paymentMethodId);
    if (isPoa !== ALL) params.set("isPoa", isPoa);
    return params;
  }, [pageSize, page, debouncedKeyword, orderStatusId, isPaid, paymentMethodId, isPoa]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["orders", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<OrderReturnDto>>(
        `Order/GetAllOrders?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load orders");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function openDetail(id: string) {
    setSelectedOrderId(id);
    setDetailOpen(true);
  }

  function downloadAll() {
    window.open(`${API_BASE_URL}Order/DownloadOrders`, "_blank");
  }

  function downloadFiltered() {
    window.open(`${API_BASE_URL}Order/DownloadOrders?${queryParams}`, "_blank");
  }

  function totalFor(order: OrderReturnDto, currency: "NGN" | "USD") {
    const picker =
      currency === "NGN"
        ? (op: OrderReturnDto["orderedProducts"][number]) => op.amountInNaira
        : (op: OrderReturnDto["orderedProducts"][number]) => op.amountInDollar;
    return (order.orderedProducts ?? []).reduce(
      (acc, op) => acc + picker(op) * op.quantity,
      0,
    );
  }

  const columns: TableColumnsType<OrderReturnDto> = [
    { title: "Company", dataIndex: "companyName", render: (v) => <span className="font-medium">{v ?? "—"}</span> },
    { title: "Phone", dataIndex: "phoneNumber", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    {
      title: "NGN",
      key: "ngn",
      align: "right",
      render: (_, r) => formatCurrency(totalFor(r, "NGN"), "NGN"),
    },
    {
      title: "USD",
      key: "usd",
      align: "right",
      render: (_, r) => formatCurrency(totalFor(r, "USD"), "USD"),
    },
    {
      title: "Location",
      key: "location",
      render: (_, r) => (
        <span className="block max-w-[220px] truncate">
          {r.deliveryAddress ?? r.location?.name ?? "—"}
        </span>
      ),
    },
    {
      title: "Date",
      dataIndex: "dateCreated",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    { title: "Method", dataIndex: ["paymentMethod", "method"], render: (v) => v ?? "—" },
    { title: "Delivery", dataIndex: ["deliveryMethod", "method"], render: (v) => v ?? "—" },
    {
      title: "POA",
      dataIndex: "isPoaTransaction",
      render: (v: boolean) => (v ? <Tag color="gold">POA</Tag> : <Tag>—</Tag>),
    },
    {
      // Money, not a word: the Status column already says Unpaid / Partially
      // Paid / Completed, so a tag here would just restate it in a synonym.
      // Plain numerals also read as a different kind of column at a glance,
      // against Status's tag chrome.
      title: "Payment",
      key: "payment",
      render: (_, r) => {
        const { state, received, percent } = paymentSummary(r);
        if (state === "paid")
          return <span className="text-xs text-emerald-600">Paid in full</span>;
        if (state === "unpaid")
          return (
            <span className="text-xs text-muted-foreground">Nothing received</span>
          );
        return (
          <div className="leading-tight">
            <div className="text-xs font-medium text-amber-600">
              {formatCurrency(received, "NGN")}
            </div>
            <div className="text-xs text-muted-foreground">
              {percent === null
                ? "part-paid"
                : `${formatPercent(percent)} received`}
            </div>
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => (
        <Tag color={orderStatusColor(r.orderStatus?.id)}>
          {r.orderStatus?.status ?? "—"}
        </Tag>
      ),
    },
    {
      title: "Qty",
      key: "qty",
      align: "right",
      render: (_, r) => formatNumber(r.orderedProducts?.length ?? 0),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Orders
        </Typography.Title>
        <Typography.Text type="secondary">
          Search, filter, and inspect customer orders.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-12"
            placeholder="Search by company, phone, Dynamics ID…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={orderStatusId}
            onChange={(v) => {
              setPage(1);
              setOrderStatusId(v);
            }}
            options={[
              { value: ALL, label: "All statuses" },
              ...(statuses ?? []).map((s) => ({ value: s.id, label: s.status })),
            ]}
          />
          <Select
            className="md:col-span-3"
            value={isPaid}
            onChange={(v) => {
              setPage(1);
              setIsPaid(v);
            }}
            options={[
              // The API applies isPaid to Order.IsFullyPaid, so "not fully paid"
              // spans both untouched and part-paid orders. Labelled for what it
              // actually does; isolate partial payments via the status filter.
              { value: ALL, label: "All payment states" },
              { value: "true", label: "Fully paid" },
              { value: "false", label: "Not fully paid" },
            ]}
          />
          <Select
            className="md:col-span-3"
            value={paymentMethodId}
            onChange={(v) => {
              setPage(1);
              setPaymentMethodId(v);
            }}
            options={[
              { value: ALL, label: "All methods" },
              { value: PaymentMethodId.Credit, label: "Credit" },
              { value: PaymentMethodId.CashOrCard, label: "Cash/Card" },
            ]}
          />
          <Select
            className="md:col-span-3"
            value={isPoa}
            onChange={(v) => {
              setPage(1);
              setIsPoa(v);
            }}
            options={[
              { value: ALL, label: "All transactions" },
              { value: "true", label: "POA only" },
              { value: "false", label: "Non-POA" },
            ]}
          />
        </div>

        {partiallyPaidStatusId && orderStatusId !== partiallyPaidStatusId && (
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <span>Chasing balances?</span>
            <Button
              size="small"
              type="link"
              className="!h-auto !px-0 !text-xs"
              onClick={() => {
                setPage(1);
                setOrderStatusId(partiallyPaidStatusId);
              }}
            >
              Show partially paid orders
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : null}
        </span>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={downloadFiltered}>
            Download (filtered)
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadAll}>
            Download all
          </Button>
        </Space>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<OrderReturnDto>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: "No orders match the current filters." }}
        />
      </Card>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedOrderId(null);
        }}
        onUpdated={() => refetch()}
      />
    </div>
  );
}
