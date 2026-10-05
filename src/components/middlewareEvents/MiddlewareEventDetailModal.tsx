import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Descriptions,
  Modal,
  Popconfirm,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { RedoOutlined } from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import {
  MiddlewareEventStatus,
  eventTypeLabel,
  formatDateTime,
  formatDuration,
  formatRelative,
  statusColor,
  statusHint,
  statusLabel,
  variantLabel,
  type MiddlewareEventDetail,
  type MiddlewareEventReplayResult,
  type MiddlewareEventRow,
} from "@/lib/middlewareEvents";

interface MiddlewareEventDetailModalProps {
  /** Id of the event to show. The modal follows SKU-history clicks on its own. */
  eventId: string | null;
  canReplay: boolean;
  onClose: () => void;
}

export function MiddlewareEventStatusTag({ status }: { status: string }) {
  return (
    <Tooltip title={statusHint(status)}>
      <Tag color={statusColor(status)} className="!m-0">
        {statusLabel(status)}
      </Tag>
    </Tooltip>
  );
}

/** Confirmation copy per status — replaying a closed row is not equally safe for each. */
function replayWarning(status: MiddlewareEventStatus): string {
  switch (status) {
    case "Retrying":
      return "Skip the rest of its backoff and retry on the next sweep?";
    case "Applied":
      return "This event was already applied. Requeue it anyway? A newer event for the same variant still wins.";
    case "Superseded":
      return "A newer event replaced this one. Requeue it anyway? The newer event still wins.";
    default:
      return "Requeue this event to be applied on the next sweep?";
  }
}

export function MiddlewareEventDetailModal({
  eventId,
  canReplay,
  onClose,
}: MiddlewareEventDetailModalProps) {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  // History rows open in place, so the modal tracks its own current id.
  const [trail, setTrail] = useState<string[]>([]);
  const [replaying, setReplaying] = useState(false);
  const currentId = trail[trail.length - 1] ?? eventId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["middleware-event", currentId],
    queryFn: async () => {
      const res = await apiGet<MiddlewareEventDetail>(
        `MiddlewareEvents/GetById/${currentId}`,
      );
      if (!res.status || !res.data)
        throw new Error(res.message ?? "Failed to load event");
      return res.data;
    },
    enabled: !!currentId,
  });

  function close() {
    setTrail([]);
    onClose();
  }

  async function replay() {
    if (!currentId) return;
    setReplaying(true);
    const res = await apiPost<MiddlewareEventReplayResult>(
      `MiddlewareEvents/Replay/${currentId}`,
    );
    setReplaying(false);
    if (!res.status) {
      message.error(res.message ?? "Replay failed");
      return;
    }
    // Requeued, already queued and not eligible all come back 200 — the counts say which.
    if (res.data?.requeued) message.success(res.message ?? "Requeued");
    else message.info(res.message ?? "Nothing was requeued");
    queryClient.invalidateQueries({ queryKey: ["middleware-event"] });
    queryClient.invalidateQueries({ queryKey: ["middleware-events"] });
    queryClient.invalidateQueries({ queryKey: ["middleware-events-summary"] });
  }

  const ev = data?.event;

  const historyColumns: TableColumnsType<MiddlewareEventRow> = [
    {
      title: "Received",
      dataIndex: "receivedAt",
      width: 170,
      render: (v: string) => (
        <span className="text-xs">{formatDateTime(v)}</span>
      ),
    },
    {
      title: "Type",
      dataIndex: "eventType",
      render: (v: string) => eventTypeLabel(v),
    },
    {
      title: "Variant",
      dataIndex: "variantSignature",
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
      title: "",
      key: "open",
      width: 70,
      align: "right",
      render: (_, row) =>
        row.id === currentId ? (
          <Typography.Text type="secondary" className="text-xs">
            Current
          </Typography.Text>
        ) : (
          <Button size="small" onClick={() => setTrail((t) => [...t, row.id])}>
            Open
          </Button>
        ),
    },
  ];

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div>
        {trail.length > 0 && (
          <Button onClick={() => setTrail((t) => t.slice(0, -1))}>Back</Button>
        )}
      </div>
      <div className="flex gap-2">
        {canReplay && ev && ev.status !== "Pending" && (
          <Popconfirm
            title="Replay event"
            description={
              <div className="max-w-xs">{replayWarning(ev.status)}</div>
            }
            okText="Replay"
            onConfirm={replay}
          >
            <Button type="primary" icon={<RedoOutlined />} loading={replaying}>
              Replay
            </Button>
          </Popconfirm>
        )}
        <Button onClick={close}>Close</Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={!!eventId}
      onCancel={close}
      title="Middleware event"
      width={900}
      footer={footer}
      destroyOnClose
    >
      {isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
      {error && (
        <Alert type="error" showIcon message={(error as Error).message} />
      )}
      {ev && (
        <div className="space-y-5">
          <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Status">
              <MiddlewareEventStatusTag status={ev.status} />
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              {eventTypeLabel(ev.eventType)}
              <div className="font-mono text-xs text-muted-foreground">
                {ev.eventType}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Dynamics ID">
              <Typography.Text copyable className="font-mono">
                {ev.dynamicsId || "—"}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Variant">
              <span className="font-mono text-xs">
                {variantLabel(ev.variantSignature)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Received">
              {formatDateTime(ev.receivedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Processed">
              {ev.processedAt ? (
                <>
                  {formatDateTime(ev.processedAt)}
                  <div className="text-xs text-muted-foreground">
                    after {formatDuration(ev.latencySeconds)}
                  </div>
                </>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Attempts">
              {ev.attemptCount}
              {ev.lastAttemptAt && (
                <span className="text-xs text-muted-foreground">
                  {" "}
                  · last {formatRelative(ev.lastAttemptAt)}
                </span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Next attempt">
              {ev.nextAttemptAt ? (
                <Tooltip title={formatDateTime(ev.nextAttemptAt)}>
                  {formatRelative(ev.nextAttemptAt)}
                </Tooltip>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            {ev.lastError && (
              <Descriptions.Item label="Last error" span={2}>
                <Typography.Paragraph
                  className="!mb-0 whitespace-pre-wrap font-mono text-xs"
                  type={
                    ev.status === "GaveUp" || ev.status === "Retrying"
                      ? "danger"
                      : undefined
                  }
                >
                  {ev.lastError}
                </Typography.Paragraph>
              </Descriptions.Item>
            )}
          </Descriptions>

          <div>
            <Typography.Title level={5}>Raw payload</Typography.Title>
            {data.rawPayload == null ? (
              <Typography.Text type="secondary">
                The stored body is not valid JSON.
              </Typography.Text>
            ) : (
              <pre className="max-h-72 overflow-auto rounded-md bg-black/5 p-3 text-xs dark:bg-white/10">
                {JSON.stringify(data.rawPayload, null, 2)}
              </pre>
            )}
          </div>

          <div>
            <Typography.Title level={5}>
              SKU history
              <Typography.Text type="secondary" className="ml-2 text-xs font-normal">
                latest {data.skuHistory.length} events for {ev.dynamicsId || "this SKU"}
              </Typography.Text>
            </Typography.Title>
            <Table<MiddlewareEventRow>
              rowKey="id"
              size="small"
              dataSource={data.skuHistory}
              columns={historyColumns}
              pagination={false}
              scroll={{ x: 640, y: 280 }}
              rowClassName={(r) => (r.id === currentId ? "bg-black/5" : "")}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
