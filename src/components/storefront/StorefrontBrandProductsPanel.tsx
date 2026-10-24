import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Avatar,
  Button,
  Empty,
  Space,
  Switch,
  Table,
  Tag,
  Tabs,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  AppstoreOutlined,
  EyeOutlined,
  FontSizeOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch, apiPut } from "@/lib/api";
import {
  getStorefrontBrandCategoriesForAdmin,
  getStorefrontBrandExcludedProducts,
  getStorefrontBrandProductsForAdmin,
  setProductVisibility,
  setStorefrontBrandExcludedProducts,
} from "@/lib/storefrontApi";
import { effectiveProductPrice, productThumbnail } from "@/lib/productHelpers";
import {
  aggregateStorefrontAvailability,
  effectiveStorefrontBasePrice,
  formatStorefrontNaira,
  pickDisplayVariant,
  storefrontMarkupPercent,
  type StorefrontBrandAdminDto,
  type StorefrontCategoryReturnDto,
  type StorefrontProductDto,
} from "@/lib/storefrontTypes";
import type { ProductReturnDto } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type PublishedFilter = "all" | "published" | "unpublished";
export type AvailabilityFilter = "all" | "included" | "excluded";
export type StockFilter = "all" | "in" | "out";

export interface StorefrontProductFilters {
  search: string;
  published: PublishedFilter;
  availability: AvailabilityFilter;
  stock: StockFilter;
}

interface FranchiseProductRow {
  storefront: StorefrontProductDto;
  catalog: ProductReturnDto | null;
}

interface Props {
  brand: StorefrontBrandAdminDto;
  filters: StorefrontProductFilters;
  canEdit: boolean;
  onOpenDetail: (productId: string) => void;
}

function rowQuantity({ storefront, catalog }: FranchiseProductRow) {
  if (catalog) return catalog.quantity;
  return aggregateStorefrontAvailability(storefront).totalQty;
}

export function StorefrontBrandProductsPanel({ brand, filters, canEdit, onOpenDetail }: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const brandId = brand.id;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [exclusionBusyId, setExclusionBusyId] = useState<string | null>(null);

  const searchString = filters.search.trim() || undefined;

  useEffect(() => {
    setPage(1);
  }, [searchString]);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: searchString,
      storefrontBrandId: brandId,
    }),
    [pageSize, page, searchString, brandId],
  );

  const productsQueryKey = ["storefront", "products", queryParams] as const;

  const productsQuery = useQuery({
    queryKey: productsQueryKey,
    queryFn: async () => {
      const res = await getStorefrontBrandProductsForAdmin(brandId, {
        PageSize: queryParams.PageSize,
        PageNumber: queryParams.PageNumber,
        SearchString: queryParams.SearchString,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront products");
      return res.data;
    },
  });

  const exclusionsQuery = useQuery({
    queryKey: ["storefront", "manage-brand-exclusions", brandId],
    queryFn: async () => {
      const res = await getStorefrontBrandExcludedProducts(brandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load product exclusions");
      return res.data ?? [];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["storefront", "manage-brand-categories", brandId],
    queryFn: async () => {
      const res = await getStorefrontBrandCategoriesForAdmin(brandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load brand categories");
      return res.data ?? ([] as StorefrontCategoryReturnDto[]);
    },
  });

  const storefrontRows = productsQuery.data?.data ?? [];
  const productIds = useMemo(() => storefrontRows.map((p) => p.productId), [storefrontRows]);

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

  const excludedProductIds = useMemo(
    () => new Set(exclusionsQuery.data ?? []),
    [exclusionsQuery.data],
  );

  const isExcluded = (product: StorefrontProductDto) =>
    excludedProductIds.has(product.productId) || product.isExcluded === true;

  const rows: FranchiseProductRow[] = useMemo(
    () =>
      storefrontRows.map((storefront) => ({
        storefront,
        catalog: catalogQuery.data?.get(storefront.productId) ?? null,
      })),
    [storefrontRows, catalogQuery.data],
  );

  // Published, availability and stock are not supported by the API, so they
  // only narrow the page that has already been loaded.
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const { storefront } = row;
        if (filters.published === "published" && !storefront.isStorefrontPublished) return false;
        if (filters.published === "unpublished" && storefront.isStorefrontPublished) return false;
        const excluded =
          excludedProductIds.has(storefront.productId) || storefront.isExcluded === true;
        if (filters.availability === "included" && excluded) return false;
        if (filters.availability === "excluded" && !excluded) return false;
        if (filters.stock !== "all") {
          const qty = rowQuantity(row);
          if (filters.stock === "in" && qty <= 0) return false;
          if (filters.stock === "out" && qty > 0) return false;
        }
        return true;
      }),
    [rows, filters.published, filters.availability, filters.stock, excludedProductIds],
  );

  const totalItems = Number(productsQuery.data?.count ?? 0);

  async function toggleBrandProduct(product: StorefrontProductDto) {
    const wasExcluded = isExcluded(product);
    const next = new Set(excludedProductIds);
    if (wasExcluded) next.delete(product.productId);
    else next.add(product.productId);
    setExclusionBusyId(product.productId);
    try {
      const res = await setStorefrontBrandExcludedProducts(brandId, [...next]);
      if (!res.status) {
        message.error(res.message ?? "Failed to update product inclusion");
        return;
      }
      message.success(wasExcluded ? "Product restored for this brand" : "Product removed from this brand");
      await queryClient.invalidateQueries({ queryKey: ["storefront", "manage-brand-exclusions", brandId] });
      await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
    } finally {
      setExclusionBusyId(null);
    }
  }

  async function includeAllBrandProducts() {
    if (excludedProductIds.size === 0) return;
    const res = await setStorefrontBrandExcludedProducts(brandId, []);
    if (!res.status) {
      message.error(res.message ?? "Failed to restore products");
      return;
    }
    message.success("All products restored for this brand");
    await queryClient.invalidateQueries({ queryKey: ["storefront", "manage-brand-exclusions", brandId] });
    await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
  }

  async function toggleStorefrontVisibility(productId: string, isPublished: boolean) {
    setVisibilityBusyId(productId);
    const prev = queryClient.getQueryData<typeof productsQuery.data>(productsQueryKey);
    if (prev?.data) {
      queryClient.setQueryData(productsQueryKey, {
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
        queryClient.setQueryData(productsQueryKey, prev);
        return;
      }
      message.success(res.message ?? "Visibility updated");
      void productsQuery.refetch();
    } finally {
      setVisibilityBusyId(null);
    }
  }

  async function toggleField(id: string, field: "IsActive" | "IsFeaturedProduct", value: boolean) {
    const prev = queryClient.getQueryData<Map<string, ProductReturnDto>>(catalogQueryKey);
    if (prev?.has(id)) {
      const next = new Map(prev);
      const product = next.get(id)!;
      next.set(id, {
        ...product,
        isActive: field === "IsActive" ? value : product.isActive,
        isFeaturedProduct: field === "IsFeaturedProduct" ? value : product.isFeaturedProduct,
      });
      queryClient.setQueryData(catalogQueryKey, next);
    }

    const res = await apiPatch<boolean>(`product/editProduct/${id}`, { [field]: value });
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
          (catalog ? productThumbnail(catalog) : undefined) ?? storefront.images?.[0] ?? undefined;
        return <Avatar shape="square" src={src} icon={!src ? <AppstoreOutlined /> : undefined} />;
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
          onClick={() => onOpenDetail(storefront.productId)}
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
      render: (_, { storefront, catalog }) => catalog?.brand?.name ?? storefront.brandName ?? "—",
    },
    {
      title: "Qty",
      key: "qty",
      width: 80,
      align: "right",
      render: (_, row) => formatNumber(rowQuantity(row)),
    },
    {
      title: "Price (NGN)",
      key: "priceNgn",
      width: 150,
      align: "right",
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_, { storefront, catalog }) => {
        if (catalog) return formatCurrency(effectiveProductPrice(catalog, "naira"), "NGN");
        const v = pickDisplayVariant(storefront);
        return v ? formatStorefrontNaira(effectiveStorefrontBasePrice(v)) : "—";
      },
    },
    {
      title: "Price (USD)",
      key: "priceUsd",
      width: 120,
      align: "right",
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
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
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
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
        const markup = storefrontMarkupPercent(baseNaira, v?.storefrontPrice ?? 0);
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
      width: 190,
      render: (_, { storefront }) => {
        const excluded = isExcluded(storefront);
        return (
          <Space size={6}>
            <Tag color={excluded ? "error" : "success"}>{excluded ? "Excluded" : "Included"}</Tag>
            {canEdit && (
              <Button
                size="small"
                loading={exclusionBusyId === storefront.productId}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleBrandProduct(storefront);
                }}
              >
                {excluded ? "Restore" : "Remove"}
              </Button>
            )}
          </Space>
        );
      },
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
              onChange={(val) => toggleField(storefront.productId, "IsFeaturedProduct", val)}
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
              onOpenDetail(storefront.productId);
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

  const categories = categoriesQuery.data ?? [];

  return (
    <Tabs
      size="small"
      defaultActiveKey="products"
      items={[
        {
          key: "products",
          label: "Products",
          children: (
            <Table<FranchiseProductRow>
              size="middle"
              rowKey={(row) => row.storefront.productId}
              columns={columns}
              dataSource={filteredRows}
              onRow={(row) => ({
                onClick: () => onOpenDetail(row.storefront.productId),
                style: { cursor: "pointer" },
              })}
              loading={tableLoading}
              scroll={{ x: 1600 }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      rows.length > 0 ? "No products on this page match the filters" : "No storefront products"
                    }
                  />
                ),
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
            />
          ),
        },
        {
          key: "categories",
          label: "Categories",
          children: (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="small"
                  disabled={!canEdit || excludedProductIds.size === 0}
                  onClick={() => void includeAllBrandProducts()}
                >
                  Restore all products
                </Button>
              </div>
              {categoriesQuery.isLoading ? (
                <Typography.Text type="secondary">Loading categories…</Typography.Text>
              ) : categories.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No categories with included products" />
              ) : (
                <Space wrap>
                  {categories.map((category) => (
                    <Tag key={category.id} color="blue">
                      {category.name ?? "Unnamed category"} ({category.productCount})
                    </Tag>
                  ))}
                </Space>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
