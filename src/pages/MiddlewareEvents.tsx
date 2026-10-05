import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import { FilterOutlined, ReloadOutlined, RedoOutlined } from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  BULK_REPLAYABLE,
  EVENT_TYPE_OPTIONS,
  MAX_BULK_REPLAY,
  STATUS_OPTIONS,
  STATUS_ORDER,
  eventTypeLabel,
  filterToParams,
  formatDateTime,
  formatDuration,
  formatRelative,
  healthColor,
  normalizeSummary,
  statusLabel,
  variantLabel,
  type MiddlewareEventErrorGroup,
  type MiddlewareEventFilter,
  type MiddlewareEventReplayResult,
  type MiddlewareEventRow,
  type MiddlewareEventStatus,
  type MiddlewareEventSummary,
} from "@/lib/middlewareEvents";
import {
  MiddlewareEventDetailModal,
  MiddlewareEventStatusTag,
} from "@/components/middlewareEvents/MiddlewareEventDetailModal";
import type { PaginationResponse } from "@/lib/types";

const { RangePicker } = DatePicker;

const ALL = "__all__";

const WINDOW_OPTIONS = [
  { value: 1, label: "Last hour" },
  { value: 6, label: "Last 6 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 72, label: "Last 3 days" },
  { value: 168, label: "Last 7 days" },
  { value: 720, label: "Last 30 days" },
];

// The drainer sweeps every 15s; refreshing the summary faster than that shows nothing new.
const SUMMARY_REFRESH_MS = 30_000;

export default function MiddlewareEventsPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const canReplay = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));

  const [windowHours, setWindowHours] = useState(24);
  const [status, setStatus] = useState<string>(ALL);
  const [eventType, setEventType] = useState<string>(ALL);
  const [dynamicsId, setDynamicsId] = useState("");
  const [errorContains, setErrorContains] = useState("");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLimit, setBulkLimit] = useState(100);
  const [bulkRunning, setBulkRunning] = useState(false);

  const debouncedDynamicsId = useDebouncedValue(dynamicsId, 350);
  const debouncedError = useDebouncedValue(errorContains, 350);

  const summaryQuery = useQuery({
    queryKey: ["middleware-events-summary", windowHours],
    queryFn: async () => {
      const res = await apiGet<MiddlewareEventSummary>(
        `MiddlewareEvents/Summary?hours=${windowHours}`,
      );
      if (!res.status || !res.data)
        throw new Error(res.message ?? "Failed to load queue health");
      return normalizeSummary(res.data);
    },
    refetchInterval: SUMMARY_REFRESH_MS,
    placeholderData: (prev) => prev,
  });
  const summary = summaryQuery.data;

  const filter = useMemo<MiddlewareEventFilter>(() => {
    const [from, to] = range ?? [null, null];
    return {
      status: status === ALL ? undefined : (status as MiddlewareEventStatus),
      eventType: eventType === ALL ? undefined : eventType,
      dynamicsId: debouncedDynamicsId,
      errorContains: debouncedError,
      // From/To compare against received time inclusively — widen to whole days.
      from: from?.startOf("day").toISOString(),
      to: to?.endOf("day").toISOString(),
    };
  }, [status, eventType, debouncedDynamicsId, debouncedError, range]);

  const queryParams = useMemo(() => {
    const params = filterToParams(filter);
    params.set("PageNumber", String(page));
    params.set("PageSize", String(pageSize));
    return params.toString();
  }, [filter, page, pageSize]);

  const eventsQuery = useQuery({
    queryKey: ["middleware-events", queryParams],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<MiddlewareEventRow>>(
        `MiddlewareEvents/Query?${queryParams}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load events");
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const rows = eventsQuery.data?.data ?? [];
  const total = Number(eventsQuery.data?.count ?? 0);

  const hasFilters =
    status !== ALL ||
    eventType !== ALL ||
    !!dynamicsId ||
    !!errorContains ||
    !!range;

  const bulkEligible =
    canReplay && BULK_REPLAYABLE.includes(status as MiddlewareEventStatus);

  function clearFilters() {
    setStatus(ALL);
    setEventType(ALL);
    setDynamicsId("");
    setErrorContains("");
    setRange(null);
    setPage(1);
  }

  function applyStatus(s: MiddlewareEventStatus) {
    setPage(1);
    setStatus((cur) => (cur === s ? ALL : s));
  }

  // Top-error triage: narrow the table to the open rows that share this error.
  function applyErrorGroup(g: MiddlewareEventErrorGroup) {
    setPage(1);
    setStatus("GaveUp");
    setEventType(g.eventType || ALL);
    setDynamicsId("");
    setErrorContains(g.error);
    setRange(null);
  }

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["middleware-events-summary"] });
    queryClient.invalidateQueries({ queryKey: ["middleware-events"] });
  }

  async function runBulkReplay() {
    setBulkRunning(true);
    const res = await apiPost<MiddlewareEventReplayResult>(
      "MiddlewareEvents/ReplayMany",
      {
        status: filter.status,
        eventType: filter.eventType,
        dynamicsId: filter.dynamicsId?.trim() || undefined,
        from: filter.from,
        to: filter.to,
        errorContains: filter.errorContains?.trim() || undefined,
        limit: bulkLimit,
      },
    );
    setBulkRunning(false);
    if (!res.status) {
      message.error(res.message ?? "Bulk replay failed");
      return;
    }
    const r = res.data;
    message.success(
      r?.alreadyQueued
        ? `${r.requeued} requeued, ${r.alreadyQueued} already waiting`
        : (res.message ?? `${r?.requeued ?? 0} event(s) requeued`),
    );
    setBulkOpen(false);
    refreshAll();
  }

  const columns: TableColumnsType<MiddlewareEventRow> = [
    {
      title: "Received",
      dataIndex: "receivedAt",
      width: 170,
      render: (v: string) => (
        <Tooltip title={formatRelative(v)}>
          <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: "Type",
      dataIndex: "eventType",
      width: 150,
      render: (v: string) => <span className="text-sm">{eventTypeLabel(v)}</span>,
    },
    {
      title: "SKU",
      dataIndex: "dynamicsId",
      width: 180,
      render: (v: string, row) => (
        <div>
          <div className="font-mono text-sm">{v || "—"}</div>
          {variantLabel(row.variantSignature) !== "—" && (
            <div className="font-mono text-xs text-muted-foreground">
              {variantLabel(row.variantSignature)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: string) => <MiddlewareEventStatusTag status={v} />,
    },
    {
      title: "Attempts",
      dataIndex: "attemptCount",
      width: 110,
      render: (v: number, row) => (
        <div>
          <div className="text-sm">{v}</div>
          {row.nextAttemptAt && (
            <Tooltip title={formatDateTime(row.nextAttemptAt)}>
              <div className="text-xs text-muted-foreground">
                next {formatRelative(row.nextAttemptAt)}
              </div>
            </Tooltip>
          )}
        </div>
      ),
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
      title: "Latency",
      dataIndex: "latencySeconds",
      width: 90,
      render: (v: number | null) => (
        <span className="text-xs">{formatDuration(v)}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      align: "right",
      render: (_, row) => (
        <Button size="small" onClick={() => setSelectedId(row.id)}>
          View
        </Button>
      ),
    },
  ];

  const errorColumns: TableColumnsType<MiddlewareEventErrorGroup> = [
    {
      title: "Error",
      dataIndex: "error",
      ellipsis: { showTitle: false },
      render: (v: string) => (
        <Tooltip title={<span className="whitespace-pre-wrap">{v}</span>}>
          <span className="font-mono text-xs">{v}</span>
        </Tooltip>
      ),
    },
    {
      title: "Type",
      dataIndex: "eventType",
      width: 150,
      render: (v: string) => eventTypeLabel(v),
    },
    { title: "Rows", dataIndex: "count", width: 70, align: "right" },
    {
      title: "Example SKU",
      dataIndex: "exampleDynamicsId",
      width: 150,
      render: (v: string) => <span className="font-mono text-xs">{v || "—"}</span>,
    },
    {
      title: "Last seen",
      dataIndex: "lastSeenAt",
      width: 110,
      render: (v: string) => (
        <Tooltip title={formatDateTime(v)}>
          <span className="text-xs">{formatRelative(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: "",
      key: "filter",
      width: 90,
      align: "right",
      render: (_, g) => (
        <Tooltip title="Show the gave-up events with this error">
          <Button size="small" icon={<FilterOutlined />} onClick={() => applyErrorGroup(g)}>
            Show
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Middleware Events
          </Typography.Title>
          <Typography.Text type="secondary">
            The webhook queue that applies Dynamics price, quantity and product
            changes from Middleware. See what is stuck and why, then replay it
            once the cause is fixed.
          </Typography.Text>
        </div>
        <div className="flex gap-2">
          <Select
            value={windowHours}
            onChange={setWindowHours}
            options={WINDOW_OPTIONS}
            style={{ width: 160 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshAll}
            loading={summaryQuery.isFetching || eventsQuery.isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>

      {summaryQuery.error && !summary && (
        <Alert type="error" showIcon message={(summaryQuery.error as Error).message} />
      )}

      {summary && (
        <>
          <Alert
            type={healthColor(summary.health)}
            showIcon
            message={
              <span className="font-medium">
                Queue {summary.health.toLowerCase()}
              </span>
            }
            description={
              summary.healthReasons.length ? (
                <ul className="m-0 list-disc pl-5">
                  {summary.healthReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                "Events are arriving and being applied."
              )
            }
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {STATUS_ORDER.map((s) => {
              const active = status === s;
              const open = s === "Pending" || s === "Retrying" || s === "GaveUp";
              return (
                <Card
                  key={s}
                  hoverable
                  size="small"
                  onClick={() => applyStatus(s)}
                  className={active ? "!border-[#800020]" : undefined}
                >
                  <div className="text-xs text-muted-foreground">
                    {statusLabel(s)}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {(summary.byStatus[s] ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {open ? "open now" : `in last ${summary.windowHours}h`}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card size="small">
              <div className="text-xs text-muted-foreground">Received in window</div>
              <div className="text-lg font-semibold tabular-nums">
                {summary.receivedInWindow.toLocaleString()}
              </div>
            </Card>
            <Card size="small">
              <div className="text-xs text-muted-foreground">Last received</div>
              <Tooltip title={formatDateTime(summary.lastReceivedAt)}>
                <div className="text-lg font-semibold">
                  {formatRelative(summary.lastReceivedAt)}
                </div>
              </Tooltip>
            </Card>
            <Card size="small">
              <div className="text-xs text-muted-foreground">Last processed</div>
              <Tooltip title={formatDateTime(summary.lastProcessedAt)}>
                <div className="text-lg font-semibold">
                  {formatRelative(summary.lastProcessedAt)}
                </div>
              </Tooltip>
            </Card>
            <Card size="small">
              <div className="text-xs text-muted-foreground">
                Avg latency · oldest pending
              </div>
              <div className="text-lg font-semibold">
                {formatDuration(summary.averageLatencySeconds)}
                <span className="text-muted-foreground"> · </span>
                {formatDuration(summary.oldestPendingAgeSeconds)}
              </div>
            </Card>
          </div>

          {summary.topErrors.length > 0 && (
            <Card
              title="Top errors on open events"
              size="small"
              styles={{ body: { padding: 0 } }}
            >
              <Table<MiddlewareEventErrorGroup>
                rowKey={(g) => `${g.eventType}|${g.error}`}
                size="small"
                dataSource={summary.topErrors}
                columns={errorColumns}
                pagination={false}
                scroll={{ x: 760 }}
              />
            </Card>
          )}

          {summary.byEventType.length > 0 && (
            <Card title="By event type" size="small" styles={{ body: { padding: 0 } }}>
              <Table
                rowKey="eventType"
                size="small"
                pagination={false}
                dataSource={summary.byEventType}
                scroll={{ x: 760 }}
                columns={[
                  {
                    title: "Type",
                    dataIndex: "eventType",
                    render: (v: string) => (
                      <a
                        onClick={() => {
                          setPage(1);
                          setEventType(v);
                        }}
                      >
                        {eventTypeLabel(v)}
                      </a>
                    ),
                  },
                  ...STATUS_ORDER.map((s) => ({
                    title: statusLabel(s),
                    key: s,
                    width: 100,
                    align: "right" as const,
                    render: (_: unknown, row: MiddlewareEventSummary["byEventType"][number]) => {
                      const n = row.byStatus[s] ?? 0;
                      return n === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : s === "GaveUp" ? (
                        <Tag color="error" className="!m-0">{n}</Tag>
                      ) : (
                        n.toLocaleString()
                      );
                    },
                  })),
                ]}
              />
            </Card>
          )}
        </>
      )}

      <Card styles={{ body: { padding: 16 } }}>
        <Form layout="vertical">
          <div className="grid gap-3 md:grid-cols-12">
            <Form.Item className="md:col-span-2 !mb-0" label="Status">
              <Select
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                options={[{ value: ALL, label: "All statuses" }, ...STATUS_OPTIONS]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-3 !mb-0" label="Event type">
              <Select
                value={eventType}
                onChange={(v) => {
                  setPage(1);
                  setEventType(v);
                }}
                options={[{ value: ALL, label: "All types" }, ...EVENT_TYPE_OPTIONS]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-3 !mb-0" label="Dynamics ID">
              <Input
                placeholder="Exact SKU…"
                value={dynamicsId}
                onChange={(e) => {
                  setPage(1);
                  setDynamicsId(e.target.value);
                }}
                allowClear
              />
            </Form.Item>
            <Form.Item className="md:col-span-4 !mb-0" label="Error contains">
              <Input
                placeholder="e.g. Location not found"
                value={errorContains}
                onChange={(e) => {
                  setPage(1);
                  setErrorContains(e.target.value);
                }}
                allowClear
              />
            </Form.Item>
            <Form.Item className="md:col-span-5 !mb-0" label="Received between">
              <RangePicker
                className="w-full"
                value={range}
                onChange={(v) => {
                  setPage(1);
                  setRange(v ? [v[0], v[1]] : null);
                }}
              />
            </Form.Item>
          </div>
          {(hasFilters || bulkEligible) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hasFilters && (
                <Button size="small" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              {bulkEligible && total > 0 && (
                <Button
                  size="small"
                  type="primary"
                  icon={<RedoOutlined />}
                  onClick={() => {
                    setBulkLimit(Math.min(total, MAX_BULK_REPLAY));
                    setBulkOpen(true);
                  }}
                >
                  Replay matching ({total.toLocaleString()})
                </Button>
              )}
            </div>
          )}
          {canReplay && !bulkEligible && status !== ALL && (
            <Typography.Text type="secondary" className="mt-2 block text-xs">
              Bulk replay is available for Gave up and Skipped events. Replay
              others one at a time from their detail view.
            </Typography.Text>
          )}
        </Form>
      </Card>

      {eventsQuery.error && (
        <Alert type="error" showIcon message={(eventsQuery.error as Error).message} />
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<MiddlewareEventRow>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={eventsQuery.isLoading || eventsQuery.isFetching}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            // The API caps PageSize at 200.
            pageSizeOptions: [20, 50, 100, 200],
            showTotal: (t) => `${t.toLocaleString()} events`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "No events match these filters."
                    : "No events received yet."
                }
              />
            ),
          }}
          size="middle"
          scroll={{ x: 1100 }}
        />
      </Card>

      <MiddlewareEventDetailModal
        eventId={selectedId}
        canReplay={canReplay}
        onClose={() => setSelectedId(null)}
      />

      <Modal
        open={bulkOpen}
        title={`Replay ${statusLabel(status)} events`}
        okText="Replay"
        onOk={runBulkReplay}
        confirmLoading={bulkRunning}
        onCancel={() => setBulkOpen(false)}
        destroyOnClose
      >
        <div className="space-y-3 text-sm">
          <p className="m-0">
            Requeues the matching events oldest first so the drainer applies
            them on its next sweep. Each one still loses to a newer event for
            the same variant, so this cannot regress a price.
          </p>
          <p className="m-0 text-muted-foreground">
            {total.toLocaleString()} event(s) match the current filters
            {total > MAX_BULK_REPLAY &&
              ` — at most ${MAX_BULK_REPLAY} can be replayed per run`}
            .
          </p>
          <Form.Item label="How many" className="!mb-0">
            <InputNumber
              min={1}
              max={Math.min(Math.max(total, 1), MAX_BULK_REPLAY)}
              value={bulkLimit}
              onChange={(v) => setBulkLimit(v ?? 1)}
            />
          </Form.Item>
        </div>
      </Modal>
    </div>
  );
}
