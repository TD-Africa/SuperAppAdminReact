import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Input, Typography, Table, Rate } from "antd";
import type { TableColumnsType } from "antd";
import { apiGet } from "@/lib/api";
import type { PaginationResponse, RatingResponseWithUser } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function RatingsPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ratings", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RatingResponseWithUser>>(
        `Component/GetRatings?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load ratings");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<RatingResponseWithUser> = [
    {
      title: "Score",
      dataIndex: "score",
      width: 180,
      render: (v: number) => (
        <div className="flex items-center gap-2">
          <Rate disabled allowHalf value={v} style={{ fontSize: 14 }} />
          <span className="text-xs font-medium">{v.toFixed(1)}</span>
        </div>
      ),
    },
    {
      title: "Comment",
      dataIndex: "comment",
      render: (v) =>
        v ? (
          <p className="whitespace-pre-wrap text-sm">{v}</p>
        ) : (
          <span className="text-muted-foreground">No comment</span>
        ),
    },
    {
      title: "Customer",
      dataIndex: "companyName",
      width: 240,
      render: (v) => v ?? "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Ratings
        </Typography.Title>
        <Typography.Text type="secondary">
          Customer ratings and comments across the platform.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          placeholder="Search by comment or company…"
          value={keyword}
          allowClear
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<RatingResponseWithUser>
          rowKey="id"
          dataSource={rows}
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
          locale={{ emptyText: "No ratings yet." }}
        />
      </Card>
    </div>
  );
}
