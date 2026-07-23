import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Table, Tag, Empty, Switch, Space, Button, Select } from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { PaginationResponse, ProductReturnDto } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

const ALL = "__all__";

// The catalog sometimes serializes a product's own price as 0 while the real
// price lives on a variant. Fall back to the default variant's price, or the
// first variant that carries a non-zero price.
function effectivePrice(
  p: ProductReturnDto,
  currency: "naira" | "dollar",
): number {
  const pick = (v: { priceInNaira: number; priceInDollar: number }) =>
    currency === "naira" ? v.priceInNaira : v.priceInDollar;
  const base = pick(p);
  if (base > 0) return base;
  const variants = p.variants ?? [];
  const fromDefault = variants.find((v) => v.isDefault && pick(v) > 0);
  if (fromDefault) return pick(fromDefault);
  const fromAny = variants.find((v) => pick(v) > 0);
  return fromAny ? pick(fromAny) : base;
}

// `category` occasionally comes back as the raw C# type name
// ("TDSuperApp.Data.Models.Category") instead of a real category. Hide those.
function cleanCategory(category: string | null): string {
  if (!category || category.startsWith("TDSuperApp.")) return "—";
  return category;
}

interface Props {
  brandId: string | null;
  brandName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandProductsModal({
  brandId,
  brandName,
  open,
  onOpenChange,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [isVisible, setIsVisible] = useState<string>(ALL);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Reset pagination and filters whenever a different brand is opened so we
  // don't inherit the previous brand's page (which may not exist here).
  useEffect(() => {
    setPage(1);
    setIsActive(ALL);
    setIsVisible(ALL);
  }, [brandId]);

  // There is no dedicated brand-products endpoint on the backend yet, so we
  // reuse the product list searched by brand name and scope/filter/paginate on
  // the client. The search is fuzzy (also matches product name / Dynamics ID),
  // so we narrow to an exact brand match below. Keyed on brandId for caching.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["brand-products", brandId],
    queryFn: async () => {
      const params = new URLSearchParams({
        PageNumber: "1",
        PageSize: "10000",
        SearchString: brandName ?? "",
      });
      const res = await apiGet<PaginationResponse<ProductReturnDto>>(
        `product/getProducts?${params.toString()}`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load brand products");
      return res.data;
    },
    enabled: open && !!brandId && !!brandName,
  });

  // Narrow the fuzzy search down to products that actually belong to this brand.
  const brandProducts = useMemo(() => {
    const target = brandName?.trim().toLowerCase();
    return (data?.data ?? []).filter(
      (p) => p.brand?.name?.trim().toLowerCase() === target,
    );
  }, [data, brandName]);

  const filtered = useMemo(() => {
    return brandProducts.filter((p) => {
      if (isActive !== ALL && p.isActive !== (isActive === "true")) return false;
      if (isVisible !== ALL && p.isVisible !== (isVisible === "true"))
        return false;
      return true;
    });
  }, [brandProducts, isActive, isVisible]);

  const totalItems = filtered.length;
  const rows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  const columns: TableColumnsType<ProductReturnDto> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v, r) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium">{v}</div>
          <div className="truncate text-xs text-muted-foreground">
            {cleanCategory(r.category)}
          </div>
        </div>
      ),
    },
    {
      title: "Item ID",
      dataIndex: "dynamicsId",
      width: 120,
      render: (v: string | null) => (
        <span className="text-xs text-muted-foreground">{v ?? "—"}</span>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      align: "right",
      render: (v) => formatNumber(v),
    },
    {
      title: "Price (NGN)",
      key: "priceInNaira",
      align: "right",
      render: (_, r) => formatCurrency(effectivePrice(r, "naira"), "NGN"),
    },
    {
      title: "Price (USD)",
      key: "priceInDollar",
      align: "right",
      render: (_, r) => formatCurrency(effectivePrice(r, "dollar"), "USD"),
    },
    {
      title: "Visible",
      dataIndex: "isVisible",
      render: (v: boolean) => (
        <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v: boolean) => <Switch checked={v} disabled />,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(r.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title={brandName ? `Products — ${brandName}` : "Brand Products"}
        width={1000}
        footer={null}
        destroyOnClose
      >
        <div className="mb-3 flex flex-wrap gap-3">
          <Select
            className="w-40"
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
            className="w-40"
            value={isVisible}
            onChange={(v) => {
              setPage(1);
              setIsVisible(v);
            }}
            options={[
              { value: ALL, label: "All visibility" },
              { value: "true", label: "Visible" },
              { value: "false", label: "Hidden" },
            ]}
          />
        </div>
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
            pageSizeOptions: [10, 25, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          size="middle"
          scroll={{ x: 900 }}
          locale={{
            emptyText: <Empty description="No products for this brand." />,
          }}
        />
      </Modal>

      <ProductDetailModal
        productId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
      />
    </>
  );
}
