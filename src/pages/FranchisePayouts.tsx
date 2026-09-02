import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  getAdminPayouts,
  queueApprovedAdminPayouts,
} from "@/lib/storefrontApi";
import type {
  StorefrontPayoutDto,
  StorefrontPayoutStatus,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PayoutDetailModal } from "@/components/storefront/PayoutDetailModal";

const ALL = "__all__";

const STATUS_OPTIONS: { value: StorefrontPayoutStatus; label: string }[] = [
  { value: "Requested", label: "Requested" },
  { value: "Approved", label: "Approved" },
  { value: "Processing", label: "Processing" },
  { value: "Paid", label: "Paid" },
  { value: "Rejected", label: "Rejected" },
  { value: "Failed", label: "Failed" },
  { value: "Cancelled", label: "Cancelled" },
];

function statusTag(status: StorefrontPayoutStatus) {
  const colors: Record<StorefrontPayoutStatus, string> = {
    Requested: "processing",
    Approved: "blue",
    Processing: "processing",
    Paid: "success",
    Rejected: "error",
    Failed: "error",
    Cancelled: "default",
  };
  return <Tag color={colors[status]}>{status}</Tag>;
}

export default function FranchisePayoutsPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [queueing, setQueueing] = useState(false);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      status: status !== ALL ? (status as StorefrontPayoutStatus) : undefined,
    }),
    [pageSize, page, debouncedSearch, status],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["admin-payouts", queryParams],
    queryFn: async () => {
      const res = await getAdminPayouts(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load payouts");
      return res.data;
    },
  });

  useEffect(() => {
    if (isError) {
      message.error(error instanceof Error ? error.message : "Unable to load payouts.");
    }
  }, [isError, error, message]);

  async function handleQueueApproved() {
    setQueueing(true);
    try {
      const res = await queueApprovedAdminPayouts(100);
      if (!res.status) {
        message.error(res.message ?? "Queue failed");
        return;
      }
      message.success(
        res.message ??
          `Queued ${res.data?.queuedCount ?? 0} payout(s) for processing`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
    } finally {
      setQueueing(false);
    }
  }

  const columns: TableColumnsType<StorefrontPayoutDto> = [
    {
      title: "Requested",
      dataIndex: "requestedAt",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "Reference",
      dataIndex: "requestReference",
      render: (v, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-medium text-[#800020] hover:underline"
          onClick={() => {
            setSelectedId(row.id);
            setDetailOpen(true);
          }}
        >
          {v?.trim() || row.id.slice(0, 8)}
        </button>
      ),
    },
    {
      title: "Owner",
      dataIndex: "ownerId",
      ellipsis: true,
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v, row) =>
        formatCurrency(v, row.currency === "USD" ? "USD" : "NGN"),
    },
    {
      title: "Net",
      dataIndex: "netAmount",
      align: "right",
      render: (v, row) => (
        <span className="font-medium">
          {formatCurrency(v, row.currency === "USD" ? "USD" : "NGN")}
        </span>
      ),
    },
    {
      title: "Bank",
      key: "bank",
      render: (_, row) => row.bankName ?? row.accountName ?? "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: StorefrontPayoutStatus) => statusTag(v),
    },
    {
      title: "",
      key: "actions",
      width: 70,
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedId(row.id);
            setDetailOpen(true);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Storefront payouts
          </Typography.Title>
          <Typography.Text type="secondary">
            Review, approve, and process store-owner withdrawal requests.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={queueing}
          onClick={handleQueueApproved}
        >
          Queue approved payouts
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            allowClear
            className="md:flex-1"
            placeholder="Search reference, owner…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <Select
            className="md:w-48"
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            options={[
              { value: ALL, label: "All statuses" },
              ...STATUS_OPTIONS,
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontPayoutDto>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isLoading || isFetching}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="No payouts" /> }}
          pagination={{
            current: page,
            pageSize,
            total: Number(data?.count ?? 0),
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      <PayoutDetailModal
        payoutId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["admin-payouts"] })}
      />
    </div>
  );
}
