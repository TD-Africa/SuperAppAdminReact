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
  Input,
  Space,
  DatePicker,
  Alert,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import {
  EyeOutlined,
  ReloadOutlined,
  SyncOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost, API_ORIGIN } from "@/lib/api";
import type { WorkerSalesOverview, WorkerSalesStats } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { WorkerDetailModal } from "@/components/employees/WorkerDetailModal";

const { RangePicker } = DatePicker;

export default function EmployeesPage() {
  const { message } = AntdApp.useApp();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [applied, setApplied] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    const s = params.toString();
    return s ? `?${s}` : "";
  }, [applied]);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["worker-overview", queryString],
    queryFn: async () => {
      const res = await apiGet<WorkerSalesOverview>(
        `${API_ORIGIN}/api/Worker/overview${queryString}`,
      );
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load employee sales data");
      }
      return res.data;
    },
  });

  function applyFilter() {
    const [start, end] = range ?? [null, null];
    if (start && end && start.isAfter(end)) {
      message.error("Start date cannot be after end date");
      return;
    }
    setApplied({
      from: start ? start.toISOString() : null,
      to: end ? end.toISOString() : null,
    });
  }

  function resetFilter() {
    setRange(null);
    setApplied({ from: null, to: null });
  }

  async function runSync() {
    setSyncing(true);
    try {
      const res = await apiPost<number>(`${API_ORIGIN}/api/Worker/sync`);
      if (res.status) {
        message.success(
          `Sync complete — ${formatNumber(res.data ?? 0)} worker record(s) updated.`,
        );
        refetch();
      } else {
        message.error(res.message ?? "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  const workers = data?.workers ?? [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        (w.fullName ?? "").toLowerCase().includes(q) ||
        (w.personnelNumber ?? "").toLowerCase().includes(q) ||
        (w.referralId ?? "").toLowerCase().includes(q),
    );
  }, [workers, debouncedSearch]);

  const columns: TableColumnsType<WorkerSalesStats> = [
    {
      title: "Employee",
      dataIndex: "fullName",
      render: (v) => <span className="font-medium">{v ?? "—"}</span>,
      sorter: (a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""),
    },
    {
      title: "Personnel #",
      dataIndex: "personnelNumber",
      render: (v) => v ?? "—",
    },
    {
      title: "Referral ID",
      dataIndex: "referralId",
      render: (v) => <span className="font-mono text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      filters: [
        { text: "Active", value: true },
        { text: "Inactive", value: false },
      ],
      onFilter: (val, r) => r.isActive === val,
      render: (v: boolean) =>
        v ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: "Converted orders",
      dataIndex: "orderCount",
      align: "right",
      defaultSortOrder: "descend",
      sorter: (a, b) => a.orderCount - b.orderCount,
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Sales (₦)",
      dataIndex: "totalAmount",
      align: "right",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v: number) => (
        <span className="font-semibold">{formatCurrency(v, "NGN")}</span>
      ),
    },
    {
      title: "Last converted",
      dataIndex: "lastConvertedUtc",
      render: (v) => (
        <span className="text-xs text-muted-foreground">
          {v ? formatDate(v) : "—"}
        </span>
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
          disabled={!r.referralId}
          onClick={() => setSelectedReferralId(r.referralId)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Employees
          </Typography.Title>
          <Typography.Text type="secondary">
            Sales personnel and the converted orders attributed to their referral codes.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<SyncOutlined spin={syncing} />}
          loading={syncing}
          onClick={runSync}
        >
          Sync from Dynamics
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap className="w-full" size={12}>
          <RangePicker
            showTime
            value={range}
            onChange={(v) => setRange(v ? [v[0] ?? null, v[1] ?? null] : null)}
          />
          <Button type="primary" onClick={applyFilter}>
            Apply
          </Button>
          <Button onClick={resetFilter}>Reset</Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        </Space>
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
              title="Total employees"
              value={data?.totalWorkers ?? 0}
              valueStyle={{ color: "#800020" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="Active" value={data?.activeWorkers ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="With sales"
              value={data?.workersWithSales ?? 0}
              valueStyle={{ color: "#16a34a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Converted orders"
              value={data?.totalConvertedOrders ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Converted sales"
              value={data ? formatCurrency(data.totalConvertedAmount, "NGN") : "—"}
              valueStyle={{ color: "#800020" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Unattributed orders"
              value={data?.unattributedOrders ?? 0}
              valueStyle={{ color: "#d97706" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Unattributed sales"
              value={data ? formatCurrency(data.unattributedAmount, "NGN") : "—"}
              valueStyle={{ color: "#d97706" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Generated"
              value={data?.generatedUtc ? formatDate(data.generatedUtc) : "—"}
            />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          prefix={<SearchOutlined className="text-muted-foreground" />}
          placeholder="Search by name, personnel number, or referral ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420 }}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<WorkerSalesStats>
          rowKey={(r) => r.referralId ?? r.personnelNumber ?? r.fullName ?? ""}
          dataSource={filtered}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            showTotal: (total) => `${formatNumber(total)} employees`,
          }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: "No employees found." }}
        />
      </Card>

      <WorkerDetailModal
        referralId={selectedReferralId}
        open={!!selectedReferralId}
        onOpenChange={(v) => !v && setSelectedReferralId(null)}
      />
    </div>
  );
}
