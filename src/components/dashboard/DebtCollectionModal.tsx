import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Table,
  Tag,
  Empty,
  Statistic,
  Row,
  Col,
  Card,
  Button,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { OrderReturnDto, PaginationResponse } from "@/lib/types";
import { PaymentMethodId } from "@/lib/paymentMethods";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function totalNairaForOrder(o: OrderReturnDto): number {
  return (o.orderedProducts ?? []).reduce(
    (acc, p) => acc + p.amountInNaira * p.quantity,
    0,
  );
}

function daysOverdue(o: OrderReturnDto): number | null {
  if (!o.dueDate) return null;
  const due = new Date(o.dueDate).getTime();
  const now = Date.now();
  const diff = Math.floor((now - due) / 86400000);
  return diff > 0 ? diff : null;
}

export function DebtCollectionModal({ open, onOpenChange }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    params.set("isPaid", "false");
    params.set("paymentMethodId", PaymentMethodId.Credit);
    return params;
  }, [page, pageSize]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["debt-collection", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<OrderReturnDto>>(
        `Order/GetAllOrders?${queryParams.toString()}`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load unpaid orders");
      return res.data;
    },
    enabled: open,
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  // Sum across the current page only — true total would require a backend
  // aggregate endpoint; this gives admins a useful "what's owed in view" figure.
  const pageOutstanding = useMemo(
    () =>
      rows.reduce((acc, o) => {
        const total = totalNairaForOrder(o);
        const paid = o.amountPaid ?? 0;
        return acc + Math.max(0, total - paid);
      }, 0),
    [rows],
  );

  const overdueCount = useMemo(
    () => rows.filter((o) => daysOverdue(o) !== null).length,
    [rows],
  );

  const columns: TableColumnsType<OrderReturnDto> = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v, r) => (
        <div>
          <div className="font-medium">{v ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {r.phoneNumber ?? "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Ordered",
      dataIndex: "dateCreated",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{formatDate(v)}</span>
      ),
    },
    {
      title: "Due",
      dataIndex: "dueDate",
      render: (v, r) => {
        const overdue = daysOverdue(r);
        if (!v) return <span className="text-muted-foreground">—</span>;
        return (
          <div>
            <div className="text-xs">{formatDate(v)}</div>
            {overdue !== null && (
              <Tag color="error" className="!mt-0.5">
                {overdue} day{overdue === 1 ? "" : "s"} overdue
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Total (NGN)",
      key: "total",
      align: "right",
      render: (_, r) => formatCurrency(totalNairaForOrder(r), "NGN"),
    },
    {
      title: "Paid",
      dataIndex: "amountPaid",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    {
      title: "Outstanding",
      key: "outstanding",
      align: "right",
      render: (_, r) => {
        const due = Math.max(0, totalNairaForOrder(r) - (r.amountPaid ?? 0));
        return (
          <span className="font-semibold text-destructive">
            {formatCurrency(due, "NGN")}
          </span>
        );
      },
    },
    {
      title: "Status",
      dataIndex: ["orderStatus", "status"],
      render: (v: string) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setSelectedOrderId(r.id)}
        />
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title="Debt Collection — Outstanding Credit Orders"
        width={1200}
        footer={null}
        destroyOnClose
      >
        <Row gutter={[16, 16]} className="!mb-4">
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Unpaid credit orders"
                value={totalItems}
                valueStyle={{ color: "#800020" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Overdue (current page)"
                value={overdueCount}
                valueStyle={{ color: overdueCount > 0 ? "#dc2626" : undefined }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Outstanding (current page)"
                value={formatCurrency(pageOutstanding, "NGN")}
                valueStyle={{ color: "#800020" }}
              />
            </Card>
          </Col>
        </Row>

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
          size="middle"
          scroll={{ x: 1000 }}
          locale={{
            emptyText: (
              <Empty description="No outstanding credit orders right now." />
            ),
          }}
        />
      </Modal>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(v) => !v && setSelectedOrderId(null)}
        onUpdated={() => refetch()}
      />
    </>
  );
}
