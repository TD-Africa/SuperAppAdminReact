import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Input,
  Button,
  Select,
  Tag,
  Modal,
  Typography,
  App as AntdApp,
  Table,
  Empty,
} from "antd";
import type { TableColumnsType } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { AuditLogItem, PaginatedApiResponse } from "@/lib/types";

interface AuditLogsViewProps<T extends AuditLogItem> {
  title: string;
  description: string;
  listUrl: string;
  byIdUrl: string;
  entityIdField: keyof T & string;
  entityIdLabel: string;
}

export function AuditLogsView<T extends AuditLogItem>({
  title,
  description,
  listUrl,
  byIdUrl,
  entityIdField,
  entityIdLabel,
}: AuditLogsViewProps<T>) {
  const { message } = AntdApp.useApp();
  const [idSearch, setIdSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [singleResult, setSingleResult] = useState<T | null>(null);
  const [selected, setSelected] = useState<T | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("pageNumber", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortOrder", sortOrder);
    return params;
  }, [page, pageSize, sortOrder]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", listUrl, queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginatedApiResponse<T>>(
        `${listUrl}?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load logs");
      return res.data;
    },
    enabled: !singleResult,
  });

  async function searchById() {
    const trimmed = idSearch.trim();
    if (!trimmed) {
      message.error("Please enter a log ID");
      return;
    }
    const res = await apiGet<T>(`${byIdUrl}${trimmed}`);
    if (!res.status || !res.data) {
      message.error(res.message ?? "Log not found");
      return;
    }
    setSingleResult(res.data);
  }

  const rows: T[] = singleResult ? [singleResult] : (data?.data as T[]) ?? [];
  const totalItems = singleResult ? 1 : Number(data?.totalRecords ?? 0);

  const columns: TableColumnsType<T> = [
    {
      title: "When",
      dataIndex: "createdAt",
      width: 170,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">
          {new Date(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: entityIdLabel,
      dataIndex: entityIdField,
      width: 120,
      render: (v: string) => (
        <span className="font-mono text-xs">{String(v ?? "—").slice(0, 8)}</span>
      ),
    },
    {
      title: "Admin",
      dataIndex: "adminEmail",
      render: (_: string, row: T) => (
        <div>
          <div className="text-sm font-medium">{row.adminEmail}</div>
          {row.roleName && (
            <div className="text-xs text-muted-foreground">{row.roleName}</div>
          )}
        </div>
      ),
    },
    {
      title: "IP",
      dataIndex: "ipAddress",
      width: 140,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">{v}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      align: "right",
      render: (_, row) => (
        <Button size="small" onClick={() => setSelected(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">{description}</Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-7"
            placeholder="Lookup by log ID (GUID)…"
            value={idSearch}
            prefix={<SearchOutlined />}
            onChange={(e) => setIdSearch(e.target.value)}
            onPressEnter={searchById}
            allowClear
          />
          <Button className="md:col-span-2" onClick={searchById}>
            Search
          </Button>
          <Select
            className="md:col-span-2"
            value={sortOrder}
            onChange={(v) => {
              setSortOrder(v);
              setPage(1);
              setSingleResult(null);
            }}
            options={[
              { value: "desc", label: "Newest first" },
              { value: "asc", label: "Oldest first" },
            ]}
          />
          {singleResult && (
            <Button
              className="md:col-span-1"
              type="link"
              onClick={() => {
                setSingleResult(null);
                setIdSearch("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<T>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          pagination={
            singleResult
              ? false
              : {
                  current: page,
                  pageSize,
                  total: totalItems,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                  onChange: (p, ps) => {
                    setPage(p);
                    setPageSize(ps);
                  },
                }
          }
          locale={{
            emptyText: <Empty description="No audit logs recorded yet." />,
          }}
          size="middle"
        />
      </Card>

      <AuditLogDetailModal
        item={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}

// --- Detail modal with diff ---
interface Row {
  fieldName: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

function humanFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return s;
}

type ActionMode = "created" | "deleted" | "updated";

function classifyAction(item: AuditLogItem): ActionMode {
  const a = item.action?.toLowerCase() ?? "";
  if (a.includes("delete") || a.includes("remove")) return "deleted";
  if (a.includes("create") || a.includes("add") || a.includes("insert")) return "created";
  if (a.includes("update") || a.includes("edit") || a.includes("modif") || a.includes("change")) return "updated";
  // Fall back to inspecting the data shape: empty before → created, empty after → deleted.
  const beforeEmpty = !item.beforeData || Object.keys(item.beforeData).length === 0;
  const afterEmpty = !item.afterData || Object.keys(item.afterData).length === 0;
  if (beforeEmpty && !afterEmpty) return "created";
  if (afterEmpty && !beforeEmpty) return "deleted";
  return "updated";
}

interface SingleRow {
  fieldName: string;
  value: unknown;
}

function AuditLogDetailModal({
  item,
  open,
  onOpenChange,
}: {
  item: AuditLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mode: ActionMode = item ? classifyAction(item) : "updated";

  const { allFields, changedFields, snapshotFields } = useMemo(() => {
    if (!item) return { allFields: [], changedFields: [], snapshotFields: [] };
    const before = (item.beforeData ?? {}) as Record<string, unknown>;
    const after = (item.afterData ?? {}) as Record<string, unknown>;
    const changes = (item.updatedData?.changes ?? {}) as Record<string, unknown>;
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    ).sort();
    const diff: Row[] = keys.map((k) => ({
      fieldName: humanFieldName(k),
      before: before[k],
      after: after[k],
      changed: k in changes,
    }));
    // The single source of values for created/deleted entries — backends differ
    // on whether the snapshot lands in beforeData or afterData, so pick whichever
    // is populated. If both happen to be present (mixed convention), prefer after.
    const snapshotSource =
      Object.keys(after).length > 0 ? after : before;
    const snapshotKeys = Object.keys(snapshotSource).sort();
    const snapshot: SingleRow[] = snapshotKeys.map((k) => ({
      fieldName: humanFieldName(k),
      value: snapshotSource[k],
    }));
    return {
      allFields: diff,
      changedFields: diff.filter((r) => r.changed),
      snapshotFields: snapshot,
    };
  }, [item]);

  const diffColumns: TableColumnsType<Row> = [
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

  const snapshotColumns: TableColumnsType<SingleRow> = [
    { title: "Field", dataIndex: "fieldName", width: "33%" },
    {
      title: mode === "created" ? "New value" : "Final value",
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

  const tagColor =
    mode === "created" ? "success" : mode === "deleted" ? "error" : "default";

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="Audit log details"
      width={1100}
      footer={[
        <Button key="close" onClick={() => onOpenChange(false)}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      {item && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Tag color={tagColor}>{item.action}</Tag>
            <span className="text-sm text-muted-foreground">
              by {item.adminEmail} on{" "}
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>

          {mode === "updated" ? (
            <>
              {changedFields.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    Summary of changes ({changedFields.length})
                  </h4>
                  <Table<Row>
                    rowKey="fieldName"
                    dataSource={changedFields}
                    columns={diffColumns}
                    pagination={false}
                    size="small"
                  />
                </div>
              )}
              <div>
                <h4 className="mb-2 text-sm font-medium">Full before / after</h4>
                <Table<Row>
                  rowKey="fieldName"
                  dataSource={allFields}
                  columns={diffColumns}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: "No data recorded." }}
                />
              </div>
            </>
          ) : (
            <div>
              <h4 className="mb-2 text-sm font-medium">
                {mode === "created"
                  ? "New record values"
                  : "Record state at deletion"}
              </h4>
              <Table<SingleRow>
                rowKey="fieldName"
                dataSource={snapshotFields}
                columns={snapshotColumns}
                pagination={false}
                size="small"
                locale={{ emptyText: "No data recorded." }}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
