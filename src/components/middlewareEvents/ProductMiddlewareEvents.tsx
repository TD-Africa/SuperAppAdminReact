import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert, Button, Empty, Table, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { ApiOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  eventTypeLabel,
  formatDateTime,
  formatRelative,
  variantLabel,
  type MiddlewareEventRow,
} from "@/lib/middlewareEvents";
import {
  MiddlewareEventDetailModal,
  MiddlewareEventStatusTag,
} from "@/components/middlewareEvents/MiddlewareEventDetailModal";
import type { PaginationResponse } from "@/lib/types";

const RECENT_COUNT = 10;

/**
 * The latest webhook events Middleware sent for one SKU — answers "why is this
 * product's price/stock not what Dynamics says" without leaving the product.
 */
export function ProductMiddlewareEvents({ dynamicsId }: { dynamicsId: string }) {
  const canReplay = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "middleware-events",
      `DynamicsId=${dynamicsId}&PageSize=${RECENT_COUNT}&PageNumber=1`,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        DynamicsId: dynamicsId,
        PageSize: String(RECENT_COUNT),
        PageNumber: "1",
      });
      const res = await apiGet<PaginationResponse<MiddlewareEventRow>>(
        `MiddlewareEvents/Query?${params}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load sync events");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const total = Number(data?.count ?? 0);
  // Of what's shown — the open ones are what explain a product being out of date.
  const stuck = rows.filter((r) => r.status === "GaveUp").length;
  const retrying = rows.filter((r) => r.status === "Retrying").length;

  const columns: TableColumnsType<MiddlewareEventRow> = [
    {
      title: "Received",
      dataIndex: "receivedAt",
      width: 170,
      render: (v: string) => (
        <Tooltip title={formatRelative(v)}>
          <span className="text-xs">{formatDateTime(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: "Type",
      dataIndex: "eventType",
      width: 150,
      render: (v: string) => eventTypeLabel(v),
    },
    {
      title: "Variant",
      dataIndex: "variantSignature",
      width: 140,
      render: (v: string) => (
        <span className="font-mono text-xs">{variantLabel(v)}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => <MiddlewareEventStatusTag status={v} />,
    },
    {
      title: "Last error",
      dataIndex: "lastError",
      ellipsis: { showTitle: false },
      render: (v: string | null) =>
        v ? (
          <Tooltip title={<span className="whitespace-pre-wrap">{v}</span>}>
            <span className="font-mono text-xs">{v}</span>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      title: "",
      key: "view",
      width: 70,
      align: "right",
      render: (_, row) => (
        <Button size="small" onClick={() => setSelectedId(row.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Typography.Title level={5} className="!m-0">
          Sync events
          {stuck > 0 && (
            <Tag color="error" className="!ml-2 align-middle">
              {stuck} gave up
            </Tag>
          )}
          {retrying > 0 && (
            <Tag color="warning" className="!ml-2 align-middle">
              {retrying} retrying
            </Tag>
          )}
        </Typography.Title>
        <Link to={`/middleware-events?dynamicsId=${encodeURIComponent(dynamicsId)}`}>
          <Button size="small" icon={<ApiOutlined />}>
            {total > RECENT_COUNT
              ? `All ${total.toLocaleString()} events`
              : "Open in Middleware Events"}
          </Button>
        </Link>
      </div>

      {error ? (
        <Alert type="error" showIcon message={(error as Error).message} />
      ) : (
        <Table<MiddlewareEventRow>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{ x: 760 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Middleware hasn't sent any events for this product."
              />
            ),
          }}
        />
      )}

      <MiddlewareEventDetailModal
        eventId={selectedId}
        canReplay={canReplay}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
