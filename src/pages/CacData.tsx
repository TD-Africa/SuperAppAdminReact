import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Input, Typography, Table, Button } from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { CacRegistrationResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { CacDataDetailModal } from "@/components/cac/CacDataDetailModal";

export default function CacDataPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 250);
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
    if (!q) return list;
    return list.filter((r) =>
      [r.firstPreferredBusinessName, r.secondPreferredBusinessName, r.businessDescription]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [data, debouncedKeyword]);

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
      title: "Business description",
      dataIndex: "businessDescription",
      render: (v) => (
        <span className="block max-w-[320px] truncate text-muted-foreground">{v ?? "—"}</span>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "dateCreated",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    {
      title: "Directors",
      dataIndex: "directors",
      align: "right",
      render: (v: unknown[]) => v?.length ?? 0,
    },
    {
      title: "Secretaries",
      dataIndex: "secretaries",
      align: "right",
      render: (v: unknown[]) => v?.length ?? 0,
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
        <Input
          placeholder="Search by business name or description…"
          value={keyword}
          allowClear
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
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
