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
  Modal,
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
  TagsOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch, apiPut } from "@/lib/api";
import {
  addStorefrontCategoriesToProduct,
  getActiveStorefrontBrands,
  getPublishedProduct,
  getStorefrontCategories,
  getStorefrontCategoriesByProduct,
  getStorefrontProducts,
  removeStorefrontCategoriesFromProduct,
  setProductVisibility,
} from "@/lib/storefrontApi";
import { effectiveProductPrice, productThumbnail } from "@/lib/productHelpers";
import {
  aggregateStorefrontAvailability,
  formatStorefrontNaira,
  pickDisplayVariant,
  storefrontMarkupPercent,
  type StorefrontCategoryDto,
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

  const [categoriesProduct, setCategoriesProduct] = useState<StorefrontProductDto | null>(null);
  const [assignedCategoryIds, setAssignedCategoryIds] = useState<string[]>([]);
  const [initialCategoryIds, setInitialCategoryIds] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [publishedSnapshot, setPublishedSnapshot] = useState<StorefrontProductDto | null>(null);

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
      const res = await getStorefrontProducts(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront products");
      return res.data;
    },
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

  const allCategoriesQuery = useQuery({
    queryKey: ["storefront", "categories-admin", { PageSize: 200, PageNumber: 1 }],
    queryFn: async () => {
      const res = await getStorefrontCategories({ PageSize: 200, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load categories");
      return res.data?.data ?? [];
    },
    enabled: categoriesProduct !== null,
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

  const categoryOptions = useMemo(
    () =>
      (allCategoriesQuery.data ?? []).map((c: StorefrontCategoryDto) => ({
        value: c.id,
        label: c.name,
      })),
    [allCategoriesQuery.data],
  );

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  async function openCategories(product: StorefrontProductDto) {
    setCategoriesProduct(product);
    setCategoriesLoading(true);
    setPublishedSnapshot(null);
    try {
      const [catsRes, publishedRes] = await Promise.all([
        getStorefrontCategoriesByProduct(product.productId),
        getPublishedProduct(product.productId),
      ]);
      if (!catsRes.status) {
        message.error(catsRes.message ?? "Failed to load product categories");
        setCategoriesProduct(null);
        return;
      }
      const ids = (catsRes.data ?? []).map((c) => c.id);
      setAssignedCategoryIds(ids);
      setInitialCategoryIds(ids);
      if (publishedRes.status) setPublishedSnapshot(publishedRes.data);
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function saveCategories() {
    if (!categoriesProduct) return;
    const toAdd = assignedCategoryIds.filter((id) => !initialCategoryIds.includes(id));
    const toRemove = initialCategoryIds.filter((id) => !assignedCategoryIds.includes(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      setCategoriesProduct(null);
      return;
    }
    setCategoriesSaving(true);
    try {
      if (toAdd.length > 0) {
        const res = await addStorefrontCategoriesToProduct({
          productId: categoriesProduct.productId,
          storefrontCategoryIds: toAdd,
        });
        if (!res.status) {
          message.error(res.message ?? "Failed to add categories");
          return;
        }
      }
      if (toRemove.length > 0) {
        const res = await removeStorefrontCategoriesFromProduct({
          productId: categoriesProduct.productId,
          storefrontCategoryIds: toRemove,
        });
        if (!res.status) {
          message.error(res.message ?? "Failed to remove categories");
          return;
        }
      }
      message.success("Storefront categories updated");
      setCategoriesProduct(null);
      void productsQuery.refetch();
    } finally {
      setCategoriesSaving(false);
    }
  }

  async function toggleStorefrontVisibility(productId: string, isVisible: boolean) {
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
          p.productId === productId ? { ...p, isStorefrontPublished: isVisible } : p,
        ),
      });
    }
    try {
      const res = await setProductVisibility({ productId, isVisible });
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
        return v ? formatStorefrontNaira(v.priceInNaira) : "—";
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
          : (v?.priceInNaira ?? 0);
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
        <Switch
          checked={storefront.isStorefrontPublished}
          disabled={!canEdit}
          loading={visibilityBusyId === storefront.productId}
          onChange={(val) => void toggleStorefrontVisibility(storefront.productId, val)}
        />
      ),
    },
    {
      title: "Active",
      key: "active",
      width: 80,
      render: (_, { storefront, catalog }) => {
        if (!catalog) return "—";
        return (
          <Switch
            checked={catalog.isActive}
            disabled={!canEdit}
            onChange={(val) => toggleField(storefront.productId, "IsActive", val)}
          />
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
          <Switch
            checked={catalog.isFeaturedProduct}
            disabled={!canEdit}
            onChange={(val) =>
              toggleField(storefront.productId, "IsFeaturedProduct", val)
            }
          />
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
            onClick={() => openDetail(storefront.productId)}
            title="View product"
          />
          {canEdit && (
            <Button
              size="small"
              icon={<TagsOutlined />}
              onClick={() => void openCategories(storefront)}
              title="Storefront categories"
            />
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => syncPrice(storefront.productId)}
              title="Sync price"
            />
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<FontSizeOutlined />}
              onClick={() => syncName(storefront.productId)}
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
          Franchise products
        </Typography.Title>
        <Typography.Text type="secondary">
          Storefront catalogue with catalog and storefront pricing
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

      <Modal
        open={categoriesProduct !== null}
        title={`Storefront categories — ${categoriesProduct?.productName ?? ""}`}
        onCancel={() => setCategoriesProduct(null)}
        onOk={() => void saveCategories()}
        confirmLoading={categoriesSaving}
        okButtonProps={{ disabled: categoriesLoading || !canEdit }}
        destroyOnClose
        width={560}
      >
        {categoriesLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 pt-2">
            {publishedSnapshot && (
              <div className="rounded border border-border px-3 py-2 text-sm">
                <div className="font-medium">Published snapshot</div>
                <div className="text-muted-foreground">
                  {publishedSnapshot.productName}
                  {publishedSnapshot.isStorefrontPublished ? " · published" : " · not published"}
                </div>
              </div>
            )}
            <Select
              mode="multiple"
              className="w-full"
              placeholder="Assign storefront categories"
              value={assignedCategoryIds}
              onChange={setAssignedCategoryIds}
              options={categoryOptions}
              loading={allCategoriesQuery.isFetching}
              optionFilterProp="label"
              showSearch
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
