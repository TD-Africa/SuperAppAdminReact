import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Input, Select, Tag, Typography, Table, Button } from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
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

export default function CacDataPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 250);
  const [regType, setRegType] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
      width: 60,
      align: "right",
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedId(r.id);
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
          CAC Data
        </Typography.Title>
        <Typography.Text type="secondary">
          Corporate Affairs Commission registrations submitted during onboarding.
        </Typography.Text>
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

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CacRegistrationResponse>
          rowKey="id"
          dataSource={paginated}
          columns={columns}
          loading={isLoading || isFetching}
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
