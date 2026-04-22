import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Switch,
  Typography,
  Avatar,
  App as AntdApp,
  Table,
} from "antd";
import type { TableColumnsType } from "antd";
import { ShopOutlined } from "@ant-design/icons";
import { apiGet, apiPatch } from "@/lib/api";
import type { BrandReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive]);

  const queryKey = ["brands", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<BrandReturnDTO>>(
        `brand/getAllBrands?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load brands");
      return res.data;
    },
  });

  async function toggleActive(id: string, value: boolean) {
    const prev =
      queryClient.getQueryData<PaginationResponse<BrandReturnDTO>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<BrandReturnDTO>>(queryKey, {
        ...prev,
        data: prev.data.map((b) => (b.id === id ? { ...b, isActive: value } : b)),
      });
    }
    const res = await apiPatch<boolean>(`brand/updateBrand/${id}`, {
      IsApproved: value,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? "Brand updated");
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<BrandReturnDTO> = [
    {
      title: "",
      dataIndex: "brandImageUrl",
      width: 64,
      render: (v: string | null) => (
        <Avatar src={v ?? undefined} icon={!v ? <ShopOutlined /> : undefined} shape="square" />
      ),
    },
    { title: "Brand", dataIndex: "name", render: (v) => <span className="font-medium">{v}</span> },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 100,
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleActive(r.id, val)} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Brands
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage brand catalog and approval state.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search brands by name or Dynamics ID…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={isActive}
            onChange={(v) => {
              setPage(1);
              setIsActive(v);
            }}
            options={[
              { value: ALL, label: "All statuses" },
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<BrandReturnDTO>
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
        />
      </Card>
    </div>
  );
}
