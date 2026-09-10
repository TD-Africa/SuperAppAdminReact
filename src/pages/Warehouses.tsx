import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Switch,
  Typography,
  App as AntdApp,
  Table,
} from "antd";
import type { TableColumnsType } from "antd";
import { apiGet, apiPatch } from "@/lib/api";
import type { LocationReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEditWarehouses = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditWarehouses),
  );

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

  const queryKey = ["warehouses", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<LocationReturnDTO>>(
        `Location/GetAllLocations?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load warehouses");
      return res.data;
    },
  });

  async function toggleActive(id: string, value: boolean) {
    const prev =
      queryClient.getQueryData<PaginationResponse<LocationReturnDTO>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<LocationReturnDTO>>(queryKey, {
        ...prev,
        data: prev.data.map((w) =>
          w.id === id ? { ...w, isActive: value } : w,
        ),
      });
    }
    const res = await apiPatch<boolean>(`Location/UpdateLocation/${id}`, {
      IsApproved: value,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? "Warehouse updated");
    }
  }

  // NOTE: the per-warehouse "sync products" action is gone.
  // Product/SyncProductDetails/{locationId} is [Obsolete(error: true)] on the
  // backend and throws NotSupportedException (an unhandled 500). It is obsolete
  // by design: InventoryStockUpdateBackgroundService now walks every location
  // hourly, so there is no longer a single warehouse to sync in isolation.
  // Products → "Run inventory sync" triggers that all-warehouse pass on demand.

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<LocationReturnDTO> = [
    { title: "Name", dataIndex: "name", render: (v) => <span className="font-medium">{v}</span> },
    {
      title: "Address",
      dataIndex: "address",
      render: (v) => (
        <span className="block max-w-[320px] truncate text-muted-foreground">{v ?? "—"}</span>
      ),
    },
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
        <Switch checked={v} disabled={!canEditWarehouses} onChange={(val) => toggleActive(r.id, val)} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Warehouses
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage warehouse locations. Product stock is pulled from every active
          warehouse automatically each hour — no per-warehouse sync needed.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search warehouses by name or Dynamics ID…"
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
        <Table<LocationReturnDTO>
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
