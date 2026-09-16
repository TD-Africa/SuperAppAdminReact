import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Modal,
  Skeleton,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { apiGet } from "@/lib/api";
import {
  auditActionColor,
  changeAfter,
  changeBefore,
  classifyAction,
  entityTypeLabel,
  formatValue,
  humanFieldName,
} from "@/lib/auditTrail";
import type { AdminAuditLogItem } from "@/lib/types";

interface DiffRow {
  key: string;
  fieldName: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

interface SnapshotRow {
  key: string;
  fieldName: string;
  value: unknown;
}

interface AuditTrailDetailModalProps {
  /** The list row that was clicked. Used to render immediately while the full
   *  record loads — Query already returns the snapshots, but GetById is the
   *  authoritative single-record read and keeps this modal deep-linkable. */
  item: AdminAuditLogItem | null;
  open: boolean;
  onClose: () => void;
}

export function AuditTrailDetailModal({
  item,
  open,
  onClose,
}: AuditTrailDetailModalProps) {
  const id = item?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-trail-detail", id],
    queryFn: async () => {
      const res = await apiGet<AdminAuditLogItem>(`AuditLog/GetById/${id}`);
      if (!res.status || !res.data)
        throw new Error(res.message ?? "Failed to load audit log entry");
      return res.data;
    },
    enabled: open && !!id,
    staleTime: Infinity, // Audit rows are immutable once written.
  });

  // Fall back to the list row so the modal has content on first paint and still
  // renders if GetById fails.
  const entry = data ?? item;

  const { diffRows, changedRows, snapshotRows, mode } = useMemo(() => {
    if (!entry)
      return {
        diffRows: [] as DiffRow[],
        changedRows: [] as DiffRow[],
        snapshotRows: [] as SnapshotRow[],
        mode: "updated" as const,
      };

    const before = (entry.beforeData ?? {}) as Record<string, unknown>;
    const after = (entry.afterData ?? {}) as Record<string, unknown>;
    const changes = entry.changes ?? {};

    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(changes)]),
    ).sort();

    const diff: DiffRow[] = keys.map((k) => ({
      key: k,
      fieldName: humanFieldName(k),
      // Prefer the snapshots; the diff payload is the backstop for fields that
      // only appear in `changes` (e.g. a backfilled row with no full snapshot).
      before: k in before ? before[k] : changeBefore(changes[k]),
      after: k in after ? after[k] : changeAfter(changes[k]),
      changed: k in changes,
    }));

    // For create/delete/one-shot actions only one side is populated; prefer
    // `after` since LogActionAsync stores its detail payload there.
    const source = Object.keys(after).length > 0 ? after : before;
    const snapshot: SnapshotRow[] = Object.keys(source)
      .sort()
      .map((k) => ({ key: k, fieldName: humanFieldName(k), value: source[k] }));

    return {
      diffRows: diff,
      changedRows: diff.filter((r) => r.changed),
      snapshotRows: snapshot,
      mode: classifyAction(entry),
    };
  }, [entry]);

  const diffColumns: TableColumnsType<DiffRow> = [
    { title: "Field", dataIndex: "fieldName", width: "25%" },
    {
      title: "Before",
      dataIndex: "before",
      width: "37.5%",
      render: (_, row) => (
        <span
          className={
            "block whitespace-pre-wrap break-words px-2 py-1 " +
            (row.changed ? "bg-amber-100/70 text-amber-900" : "")
          }
        >
          {formatValue(row.before)}
        </span>
      ),
    },
    {
      title: "After",
      dataIndex: "after",
      width: "37.5%",
      render: (_, row) => (
        <span
          className={
            "block whitespace-pre-wrap break-words px-2 py-1 " +
            (row.changed ? "bg-emerald-100/70 text-emerald-900" : "")
          }
        >
          {formatValue(row.after)}
        </span>
      ),
    },
  ];

  const snapshotColumns: TableColumnsType<SnapshotRow> = [
    { title: "Field", dataIndex: "fieldName", width: "33%" },
    {
      title: mode === "created" ? "Recorded value" : "Value at deletion",
      dataIndex: "value",
      render: (v) => (
        <span
          className={
            "block whitespace-pre-wrap break-words px-2 py-1 " +
            (mode === "created"
              ? "bg-emerald-100/70 text-emerald-900"
              : "bg-rose-100/70 text-rose-900")
          }
        >
          {formatValue(v)}
        </span>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Audit trail entry"
      width={1100}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      {isLoading && !item ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        entry && (
          <div className="space-y-5">
            {error && (
              <Alert
                type="warning"
                showIcon
                message="Showing the row from the list"
                description={(error as Error).message}
              />
            )}

            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Action">
                <Tag color={auditActionColor(entry.action)}>{entry.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Entity">
                {entityTypeLabel(entry.entityType)}
              </Descriptions.Item>
              <Descriptions.Item label="Entity ID">
                <Typography.Text copyable className="font-mono !text-xs">
                  {entry.entityId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="When">
                {new Date(entry.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Admin">
                {entry.adminName || entry.adminEmail || "—"}
                {entry.adminEmail && entry.adminName && (
                  <div className="text-xs text-muted-foreground">
                    {entry.adminEmail}
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                {entry.roleName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="IP address">
                {entry.ipAddress || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Log ID">
                <Typography.Text copyable className="font-mono !text-xs">
                  {entry.id}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="User agent" span={2}>
                <span className="break-all text-xs text-muted-foreground">
                  {entry.userAgent || "—"}
                </span>
              </Descriptions.Item>
            </Descriptions>

            {mode === "updated" ? (
              <>
                {changedRows.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">
                      What changed ({changedRows.length})
                    </h4>
                    <Table<DiffRow>
                      rowKey="key"
                      dataSource={changedRows}
                      columns={diffColumns}
                      pagination={false}
                      size="small"
                    />
                  </div>
                )}
                <div>
                  <h4 className="mb-2 text-sm font-medium">Full before / after</h4>
                  <Table<DiffRow>
                    rowKey="key"
                    dataSource={diffRows}
                    columns={diffColumns}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: "No snapshot recorded for this entry." }}
                  />
                </div>
              </>
            ) : (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {mode === "created"
                    ? "Recorded values"
                    : "Record state at deletion"}
                </h4>
                <Table<SnapshotRow>
                  rowKey="key"
                  dataSource={snapshotRows}
                  columns={snapshotColumns}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: "No snapshot recorded for this entry." }}
                />
              </div>
            )}

            <Collapse
              size="small"
              items={[
                {
                  key: "raw",
                  label: "Raw payload",
                  children: (
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify(
                        {
                          beforeData: entry.beforeData,
                          afterData: entry.afterData,
                          changes: entry.changes,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  ),
                },
              ]}
            />
          </div>
        )
      )}
    </Modal>
  );
}
