import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Tag,
  Typography,
  Table,
  Button,
  Space,
  Tooltip,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EyeOutlined,
  DownloadOutlined,
  FileZipOutlined,
} from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import {
  downloadAllCacRegistrations,
  downloadCacDocuments,
  downloadCacRegistration,
  downloadSelectedCacRegistrations,
} from "@/lib/cacExports";
import type { CacRegistrationResponse } from "@/lib/types";
import {
  CAC_TYPE_COLOR,
  CAC_TYPE_LABEL,
  CAC_TYPE_SHORT_LABEL,
  cacRegistrationType,
} from "@/lib/cacRegistrationType";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { CacDataDetailModal } from "@/components/cac/CacDataDetailModal";

const ALL = "__all__";

type ExportKind = "all" | "selected" | "documents";

export default function CacDataPage() {
  const { message } = AntdApp.useApp();
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 250);
  const [regType, setRegType] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportingRowId, setExportingRowId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["cac-registrations"],
    queryFn: async () => {
      const res = await apiGet<CacRegistrationResponse[]>(
        "CacRegistration/GetAllCacRegistrations",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load CAC data");
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = debouncedKeyword.trim().toLowerCase();
    return list.filter((r) => {
      if (regType !== ALL && cacRegistrationType(r) !== regType) return false;
      if (!q) return true;
      return [r.firstPreferredBusinessName, r.secondPreferredBusinessName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [data, debouncedKeyword, regType]);

  const totalItems = filtered.length;
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  // Selection is kept across pages and filter changes (preserveSelectedRowKeys),
  // so exporting a selection is not limited to what is currently on screen.
  async function runExport(kind: ExportKind) {
    setExporting(kind);
    try {
      const err =
        kind === "all"
          ? await downloadAllCacRegistrations()
          : kind === "selected"
            ? await downloadSelectedCacRegistrations(selectedRowKeys)
            : await downloadCacDocuments(selectedRowKeys);
      if (err) message.error(err);
      else message.success("Download started.");
    } finally {
      setExporting(null);
    }
  }

  async function exportRow(cacId: string) {
    setExportingRowId(cacId);
    try {
      const err = await downloadCacRegistration(cacId);
      if (err) message.error(err);
      else message.success("Download started.");
    } finally {
      setExportingRowId(null);
    }
  }

  // One export at a time, whichever button started it.
  const busy = exporting !== null || exportingRowId !== null;

  const columns: TableColumnsType<CacRegistrationResponse> = [
    {
      title: "First preferred business name",
      dataIndex: "firstPreferredBusinessName",
      render: (v) => <span className="font-medium">{v ?? "—"}</span>,
    },
    { title: "Second preferred", dataIndex: "secondPreferredBusinessName", render: (v) => v ?? "—" },
    {
      title: "Type",
      key: "type",
      render: (_, r) => {
        const t = cacRegistrationType(r);
        return (
          <Tag color={CAC_TYPE_COLOR[t]} title={CAC_TYPE_LABEL[t]}>
            {CAC_TYPE_SHORT_LABEL[t]}
          </Tag>
        );
      },
    },
    {
      title: "Submitted",
      dataIndex: "dateCreated",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    // Directors and secretaries belong to the LLC flow only — a business name
    // carries a proprietor instead, so a zero there would be misleading.
    {
      title: "Directors",
      key: "directors",
      align: "right",
      render: (_, r) =>
        cacRegistrationType(r) === "llc" ? (r.directors?.length ?? 0) : "—",
    },
    {
      title: "Secretaries",
      key: "secretaries",
      align: "right",
      render: (_, r) =>
        cacRegistrationType(r) === "llc" ? (r.secretaries?.length ?? 0) : "—",
    },
    {
      title: "",
      key: "actions",
      width: 96,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedId(r.id);
                setDetailOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Export this registration">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={exportingRowId === r.id}
              disabled={busy && exportingRowId !== r.id}
              onClick={() => exportRow(r.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            CAC Data
          </Typography.Title>
          <Typography.Text type="secondary">
            Corporate Affairs Commission registrations submitted during onboarding.
          </Typography.Text>
        </div>
        <Button
          icon={<DownloadOutlined />}
          loading={exporting === "all"}
          disabled={busy}
          onClick={() => runExport("all")}
        >
          Export all
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            className="md:flex-1"
            placeholder="Search by preferred business name…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:w-64"
            value={regType}
            onChange={(v) => {
              setPage(1);
              setRegType(v);
            }}
            options={[
              { value: ALL, label: "All registration types" },
              { value: "businessName", label: CAC_TYPE_LABEL.businessName },
              { value: "llc", label: CAC_TYPE_LABEL.llc },
            ]}
          />
        </div>
      </Card>

      {selectedRowKeys.length > 0 && (
        <Card styles={{ body: { padding: 12 } }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Typography.Text>
              {selectedRowKeys.length} registration
              {selectedRowKeys.length === 1 ? "" : "s"} selected
            </Typography.Text>
            <Space wrap>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                Clear
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={exporting === "selected"}
                disabled={busy}
                onClick={() => runExport("selected")}
              >
                Export selected
              </Button>
              <Button
                size="small"
                icon={<FileZipOutlined />}
                loading={exporting === "documents"}
                disabled={busy}
                onClick={() => runExport("documents")}
              >
                Download documents
              </Button>
            </Space>
          </div>
        </Card>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CacRegistrationResponse>
          rowKey="id"
          dataSource={paginated}
          columns={columns}
          loading={isLoading || isFetching}
          rowSelection={{
            selectedRowKeys,
            preserveSelectedRowKeys: true,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
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
          locale={{ emptyText: "No CAC records match the current filters." }}
        />
      </Card>

      <CacDataDetailModal
        cacId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
      />
    </div>
  );
}
