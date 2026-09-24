import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import {
  decideStorefrontCouponRequest,
  getStorefrontCouponRequest,
  getStorefrontCouponRequests,
} from "@/lib/storefrontApi";
import type {
  StorefrontCouponRequestResponse,
  StorefrontCouponRequestStatus,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";

const ALL = "__all__";

const STATUS_OPTIONS: { value: StorefrontCouponRequestStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

function statusTag(status: StorefrontCouponRequestStatus) {
  const colors: Record<StorefrontCouponRequestStatus, string> = {
    Pending: "processing",
    Approved: "success",
    Rejected: "error",
  };
  return <Tag color={colors[status]}>{status}</Tag>;
}

export default function StorefrontCouponRequestsPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      status: status !== ALL ? (status as StorefrontCouponRequestStatus) : undefined,
    }),
    [pageSize, page, debouncedSearch, status],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["storefront-coupon-requests", queryParams],
    queryFn: async () => {
      const res = await getStorefrontCouponRequests(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load coupon requests");
      return res.data;
    },
  });

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? error.message : "Unable to load coupon requests.",
      );
    }
  }, [isError, error, message]);

  const columns: TableColumnsType<StorefrontCouponRequestResponse> = [
    {
      title: "Requested",
      dataIndex: "dateCreated",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "Owner",
      key: "owner",
      render: (_, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-[#800020] hover:underline"
          onClick={() => {
            setSelectedId(row.id);
            setDetailOpen(true);
          }}
        >
          {row.storefrontOwnerName?.trim() || row.storefrontOwnerEmail || row.storefrontOwnerId || "—"}
        </button>
      ),
    },
    {
      title: "Coupon name",
      dataIndex: "name",
      ellipsis: true,
      render: (v) => v ?? "—",
    },
    {
      title: "Code",
      dataIndex: "requestedCode",
      render: (v) => (v ? <span className="font-mono text-xs">{v}</span> : "—"),
    },
    {
      title: "Products",
      dataIndex: "products",
      align: "right",
      width: 90,
      render: (v: StorefrontCouponRequestResponse["products"]) => v?.length ?? 0,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: StorefrontCouponRequestStatus) => statusTag(v),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(row.id);
            setDetailOpen(true);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Storefront coupon requests
        </Typography.Title>
        <Typography.Text type="secondary">
          Review and approve or reject coupon requests submitted by store owners.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            allowClear
            className="md:flex-1"
            placeholder="Search owner, name, or code…"
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
        <Table<StorefrontCouponRequestResponse>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          onRow={(row) => ({
            onClick: () => {
              setSelectedId(row.id);
              setDetailOpen(true);
            },
            style: { cursor: "pointer" },
          })}
          loading={isLoading || isFetching}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="No coupon requests" /> }}
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

      <StorefrontCouponRequestModal
        requestId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["storefront-coupon-requests"] })}
      />
    </div>
  );
}

function StorefrontCouponRequestModal({
  requestId,
  open,
  onOpenChange,
  onUpdated,
}: {
  requestId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [deciding, setDeciding] = useState(false);
  const [note, setNote] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["storefront-coupon-request", requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const res = await getStorefrontCouponRequest(requestId);
      if (!res.status) throw new Error(res.message ?? "Failed to load coupon request");
      return res.data;
    },
    enabled: !!requestId && open,
  });

  useEffect(() => {
    if (!open) setNote("");
  }, [open]);

  async function decide(status: StorefrontCouponRequestStatus) {
    if (!data) return;
    setDeciding(true);
    try {
      const res = await decideStorefrontCouponRequest(data.id, {
        status,
        adminNote: note.trim() || null,
      });
      if (!res.status) {
        message.error(res.message ?? "Decision failed");
        return;
      }
      message.success(res.message ?? `Request ${status.toLowerCase()}`);
      await refetch();
      onUpdated();
    } finally {
      setDeciding(false);
    }
  }

  const item = data as StorefrontCouponRequestResponse | null | undefined;

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={item ? `Coupon request — ${item.name ?? item.id.slice(0, 8)}` : "Coupon request"}
      width={760}
      footer={
        item?.status === "Pending"
          ? [
              <Button
                key="reject"
                danger
                loading={deciding}
                onClick={() => decide("Rejected")}
              >
                Reject
              </Button>,
              <Button
                key="approve"
                type="primary"
                loading={deciding}
                onClick={() => decide("Approved")}
              >
                Approve
              </Button>,
              <Button key="close" onClick={() => onOpenChange(false)}>
                Close
              </Button>,
            ]
          : [
              <Button key="close" onClick={() => onOpenChange(false)}>
                Close
              </Button>,
            ]
      }
      destroyOnClose
    >
      {isLoading || !item ? (
        <Card loading />
      ) : (
        <div className="space-y-4">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="Status">{statusTag(item.status)}</Descriptions.Item>
            <Descriptions.Item label="Owner">
              {item.storefrontOwnerName ?? item.storefrontOwnerEmail ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {item.storefrontOwnerEmail ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Requested code">
              {item.requestedCode ? (
                <span className="font-mono text-xs">{item.requestedCode}</span>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Requested" span={2}>
              {formatDate(item.dateCreated)}
            </Descriptions.Item>
            <Descriptions.Item label="Reason" span={2}>
              <span className="whitespace-pre-wrap">{item.reason ?? "—"}</span>
            </Descriptions.Item>
            {item.adminNote && (
              <Descriptions.Item label="Admin note" span={2}>
                <span className="whitespace-pre-wrap">{item.adminNote}</span>
              </Descriptions.Item>
            )}
          </Descriptions>

          {item.products && item.products.length > 0 && (
            <Table
              size="small"
              rowKey="id"
              title={() => <span className="font-medium">Requested products</span>}
              dataSource={item.products}
              pagination={false}
              scroll={{ x: 500 }}
              columns={[
                {
                  title: "Product ID",
                  dataIndex: "productId",
                  render: (v) => <span className="font-mono text-xs">{v}</span>,
                },
                {
                  title: "Naira",
                  dataIndex: "requestedPriceInNaira",
                  align: "right",
                  render: (v: number | null) =>
                    v != null ? formatCurrency(v, "NGN") : "—",
                },
                {
                  title: "Dollar",
                  dataIndex: "requestedPriceInDollar",
                  align: "right",
                  render: (v: number | null) =>
                    v != null ? formatCurrency(v, "USD") : "—",
                },
              ]}
            />
          )}

          {item.status === "Pending" && (
            <Input.TextArea
              rows={3}
              maxLength={2000}
              placeholder="Admin note (optional, saved with your decision)…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
