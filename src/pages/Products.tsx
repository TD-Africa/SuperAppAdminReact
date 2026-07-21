import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Space,
  Tag,
  Switch,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  SyncOutlined,
  FontSizeOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch, apiPut, apiPost, API_BASE_URL, API_ORIGIN } from "@/lib/api";
import type { PaginationResponse, ProductReturnDto } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

const ALL = "__all__";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [isFeatured, setIsFeatured] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [inventorySyncing, setInventorySyncing] = useState(false);
  const [pricesSyncing, setPricesSyncing] = useState(false);
  const [namesSyncing, setNamesSyncing] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    if (isFeatured !== ALL) params.set("isFeaturedProduct", isFeatured);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive, isFeatured]);

  const queryKey = ["products", queryParams.toString()];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<ProductReturnDto>>(
        `product/getProducts?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load products");
      return res.data;
    },
  });

  async function toggleField(
    id: string,
    field: "IsActive" | "IsFeaturedProduct",
    value: boolean,
  ) {
    const prev = queryClient.getQueryData<PaginationResponse<ProductReturnDto>>(queryKey);
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<ProductReturnDto>>(queryKey, {
        ...prev,
        data: prev.data.map((p) =>
          p.id === id
            ? {
                ...p,
                isActive: field === "IsActive" ? value : p.isActive,
                isFeaturedProduct:
                  field === "IsFeaturedProduct" ? value : p.isFeaturedProduct,
              }
            : p,
        ),
      });
    }
    const res = await apiPatch<boolean>(`product/editProduct/${id}`, {
      [field]: value,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? "Updated");
    }
  }

  async function syncPrice(id: string) {
    const res = await apiPut<boolean>(`product/SyncProductPrice/${id}`);
    if (res.status) {
      message.success(res.message ?? "Price synced");
      refetch();
    } else {
      message.error(res.message ?? "Sync failed");
    }
  }

  async function syncAllPrices() {
    setPricesSyncing(true);
    const hide = message.loading("Syncing all product prices…", 0);
    try {
      const res = await apiPut<boolean>(
        "Product/SyncAllProductPrices/sync-all-prices",
      );
      if (res.status) {
        message.success(res.message ?? "All prices synced");
        refetch();
      } else {
        message.error(res.message ?? "Price sync failed");
      }
    } finally {
      hide();
      setPricesSyncing(false);
    }
  }

  async function syncName(id: string) {
    const res = await apiPut<boolean>(`Product/SyncProductName/${id}/sync-name`);
    if (res.status) {
      message.success(res.message ?? "Name synced");
      refetch();
    } else {
      message.error(res.message ?? "Sync failed");
    }
  }

  async function syncAllNames() {
    setNamesSyncing(true);
    const hide = message.loading("Syncing all product names…", 0);
    try {
      const res = await apiPut<boolean>(
        "Product/SyncAllProductNames/sync-all-names",
      );
      if (res.status) {
        message.success(res.message ?? "All names synced");
        refetch();
      } else {
        message.error(res.message ?? "Name sync failed");
      }
    } finally {
      hide();
      setNamesSyncing(false);
    }
  }

  async function syncAllImages() {
    const hide = message.loading("Syncing all product images…", 0);
    const res = await apiPost<boolean>("Product/SyncAllProductImages/sync-all-images", null);
    hide();
    if (!res.status) {
      message.error(res.message ?? "Sync failed");
    } else {
      message.success(res.message ?? "Sync started");
      refetch();
    }
  }

  async function runInventorySync() {
    setInventorySyncing(true);
    const hide = message.loading("Running inventory sync…", 0);
    try {
      const res = await apiPost<unknown>(
        `${API_ORIGIN}/api/jobs/run-inventory-sync`,
        null,
      );
      if (res.status) {
        message.success(res.message ?? "Inventory sync started");
        refetch();
      } else {
        message.error(res.message ?? "Inventory sync failed");
      }
    } finally {
      hide();
      setInventorySyncing(false);
    }
  }

  function downloadAll() {
    window.open(`${API_BASE_URL}Product/DownloadAllProducts`, "_blank");
  }

  function downloadFiltered() {
    window.open(
      `${API_BASE_URL}Product/DownloadAllProducts?${queryParams.toString()}`,
      "_blank",
    );
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<ProductReturnDto> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v, r) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium">{v}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.category ?? "—"}
          </div>
        </div>
      ),
    },
    { title: "Brand", dataIndex: ["brand", "name"], render: (v) => v ?? "—" },
    { title: "Qty", dataIndex: "quantity", align: "right", render: (v) => formatNumber(v) },
    {
      title: "Price (NGN)",
      dataIndex: "priceInNaira",
      align: "right",
      render: (v) => formatCurrency(v, "NGN"),
    },
    {
      title: "Price (USD)",
      dataIndex: "priceInDollar",
      align: "right",
      render: (v) => formatCurrency(v, "USD"),
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    {
      title: "Visible",
      dataIndex: "isVisible",
      render: (v: boolean) => <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>,
    },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleField(r.id, "IsActive", val)} />
      ),
    },
    {
      title: "Featured",
      dataIndex: "isFeaturedProduct",
      render: (v: boolean, r) => (
        <Switch checked={v} disabled={!canEdit} onChange={(val) => toggleField(r.id, "IsFeaturedProduct", val)} />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 140,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} />
          {canEdit && (
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => syncPrice(r.id)}
              title="Sync price"
            />
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<FontSizeOutlined />}
              onClick={() => syncName(r.id)}
              title="Sync name"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Products
        </Typography.Title>
        <Typography.Text type="secondary">
          Browse, search, and manage the product catalog.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search products by name, SKU, Dynamics ID…"
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
          <Select
            className="md:col-span-3"
            value={isFeatured}
            onChange={(v) => {
              setPage(1);
              setIsFeatured(v);
            }}
            options={[
              { value: ALL, label: "All products" },
              { value: "true", label: "Featured only" },
              { value: "false", label: "Not featured" },
            ]}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {isFetching && !isLoading ? "Refreshing…" : null}
        </span>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={downloadFiltered}>
            Download (filtered)
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadAll}>
            Download all
          </Button>
          {canEdit && (
            <Button type="default" icon={<SyncOutlined />} onClick={syncAllImages}>
              Sync all images
            </Button>
          )}
          {canEdit && (
            <Button
              type="default"
              icon={<SyncOutlined spin={pricesSyncing} />}
              loading={pricesSyncing}
              onClick={syncAllPrices}
            >
              Sync all prices
            </Button>
          )}
          {canEdit && (
            <Button
              type="default"
              icon={<SyncOutlined spin={namesSyncing} />}
              loading={namesSyncing}
              onClick={syncAllNames}
            >
              Sync all names
            </Button>
          )}
          {canEdit && (
            <Button
              type="primary"
              icon={<SyncOutlined spin={inventorySyncing} />}
              loading={inventorySyncing}
              onClick={runInventorySync}
            >
              Run inventory sync
            </Button>
          )}
        </Space>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ProductReturnDto>
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: "No products match the current filters." }}
        />
      </Card>

      <ProductDetailModal
        productId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
      />
    </div>
  );
}
