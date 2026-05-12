import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Table,
  Button,
  Tag,
  Row,
  Col,
  Statistic,
  InputNumber,
  Alert,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ExclamationCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type {
  AlmostDueOrderResponse,
  DebtCollectionSummaryResponse,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DebtCollectionDetailModal } from "@/components/debt/DebtCollectionDetailModal";

export default function DebtCollectionPage() {
  const { message } = AntdApp.useApp();
  const [daysUntilDue, setDaysUntilDue] = useState<number>(7);
  const [appliedDays, setAppliedDays] = useState<number>(7);
  const [selected, setSelected] = useState<AlmostDueOrderResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("daysUntilDue", String(appliedDays));
    return params;
  }, [appliedDays]);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["debt-collection-summary", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<DebtCollectionSummaryResponse>(
        `DebtCollection/GetAlmostDueOrdersSummary/admin/almost-due/summary?${queryParams.toString()}`,
      );
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load debt collection data");
      }
      return res.data;
    },
  });

  function applyFilter() {
    if (!daysUntilDue || daysUntilDue < 1) {
      message.error("Days until due must be at least 1");
      return;
    }
    setAppliedDays(daysUntilDue);
  }

  const orders = data?.orders ?? [];

  const columns: TableColumnsType<AlmostDueOrderResponse> = [
    {
      title: "Order ref",
      dataIndex: "orderReference",
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v) => v ?? "—",
    },
    {
      title: "User email",
      dataIndex: "userEmail",
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Total (₦)",
      dataIndex: "totalAmount",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    {
      title: "Paid (₦)",
      dataIndex: "amountPaid",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    {
      title: "Outstanding (₦)",
      dataIndex: "amountDue",
      align: "right",
      render: (v: number) => (
        <span className="font-semibold text-destructive">
          {formatCurrency(v, "NGN")}
        </span>
      ),
    },
    {
      title: "Due date",
      dataIndex: "dueDate",
      render: (v) => (
        <span className="text-xs text-muted-foreground">
          {v ? formatDate(v) : "—"}
        </span>
      ),
    },
    {
      title: "Days until due",
      dataIndex: "daysUntilDue",
      align: "right",
      render: (v: number) => (
        <Tag color={v < 0 ? "error" : v <= 3 ? "warning" : "default"}>
          {v < 0 ? `${Math.abs(v)} overdue` : v}
        </Tag>
      ),
    },
    {
      title: "Is due",
      dataIndex: "isDue",
      render: (v: boolean) =>
        v ? <Tag color="error">Yes</Tag> : <Tag color="success">No</Tag>,
    },
    {
      title: "Status",
      dataIndex: "orderStatus",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Payment",
      dataIndex: "paymentMethod",
      render: (v: string) => v,
    },
    {
      title: "Order date",
      dataIndex: "orderDate",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{formatDate(v)}</span>
      ),
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
          onClick={() => setSelected(r)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Debt Collection
        </Typography.Title>
        <Typography.Text type="secondary">
          Track and act on almost-due and overdue credit orders.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-muted-foreground">
              Days until due
            </label>
            <InputNumber
              min={1}
              max={365}
              step={1}
              value={daysUntilDue}
              onChange={(v) => setDaysUntilDue(Number(v ?? 7))}
              style={{ width: 160 }}
            />
          </div>
          <Button type="primary" onClick={applyFilter}>
            Load data
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load"
          description={(error as Error).message}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Total orders"
              value={data?.totalOrders ?? 0}
              valueStyle={{ color: "#800020" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Total amount due"
              value={data ? formatCurrency(data.totalAmountDue, "NGN") : "—"}
              valueStyle={{ color: "#800020" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card>
            <Statistic
              title="Due this week"
              value={data?.ordersDueThisWeek ?? 0}
              valueStyle={{ color: "#d97706" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card>
            <Statistic
              title="Due next week"
              value={data?.ordersDueNextWeek ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <Card>
            <Statistic
              title="Overdue"
              value={data?.overdueOrders ?? 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{
                color: (data?.overdueOrders ?? 0) > 0 ? "#dc2626" : undefined,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<AlmostDueOrderResponse>
          rowKey="orderId"
          dataSource={orders}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          scroll={{ x: 1400 }}
          locale={{
            emptyText:
              "No orders match the current filter — adjust the days-until-due window.",
          }}
        />
      </Card>

      <DebtCollectionDetailModal
        order={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onActionComplete={() => refetch()}
      />
    </div>
  );
}
