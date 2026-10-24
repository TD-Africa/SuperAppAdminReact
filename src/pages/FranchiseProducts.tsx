import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
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
  PercentageOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { apiGet, apiPatch, apiPut } from "@/lib/api";
import {
  addStorefrontBrand,
  getAllBrands,
  getStorefrontBrandCategoriesForAdmin,
  getStorefrontBrandProductsForAdmin,
  getStorefrontBrandExcludedProducts,
  getStorefrontBrands,
  getBrandProducts,
  setStorefrontBrandExcludedProducts,
  setProductVisibility,
} from "@/lib/storefrontApi";
import { effectiveProductPrice, productThumbnail } from "@/lib/productHelpers";
import {
  aggregateStorefrontAvailability,
  effectiveStorefrontBasePrice,
  formatStorefrontNaira,
  pickDisplayVariant,
  storefrontMarkupPercent,
  type StorefrontCategoryReturnDto,
  type StorefrontProductDto,
} from "@/lib/storefrontTypes";
import type { ProductReturnDto } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

interface FranchiseProductRow {
  storefront: StorefrontProductDto;
  catalog: ProductReturnDto | null;
}

export default function FranchiseProductsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));
  const canEditBrands = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const brandIdFromUrl = searchParams.get("brandId") ?? "";
  const brandNameFromUrl = searchParams.get("brand") ?? "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [brandId, setBrandId] = useState(brandIdFromUrl);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);
  const [exclusionBusyId, setExclusionBusyId] = useState<string | null>(null);
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [brandForm] = Form.useForm<{
    catalogBrandId: string;
    name: string;
    brandImageUrl: string;
    dynamicsId: string;
    storefrontPriceMargin: number;
    isActive: boolean;
  }>();


  useEffect(() => {
    if (brandIdFromUrl) setBrandId(brandIdFromUrl);
  }, [brandIdFromUrl]);

  const brandsQuery = useQuery({
    queryKey: ["storefront", "manage-brands"],
    queryFn: async () => {
      const res = await getStorefrontBrands({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
      return res.data?.data ?? [];
    },
  });

  const catalogBrandsQuery = useQuery({
    queryKey: ["catalog-brands-admin", "manage-storefront-products"],
    queryFn: async () => {
      const res = await getAllBrands({ PageSize: 500, PageNumber: 1, isActive: true });
      if (!res.status) throw new Error(res.message ?? "Failed to load catalog brands");
      return res.data?.data ?? [];
    },
  });

  const previewBrandId = Form.useWatch("catalogBrandId", brandForm);
  const previewProductsQuery = useQuery({
    queryKey: ["storefront", "add-brand-preview-products", previewBrandId],
    queryFn: async () => {
      if (!previewBrandId) return [] as ProductReturnDto[];
      const products: ProductReturnDto[] = [];
      let pageNumber = 1;
      const pageSize = 100;

      while (true) {
        const res = await getBrandProducts(previewBrandId, {
          PageSize: pageSize,
          PageNumber: pageNumber,
        });
        if (!res.status) {
          throw new Error(res.message ?? "Failed to load products for this brand");
        }
        const page = res.data?.data ?? [];
        products.push(
          ...page.filter(
            (product) =>
              product.isActive
              && !product.adminDisabled
              && product.showNairaCurrency
              && product.priceInDollar > 0,
          ),
        );
        if (page.length === 0 || products.length >= Number(res.data?.count ?? products.length)) {
          return products;
        }
        pageNumber += 1;
      }
    },
    enabled: addBrandOpen && Boolean(previewBrandId),
  });

  useEffect(() => {
    if (!addBrandOpen || !previewBrandId || !previewProductsQuery.data) return;
    setSelectedProductIds(previewProductsQuery.data.map((product) => product.id));
  }, [addBrandOpen, previewBrandId, previewProductsQuery.data]);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      storefrontBrandId: brandId || undefined,
    }),
    [pageSize, page, debouncedSearch, brandId],
  );

  const productsQuery = useQuery({
    queryKey: ["storefront", "products", queryParams],
    queryFn: async () => {
      if (!brandId) return { data: [], count: 0, pageNumber: 1 };
      const res = await getStorefrontBrandProductsForAdmin(brandId, {
        PageSize: queryParams.PageSize,
        PageNumber: queryParams.PageNumber,
        SearchString: queryParams.SearchString,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront products");
      return res.data;
    },
    enabled: brandsQuery.isSuccess && Boolean(brandId),
  });

  const exclusionsQuery = useQuery({
    queryKey: ["storefront", "manage-brand-exclusions", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const res = await getStorefrontBrandExcludedProducts(brandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load product exclusions");
      return res.data ?? [];
    },
    enabled: Boolean(brandId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["storefront", "manage-brand-categories", brandId],
    queryFn: async () => {
      if (!brandId) return [] as StorefrontCategoryReturnDto[];
      const res = await getStorefrontBrandCategoriesForAdmin(brandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load brand categories");
      return res.data ?? [];
    },
    enabled: Boolean(brandId),
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
    return (brandsQuery.data ?? [])
      .map((b) => ({
        value: b.id,
        label: b.isActive ? b.name : `${b.name} (inactive)`,
      }));
  }, [brandsQuery.data]);

  const configuredCatalogBrandIds = useMemo(() => {
    const ids = new Set<string>();
    for (const brand of brandsQuery.data ?? []) {
      for (const id of brand.catalogBrandIds ?? []) ids.add(id);
      if (brand.brandId) ids.add(brand.brandId);
    }
    return ids;
  }, [brandsQuery.data]);

  const addBrandOptions = useMemo(
    () =>
      (catalogBrandsQuery.data ?? []).map((brand) => {
        // Older storefront-brand records may not have a catalog brand ID. Match
        // those records by their stable name/Dynamics metadata as well, so an
        // already-configured brand is still shown but cannot be added again.
        const alreadyAdded = configuredCatalogBrandIds.has(brand.id)
          || (brandsQuery.data ?? []).some(
            (existing) =>
              existing.name.trim().toLowerCase() === brand.name.trim().toLowerCase()
              || (brand.dynamicsId && existing.dynamicsId === brand.dynamicsId),
          );
        return {
          value: brand.id,
          label: alreadyAdded ? `${brand.name} (already added)` : brand.name,
          disabled: alreadyAdded,
        };
      }),
    [catalogBrandsQuery.data, configuredCatalogBrandIds, brandsQuery.data],
  );

  const selectedBrandLabel =
    brandId
      ? (brandsQuery.data?.find((b) => b.id === brandId)?.name ?? brandNameFromUrl)
      : null;

  const excludedProductIds = useMemo(
    () => new Set(exclusionsQuery.data ?? []),
    [exclusionsQuery.data],
  );

  function selectBrand(value: string) {
    setPage(1);
    setBrandId(value);
    const next = new URLSearchParams(searchParams);
    if (!value) {
      next.delete("brandId");
      next.delete("brand");
    } else {
      next.set("brandId", value);
      const name = brandsQuery.data?.find((b) => b.id === value)?.name;
      if (name) next.set("brand", name);
    }
    setSearchParams(next, { replace: true });
  }

  function openAddBrand() {
    brandForm.setFieldsValue({
      catalogBrandId: "",
      name: "",
      brandImageUrl: "",
      dynamicsId: "",
      storefrontPriceMargin: 0,
      isActive: true,
    });
    setAddBrandOpen(true);
  }

  async function addBrand() {
    const values = await brandForm.validateFields();
    const source = catalogBrandsQuery.data?.find((brand) => brand.id === values.catalogBrandId);
    if (!source) return;
    if (configuredCatalogBrandIds.has(source.id)) {
      message.error("This SuperApp brand has already been added to the storefront");
      return;
    }
    const normalizedName = values.name.trim().toLowerCase();
    const normalizedDynamicsId = values.dynamicsId.trim().toLowerCase();
    const duplicate = (brandsQuery.data ?? []).some(
      (existing) =>
        existing.name.trim().toLowerCase() === normalizedName
        || (normalizedDynamicsId.length > 0
          && (existing.dynamicsId ?? "").trim().toLowerCase() === normalizedDynamicsId),
    );
    if (duplicate) {
      message.error("A storefront brand with this name or Dynamics ID already exists");
      return;
    }
    setSavingBrand(true);
    try {
      const res = await addStorefrontBrand({
        catalogBrandIds: [source.id],
        name: values.name,
        brandImageUrl: values.brandImageUrl || source.brandImageUrl || "",
        dynamicsId: values.dynamicsId || source.dynamicsId || "",
        storefrontPriceMargin: values.storefrontPriceMargin,
        isActive: values.isActive,
      });
      if (!res.status || !res.data) {
        message.error(res.message ?? "Failed to add storefront brand");
        return;
      }

      const excludedProductIds = (previewProductsQuery.data ?? [])
        .map((product) => product.id)
        .filter((productId) => !selectedProductIds.includes(productId));
      let exclusionsSaved = true;
      if (excludedProductIds.length > 0) {
        const exclusionRes = await setStorefrontBrandExcludedProducts(
          res.data.id,
          excludedProductIds,
        );
        if (!exclusionRes.status) {
          exclusionsSaved = false;
          message.error(
            `Brand was created, but product exclusions could not be saved: ${exclusionRes.message ?? "try again"}`,
          );
        }
      }

      if (exclusionsSaved) message.success("Brand added with the selected products.");
      setAddBrandOpen(false);
      brandForm.resetFields();
      setSelectedProductIds([]);
      await queryClient.invalidateQueries({ queryKey: ["storefront", "manage-brands"] });
      selectBrand(res.data.id);
    } finally {
      setSavingBrand(false);
    }
  }

  async function toggleBrandProduct(product: StorefrontProductDto) {
    if (!brandId) return;
    const isExcluded = excludedProductIds.has(product.productId) || product.isExcluded === true;
    const next = new Set(excludedProductIds);
    if (isExcluded) next.delete(product.productId);
    else next.add(product.productId);
    setExclusionBusyId(product.productId);
    try {
      const res = await setStorefrontBrandExcludedProducts(brandId, [...next]);
      if (!res.status) {
        message.error(res.message ?? "Failed to update product inclusion");
        return;
      }
      message.success(isExcluded ? "Product restored for this brand" : "Product removed from this brand");
      await queryClient.invalidateQueries({ queryKey: ["storefront", "manage-brand-exclusions", brandId] });
      await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
    } finally {
      setExclusionBusyId(null);
    }
  }

  async function includeAllBrandProducts() {
    if (!brandId || excludedProductIds.size === 0) return;
    const res = await setStorefrontBrandExcludedProducts(brandId, []);
    if (!res.status) {
      message.error(res.message ?? "Failed to restore products");
      return;
    }
    message.success("All products restored for this brand");
    await queryClient.invalidateQueries({ queryKey: ["storefront", "manage-brand-exclusions", brandId] });
    await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
  }

  const selectedBrandCategories = categoriesQuery.data ?? [];

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
      width: 190,
      render: (_, { storefront }) => {
        const isExcluded = excludedProductIds.has(storefront.productId) || storefront.isExcluded === true;
        return (
          <Space size={6}>
            <Tag color={isExcluded ? "error" : "success"}>
              {isExcluded ? "Excluded" : "Included"}
            </Tag>
            {brandId && canEdit && (
              <Button
                size="small"
                loading={exclusionBusyId === storefront.productId}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleBrandProduct(storefront);
                }}
              >
                {isExcluded ? "Restore" : "Remove"}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Typography.Title level={3} className="!m-0">
              Manage storefront products
            </Typography.Title>
            <Typography.Text type="secondary">
              Add a storefront brand, remove products from that brand, and review the categories that remain available.
              {selectedBrandLabel ? ` · ${selectedBrandLabel}` : ""}
            </Typography.Text>
          </div>
          <Button type="primary" disabled={!canEditBrands} icon={<AppstoreOutlined />} onClick={openAddBrand}>
            Add brand
          </Button>
        </div>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Select
          className="w-full"
          value={brandId || undefined}
          loading={brandsQuery.isLoading}
          options={brandOptions}
          placeholder="Select a storefront brand"
          onChange={selectBrand}
        />
      </Card>

      {!brandId ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Select a storefront brand to view its products and categories"
          >
            <Button type="primary" disabled={!canEditBrands} onClick={openAddBrand}>
              Add storefront brand
            </Button>
          </Empty>
        </Card>
      ) : (
        <Tabs
          key={brandId}
          defaultActiveKey="products"
          items={[
            {
              key: "products",
              label: "Products",
              children: (
                <div className="space-y-4">
                  <Card styles={{ body: { padding: 16 } }}>
                    <Input
                      allowClear
                      placeholder="Search products…"
                      value={search}
                      onChange={(e) => {
                        setPage(1);
                        setSearch(e.target.value);
                      }}
                      prefix={<PercentageOutlined className="text-muted-foreground" />}
                    />
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
                </div>
              ),
            },
            {
              key: "categories",
              label: "Categories",
              children: (
                <Card
                  title={`Categories for ${selectedBrandLabel ?? "this brand"}`}
                  extra={
                    <Button
                      size="small"
                      disabled={!canEdit || excludedProductIds.size === 0}
                      onClick={() => void includeAllBrandProducts()}
                    >
                      Restore all products
                    </Button>
                  }
                >
                  {categoriesQuery.isLoading ? (
                    <Typography.Text type="secondary">Loading categories…</Typography.Text>
                  ) : selectedBrandCategories.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No categories with included products" />
                  ) : (
                    <Space wrap>
                      {selectedBrandCategories.map((category) => (
                        <Tag key={category.id} color="blue">
                          {category.name ?? "Unnamed category"} ({category.productCount})
                        </Tag>
                      ))}
                    </Space>
                  )}
                </Card>
              ),
            },
          ]}
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

      <Modal
        open={addBrandOpen}
        title="Add storefront brand"
        width={900}
        onCancel={() => {
          setAddBrandOpen(false);
          brandForm.resetFields();
          setSelectedProductIds([]);
        }}
        onOk={() => void addBrand()}
        confirmLoading={savingBrand}
        okButtonProps={{
          disabled:
            !previewBrandId
            || previewProductsQuery.isLoading
            || previewProductsQuery.isError,
        }}
        destroyOnClose
        okText="Add brand"
      >
        <Form form={brandForm} layout="vertical">
          <Typography.Text type="secondary" className="mb-3 block">
            Select one new SuperApp brand. Its valid products are included by default, and its categories are derived from those products. Existing brands can be selected from the brand selector on the page.
          </Typography.Text>
          <Form.Item
            name="catalogBrandId"
            label="SuperApp brand"
            rules={[{ required: true, message: "Select a SuperApp brand" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={catalogBrandsQuery.isLoading}
              notFoundContent="All available brands have already been added"
              placeholder="Select the source brand"
              onChange={(value: string) => {
                setSelectedProductIds([]);
                const source = catalogBrandsQuery.data?.find((brand) => brand.id === value);
                if (!source) return;
                brandForm.setFieldsValue({
                  name: source.name,
                  dynamicsId: source.dynamicsId ?? "",
                  brandImageUrl: source.brandImageUrl ?? "",
                });
              }}
              options={addBrandOptions}
            />
          </Form.Item>
          {previewBrandId && (
            <div className="mb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Typography.Text strong>
                  Products to add ({selectedProductIds.length} of {previewProductsQuery.data?.length ?? 0} selected)
                </Typography.Text>
                <Typography.Text type="secondary">
                  Uncheck products you do not want this brand to sell.
                </Typography.Text>
              </div>
              {previewProductsQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  message={
                    previewProductsQuery.error instanceof Error
                      ? previewProductsQuery.error.message
                      : "Unable to load products for this brand"
                  }
                />
              ) : (
                <Table<ProductReturnDto>
                  size="small"
                  rowKey="id"
                  loading={previewProductsQuery.isLoading || previewProductsQuery.isFetching}
                  dataSource={previewProductsQuery.data ?? []}
                  pagination={false}
                  scroll={{ y: 300 }}
                  rowSelection={{
                    selectedRowKeys: selectedProductIds,
                    onChange: (keys) => setSelectedProductIds(keys.map(String)),
                  }}
                  locale={{ emptyText: "No eligible products for this brand" }}
                  columns={[
                    {
                      title: "Product",
                      key: "product",
                      render: (_, product) => (
                        <Space>
                          <Avatar
                            shape="square"
                            src={productThumbnail(product)}
                            icon={!productThumbnail(product) ? <AppstoreOutlined /> : undefined}
                          />
                          <div>
                            <div className="font-medium">{product.productName}</div>
                            <Typography.Text type="secondary" className="text-xs">
                              {product.dynamicsId ?? product.id}
                            </Typography.Text>
                          </div>
                        </Space>
                      ),
                    },
                    {
                      title: "Price (NGN)",
                      key: "naira",
                      align: "right",
                      width: 150,
                      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
                      render: (_, product) => formatCurrency(effectiveProductPrice(product, "naira"), "NGN"),
                    },
                    {
                      title: "Price (USD)",
                      key: "dollar",
                      align: "right",
                      width: 120,
                      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
                      render: (_, product) => formatCurrency(effectiveProductPrice(product, "dollar"), "USD"),
                    },
                  ]}
                />
              )}
            </div>
          )}
          <Form.Item
            name="name"
            label="Storefront brand name"
            rules={[{ required: true, message: "Enter a storefront brand name" }]}
          >
            <Input placeholder="Defaults to the selected SuperApp brand" />
          </Form.Item>
          <Form.Item name="brandImageUrl" label="Logo URL">
            <Input placeholder="Optional storefront logo URL" />
          </Form.Item>
          <Form.Item name="dynamicsId" label="Dynamics ID">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="storefrontPriceMargin"
            label="Default margin %"
            rules={[{ required: true, message: "Enter a margin" }]}
          >
            <InputNumber min={0} max={100} precision={2} addonAfter="%" className="w-full" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
