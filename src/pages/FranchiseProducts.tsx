import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { AppstoreOutlined, SearchOutlined } from "@ant-design/icons";
import { getStorefrontBrands } from "@/lib/storefrontApi";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import {
  StorefrontBrandProductsPanel,
  type AvailabilityFilter,
  type PublishedFilter,
  type StockFilter,
  type StorefrontProductFilters,
} from "@/components/storefront/StorefrontBrandProductsPanel";

type BrandStatusFilter = "all" | "active" | "inactive";

export default function FranchiseProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));
  const canEditBrands = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const brandIdFromUrl = searchParams.get("brandId") ?? "";
  const openFromUrl = searchParams.get("open");

  const openBrandIds = useMemo(() => {
    if (openFromUrl) return openFromUrl.split(",").filter(Boolean);
    return brandIdFromUrl ? [brandIdFromUrl] : [];
  }, [openFromUrl, brandIdFromUrl]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [brandStatus, setBrandStatus] = useState<BrandStatusFilter>("all");
  const [published, setPublished] = useState<PublishedFilter>("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const brandsQuery = useQuery({
    queryKey: ["storefront", "manage-brands"],
    queryFn: async () => {
      const res = await getStorefrontBrands({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
      return res.data?.data ?? [];
    },
  });

  const productFilters: StorefrontProductFilters = useMemo(
    () => ({ search: debouncedSearch, published, availability, stock }),
    [debouncedSearch, published, availability, stock],
  );

  const visibleBrands = useMemo(
    () =>
      (brandsQuery.data ?? []).filter((brand) => {
        if (brandFilter.length > 0 && !brandFilter.includes(brand.id)) return false;
        if (brandStatus === "active" && !brand.isActive) return false;
        if (brandStatus === "inactive" && brand.isActive) return false;
        return true;
      }),
    [brandsQuery.data, brandFilter, brandStatus],
  );

  const activeFilterCount =
    (search.trim() ? 1 : 0)
    + (brandFilter.length > 0 ? 1 : 0)
    + (brandStatus !== "all" ? 1 : 0)
    + (published !== "all" ? 1 : 0)
    + (availability !== "all" ? 1 : 0)
    + (stock !== "all" ? 1 : 0);

  function clearFilters() {
    setSearch("");
    setBrandFilter([]);
    setBrandStatus("all");
    setPublished("all");
    setAvailability("all");
    setStock("all");
  }

  function setOpenBrands(ids: string[]) {
    const next = new URLSearchParams(searchParams);
    next.delete("brandId");
    next.delete("brand");
    if (ids.length > 0) next.set("open", ids.join(","));
    else next.delete("open");
    setSearchParams(next, { replace: true });
  }

  const brandOptions = useMemo(() => {
    return (brandsQuery.data ?? [])
      .map((b) => ({
        value: b.id,
        label: b.isActive ? b.name : `${b.name} (inactive)`,
      }));
  }, [brandsQuery.data]);

  function openAddBrandPage() {
    navigate("/franchise-products/add-brand");
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography.Title level={3} className="!m-0">
              Manage storefront products
            </Typography.Title>
            <Typography.Text type="secondary">
              Add a storefront brand, remove products from that brand, and review the categories that remain available.
            </Typography.Text>
          </div>
          <Button type="primary" disabled={!canEditBrands} icon={<AppstoreOutlined />} onClick={openAddBrandPage}>
            Add brand
          </Button>
        </div>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Input
              allowClear
              className="min-w-[260px] flex-1"
              placeholder="Search products in open brands by name, slug or Dynamics ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined className="text-muted-foreground" />}
            />
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              className="min-w-[260px] flex-1"
              placeholder="All brands"
              loading={brandsQuery.isLoading}
              options={brandOptions}
              value={brandFilter}
              onChange={setBrandFilter}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<BrandStatusFilter>
              value={brandStatus}
              onChange={setBrandStatus}
              options={[
                { label: "All brands", value: "all" },
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ]}
            />
            <Select<PublishedFilter>
              className="w-[160px]"
              value={published}
              onChange={setPublished}
              options={[
                { label: "Any publish state", value: "all" },
                { label: "Published", value: "published" },
                { label: "Unpublished", value: "unpublished" },
              ]}
            />
            <Select<AvailabilityFilter>
              className="w-[160px]"
              value={availability}
              onChange={setAvailability}
              options={[
                { label: "Any availability", value: "all" },
                { label: "Included", value: "included" },
                { label: "Excluded", value: "excluded" },
              ]}
            />
            <Select<StockFilter>
              className="w-[140px]"
              value={stock}
              onChange={setStock}
              options={[
                { label: "Any stock", value: "all" },
                { label: "In stock", value: "in" },
                { label: "Out of stock", value: "out" },
              ]}
            />
            <div className="ml-auto flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button type="link" onClick={clearFilters}>
                  Clear filters ({activeFilterCount})
                </Button>
              )}
              <Button
                size="small"
                disabled={visibleBrands.length === 0}
                onClick={() => setOpenBrands(visibleBrands.map((b) => b.id))}
              >
                Expand all
              </Button>
              <Button
                size="small"
                disabled={openBrandIds.length === 0}
                onClick={() => setOpenBrands([])}
              >
                Collapse all
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {brandsQuery.isLoading ? (
        <Card loading />
      ) : (brandsQuery.data ?? []).length === 0 ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No storefront brands yet">
            <Button type="primary" disabled={!canEditBrands} onClick={openAddBrandPage}>
              Add storefront brand
            </Button>
          </Empty>
        </Card>
      ) : visibleBrands.length === 0 ? (
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No brands match the filters">
            <Button onClick={clearFilters}>Clear filters</Button>
          </Empty>
        </Card>
      ) : (
        <Collapse
          activeKey={openBrandIds}
          onChange={(keys) => setOpenBrands(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
          className="bg-white"
          items={visibleBrands.map((brand) => ({
            key: brand.id,
            label: (
              <div className="flex flex-wrap items-center gap-3">
                <Avatar
                  shape="square"
                  src={brand.brandImageUrl || undefined}
                  icon={!brand.brandImageUrl ? <AppstoreOutlined /> : undefined}
                />
                <div className="min-w-0">
                  <div className="font-medium">{brand.name}</div>
                  {brand.dynamicsId && (
                    <div className="text-xs text-muted-foreground">{brand.dynamicsId}</div>
                  )}
                </div>
              </div>
            ),
            extra: (
              <Space size={8}>
                <Tag>{brand.storefrontPriceMargin.toFixed(2)}% margin</Tag>
                <Tag color={brand.isActive ? "success" : "default"}>
                  {brand.isActive ? "Active" : "Inactive"}
                </Tag>
              </Space>
            ),
            children: (
              <StorefrontBrandProductsPanel
                brand={brand}
                filters={productFilters}
                canEdit={canEdit}
                onOpenDetail={openDetail}
              />
            ),
          }))}
        />
      )}

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
