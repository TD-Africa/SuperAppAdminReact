import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  AppstoreOutlined,
  EyeOutlined,
  FontSizeOutlined,
  PercentageOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch, apiPut } from "@/lib/api";
import {
  getActiveStorefrontBrands,
  getStorefrontBrandProductsForAdmin,
  setProductVisibility,
} from "@/lib/storefrontApi";
import { effectiveProductPrice, productThumbnail } from "@/lib/productHelpers";
import {
  aggregateStorefrontAvailability,
  effectiveStorefrontBasePrice,
  formatStorefrontNaira,
  pickDisplayVariant,
  storefrontMarkupPercent,
  type StorefrontProductDto,
} from "@/lib/storefrontTypes";
import type { ProductReturnDto } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

const ALL = "__all__";

interface FranchiseProductRow {
  storefront: StorefrontProductDto;
  catalog: ProductReturnDto | null;
}

export default function FranchiseProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));

  const brandIdFromUrl = searchParams.get("brandId") ?? "";
  const brandNameFromUrl = searchParams.get("brand") ?? "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [brandId, setBrandId] = useState(brandIdFromUrl || ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);


  useEffect(() => {
    if (brandIdFromUrl) setBrandId(brandIdFromUrl);
  }, [brandIdFromUrl]);

  const brandsQuery = useQuery({
    queryKey: ["storefront", "brands"],
    queryFn: async () => {
      const res = await getActiveStorefrontBrands();
      if (!res.status) throw new Error(res.message ?? "Failed to load brands");
      return res.data ?? [];
    },
  });

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      storefrontBrandId: brandId !== ALL ? brandId : undefined,
    }),
    [pageSize, page, debouncedSearch, brandId],
  );

  const productsQuery = useQuery({
    queryKey: ["storefront", "products", queryParams],
    queryFn: async () => {
      const configuredBrands = brandsQuery.data ?? [];
      const search = queryParams.SearchString;

      // The global admin catalog is the union of explicitly configured
      // storefront brands. It must not be inferred from store-owner catalogs:
      // an owner is assigned brands, not individual products.
      if (brandId !== ALL) {
        const res = await getStorefrontBrandProductsForAdmin(brandId, {
          PageSize: queryParams.PageSize,
          PageNumber: queryParams.PageNumber,
          SearchString: search,
        });
        if (!res.status) throw new Error(res.message ?? "Failed to load storefront products");
        return res.data;
      }

      const productsByBrand = await Promise.all(
        configuredBrands.map(async (brand) => {
          const products: StorefrontProductDto[] = [];
          let productPage = 1;
          let productCount = Number.POSITIVE_INFINITY;
          const pageSize = 100;

          while (products.length < productCount) {
            const res = await getStorefrontBrandProductsForAdmin(brand.id, {
              PageSize: pageSize,
              PageNumber: productPage,
              SearchString: search,
            });
            if (!res.status) {
              throw new Error(res.message ?? `Failed to load products for ${brand.name}`);
            }

            const page = res.data?.data ?? [];
            products.push(...page);
            productCount = Number(res.data?.count ?? products.length);
            if (page.length === 0) break;
            productPage += 1;
          }

          return products;
        }),
      );

      const uniqueProducts = new Map<string, StorefrontProductDto>();
      for (const products of productsByBrand) {
        for (const product of products) {
          const existing = uniqueProducts.get(product.productId);
          if (!existing) {
            uniqueProducts.set(product.productId, { ...product });
          } else {
            // A product is included globally if at least one configured brand
            // includes it. `isExcluded` is brand-scoped on the API response.
            existing.isExcluded = Boolean(existing.isExcluded && product.isExcluded);
          }
        }
      }

      const allProducts = [...uniqueProducts.values()].sort((left, right) =>
        left.productName.localeCompare(right.productName),
      );
      const pageSize = queryParams.PageSize ?? 20;
      const pageNumber = queryParams.PageNumber ?? 1;
      const start = (pageNumber - 1) * pageSize;

      return {
        data: allProducts.slice(start, start + pageSize),
        count: allProducts.length,
        pageNumber,
      };
    },
    enabled: brandsQuery.isSuccess,
  });

  const storefrontRows = productsQuery.data?.data ?? [];
  const productIds = useMemo(
    () => storefrontRows.map((p) => p.productId),
    [storefrontRows],
  );

  const catalogQueryKey = ["storefront", "catalog-enrich", productIds] as const;

  const catalogQuery = useQuery({
    queryKey: catalogQueryKey,
    queryFn: async () => {
      const entries = await Promise.all(
        productIds.map(async (id) => {
          const res = await apiGet<ProductReturnDto>(`Product/GetProduct/${id}`);
          if (!res.status || !res.data) return null;
          return [id, res.data] as const;
        }),
      );
      return new Map(entries.filter(Boolean) as [string, ProductReturnDto][]);
    },
    enabled: productIds.length > 0,
  });

  useEffect(() => {
    if (productsQuery.isError) {
      message.error(
        productsQuery.error instanceof Error
          ? productsQuery.error.message
          : "Unable to load storefront products.",
      );
    }
  }, [productsQuery.isError, productsQuery.error, message]);

  const rows: FranchiseProductRow[] = useMemo(
    () =>
      storefrontRows.map((storefront) => ({
        storefront,
        catalog: catalogQuery.data?.get(storefront.productId) ?? null,
      })),
    [storefrontRows, catalogQuery.data],
  );

  const totalItems = Number(productsQuery.data?.count ?? 0);

  const brandOptions = useMemo(() => {
    const options = (brandsQuery.data ?? []).map((b) => ({
      value: b.id,
      label: b.name,
    }));
    return [{ value: ALL, label: "All brands" }, ...options];
  }, [brandsQuery.data]);

  const selectedBrandLabel =
    brandId !== ALL
      ? (brandsQuery.data?.find((b) => b.id === brandId)?.name ?? brandNameFromUrl)
      : null;

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  async function toggleStorefrontVisibility(productId: string, isPublished: boolean) {
    setVisibilityBusyId(productId);
    const prev = queryClient.getQueryData<typeof productsQuery.data>([
      "storefront",
      "products",
      queryParams,
    ]);
    if (prev?.data) {
      queryClient.setQueryData(["storefront", "products", queryParams], {
        ...prev,
        data: prev.data.map((p) =>
          p.productId === productId ? { ...p, isStorefrontPublished: isPublished } : p,
        ),
      });
    }
    try {
      const res = await setProductVisibility({ productId, isPublished });
      if (!res.status) {
        message.error(res.message ?? "Failed to update visibility");
        queryClient.setQueryData(["storefront", "products", queryParams], prev);
        return;
      }
      message.success(res.message ?? "Visibility updated");
      void productsQuery.refetch();
    } finally {
      setVisibilityBusyId(null);
    }
  }

  async function toggleField(
    id: string,
    field: "IsActive" | "IsFeaturedProduct",
    value: boolean,
  ) {
    const prev = queryClient.getQueryData<Map<string, ProductReturnDto>>(catalogQueryKey);
    if (prev?.has(id)) {
      const next = new Map(prev);
      const product = next.get(id)!;
      next.set(id, {
        ...product,
        isActive: field === "IsActive" ? value : product.isActive,
        isFeaturedProduct:
          field === "IsFeaturedProduct" ? value : product.isFeaturedProduct,
      });
      queryClient.setQueryData(catalogQueryKey, next);
    }

    const res = await apiPatch<boolean>(`product/editProduct/${id}`, {
      [field]: value,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(catalogQueryKey, prev);
    } else {
      message.success(res.message ?? "Updated");
    }
  }

  async function syncPrice(id: string) {
    const res = await apiPut<boolean>(`product/SyncProductPrice/${id}`);
    if (res.status) {
      message.success(res.message ?? "Price synced");
      void catalogQuery.refetch();
      void productsQuery.refetch();
    } else {
      message.error(res.message ?? "Sync failed");
    }
  }

  async function syncName(id: string) {
    const res = await apiPut<boolean>(`Product/SyncProductName/${id}/sync-name`);
    if (res.status) {
      message.success(res.message ?? "Name synced");
      void catalogQuery.refetch();
      void productsQuery.refetch();
    } else {
      message.error(res.message ?? "Sync failed");
    }
  }

  const columns: TableColumnsType<FranchiseProductRow> = [
    {
      title: "",
      key: "image",
      width: 64,
      fixed: "left",
      render: (_, { storefront, catalog }) => {
        const src =
          (catalog ? productThumbnail(catalog) : undefined) ??
          storefront.images?.[0] ??
          undefined;
        return (
          <Avatar
            shape="square"
            src={src}
            icon={!src ? <AppstoreOutlined /> : undefined}
          />
        );
      },
    },
    {
      title: "Product",
      key: "product",
      fixed: "left",
      width: 260,
      render: (_, { storefront, catalog }) => (
        <button
          type="button"
          className="max-w-[240px] cursor-pointer border-0 bg-transparent p-0 text-left"
          onClick={() => openDetail(storefront.productId)}
        >
          <div className="truncate font-medium text-[#800020] hover:underline">
            {catalog?.productName ?? storefront.productName}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {storefront.slug ?? catalog?.slug ?? "—"}
          </div>
        </button>
      ),
    },
    {
      title: "Brand",
      key: "brand",
      width: 150,
      render: (_, { storefront, catalog }) =>
        catalog?.brand?.name ?? storefront.brandName ?? "—",
    },
    {
      title: "Qty",
      key: "qty",
      width: 80,
      align: "right",
      render: (_, { storefront, catalog }) => {
        if (catalog) return formatNumber(catalog.quantity);
        const { totalQty } = aggregateStorefrontAvailability(storefront);
        return formatNumber(totalQty);
      },
    },
    {
      title: "Price (NGN)",
      key: "priceNgn",
      width: 130,
      align: "right",
      render: (_, { storefront, catalog }) => {
        if (catalog) return formatCurrency(effectiveProductPrice(catalog, "naira"), "NGN");
        const v = pickDisplayVariant(storefront);
        return v ? formatStorefrontNaira(effectiveStorefrontBasePrice(v)) : "—";
      },
    },
    {
      title: "Price (USD)",
      key: "priceUsd",
      width: 110,
      align: "right",
      render: (_, { catalog }) =>
        catalog ? formatCurrency(effectiveProductPrice(catalog, "dollar"), "USD") : "—",
    },
    {
      title: "Dynamics ID",
      key: "dynamicsId",
      width: 120,
      render: (_, { catalog }) => (
        <span className="text-xs text-muted-foreground">{catalog?.dynamicsId ?? "—"}</span>
      ),
    },
    {
      title: "Storefront price",
      key: "storefrontPrice",
      width: 150,
      align: "right",
      render: (_, { storefront }) => {
        const v = pickDisplayVariant(storefront);
        if (!v || v.storefrontPrice <= 0) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        return (
          <span className="font-semibold text-[#800020]">
            {formatStorefrontNaira(v.storefrontPrice)}
          </span>
        );
      },
    },
    {
      title: "Markup",
      key: "markup",
      width: 90,
      align: "right",
      render: (_, { storefront, catalog }) => {
        const v = pickDisplayVariant(storefront);
        const baseNaira = catalog
          ? effectiveProductPrice(catalog, "naira")
          : effectiveStorefrontBasePrice(v);
        const storefrontNaira = v?.storefrontPrice ?? 0;
        const markup = storefrontMarkupPercent(baseNaira, storefrontNaira);
        return markup === null ? "—" : <span className="font-medium">{markup.toFixed(2)}%</span>;
      },
    },
    {
      title: "Visible",
      key: "visible",
      width: 90,
      render: (_, { catalog }) => (
        <Tag color={catalog?.isVisible ? "blue" : "default"}>
          {catalog ? (catalog.isVisible ? "Yes" : "No") : "—"}
        </Tag>
      ),
    },
    {
      title: "Published",
      key: "published",
      width: 110,
      render: (_, { storefront }) => (
        <span onClick={(event) => event.stopPropagation()}>
          <Switch
            checked={storefront.isStorefrontPublished}
            disabled={!canEdit}
            loading={visibilityBusyId === storefront.productId}
            onChange={(val) => void toggleStorefrontVisibility(storefront.productId, val)}
          />
        </span>
      ),
    },
    {
      title: "Availability",
      key: "availability",
      width: 120,
      render: (_, { storefront }) => (
        <Tag color={storefront.isExcluded ? "error" : "success"}>
          {storefront.isExcluded ? "Excluded" : "Included"}
        </Tag>
      ),
    },
    {
      title: "Active",
      key: "active",
      width: 80,
      render: (_, { storefront, catalog }) => {
        if (!catalog) return "—";
        return (
          <span onClick={(event) => event.stopPropagation()}>
            <Switch
              checked={catalog.isActive}
              disabled={!canEdit}
              onChange={(val) => toggleField(storefront.productId, "IsActive", val)}
            />
          </span>
        );
      },
    },
    {
      title: "Featured",
      key: "featured",
      width: 90,
      render: (_, { storefront, catalog }) => {
        if (!catalog) return "—";
        return (
          <span onClick={(event) => event.stopPropagation()}>
            <Switch
              checked={catalog.isFeaturedProduct}
              disabled={!canEdit}
              onChange={(val) =>
                toggleField(storefront.productId, "IsFeaturedProduct", val)
              }
            />
          </span>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 160,
      fixed: "right",
      align: "right",
      render: (_, { storefront }) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              openDetail(storefront.productId);
            }}
            title="View product"
          />
          {canEdit && (
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void syncPrice(storefront.productId);
              }}
              title="Sync price"
            />
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<FontSizeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void syncName(storefront.productId);
              }}
              title="Sync name"
            />
          )}
        </Space>
      ),
    },
  ];

  const tableLoading =
    productsQuery.isLoading ||
    productsQuery.isFetching ||
    (productIds.length > 0 && catalogQuery.isLoading);

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
            Manage storefront products
        </Typography.Title>
        <Typography.Text type="secondary">
          Global product view from explicitly configured storefront brands. Product exclusions are managed per brand and apply to every owner assigned to that brand
          {selectedBrandLabel ? ` · filtered by ${selectedBrandLabel}` : ""}.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-7"
            allowClear
            placeholder="Search products…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            prefix={<PercentageOutlined className="text-muted-foreground" />}
          />
          <Select
            className="md:col-span-5"
            value={brandId || ALL}
            loading={brandsQuery.isLoading}
            options={brandOptions}
            onChange={(value) => {
              setPage(1);
              setBrandId(value);
              const next = new URLSearchParams(searchParams);
              if (value === ALL) {
                next.delete("brandId");
                next.delete("brand");
              } else {
                next.set("brandId", value);
                const name = brandsQuery.data?.find((b) => b.id === value)?.name;
                if (name) next.set("brand", name);
              }
              setSearchParams(next, { replace: true });
            }}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<FranchiseProductRow>
          rowKey={(row) => row.storefront.productId}
          columns={columns}
          dataSource={rows}
          onRow={(row) => ({
            onClick: () => openDetail(row.storefront.productId),
            style: { cursor: "pointer" },
          })}
          loading={tableLoading}
          scroll={{ x: 1600 }}
          locale={{ emptyText: <Empty description="No storefront products" /> }}
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

      {brandId !== ALL && (
        <Button type="link" className="!px-0" onClick={() => navigate("/franchise-brands")}>
          ← Back to franchise brands
        </Button>
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
