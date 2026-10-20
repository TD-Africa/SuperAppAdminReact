import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, SettingOutlined } from "@ant-design/icons";
import {
  deleteStorefrontBrand,
  getStorefrontBrandExcludedProducts,
  getStorefrontBrandCategoriesForAdmin,
  getStorefrontBrandProductsForAdmin,
  getProductStorefrontPricing,
  getStorefrontBrandById,
  getVariantStorefrontPricing,
  setProductStorefrontMargin,
  setStorefrontBrandExcludedProducts,
  setVariantStorefrontMargin,
  updateStorefrontBrand,
} from "@/lib/storefrontApi";
import {
  formatStorefrontNaira,
  effectiveStorefrontBasePrice,
  pickDisplayVariant,
  productMarginSource,
  storefrontMarkupPercent,
  storefrontPriceFromMargin,
  type ProductMarginSource,
  type ProductStorefrontPricingDto,
  type StorefrontBrandAdminDto,
  type StorefrontCategoryReturnDto,
  type StorefrontProductDto,
  type StorefrontVariantDto,
  type UpdateStorefrontBrandRequest,
  type VariantStorefrontPricingDto,
} from "@/lib/storefrontTypes";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const sourceTag = (source: ProductMarginSource, rate: number | null) => {
  if (source === "override") return <Tag color="purple">Override · {rate?.toFixed(2)}%</Tag>;
  if (source === "inherited") return <Tag color="success">Inherited · {rate?.toFixed(2)}%</Tag>;
  return <Tag color="warning">Not configured</Tag>;
};

function variantLabel(variant: StorefrontVariantDto, index: number) {
  const parts = [
    variant.isDefault ? "Default" : null,
    variant.sizeId ? `Size ${variant.sizeId.slice(0, 6)}` : null,
    variant.colorId ? `Color ${variant.colorId.slice(0, 6)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : `Variant ${index + 1}`;
}

function toUpdateBody(brand: StorefrontBrandAdminDto): UpdateStorefrontBrandRequest {
  return {
    brandId: brand.brandId,
    ...(brand.catalogBrandIds?.length ? { catalogBrandIds: brand.catalogBrandIds } : {}),
    brandImageUrl: brand.brandImageUrl ?? "",
    name: brand.name,
    dynamicsId: brand.dynamicsId,
    storefrontPriceMargin: brand.storefrontPriceMargin,
    isActive: brand.isActive,
  };
}

export default function FranchiseBrandDetailPage() {
  const { storefrontBrandId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const brandFromNav = (location.state as { brand?: StorefrontBrandAdminDto } | null)?.brand;

  const [draftMargin, setDraftMargin] = useState<number | null>(null);
  const [draftActive, setDraftActive] = useState(true);
  const [savingBrand, setSavingBrand] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<ProductMarginSource | "all">("all");
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearch, 350);
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(20);

  const [editingProduct, setEditingProduct] = useState<StorefrontProductDto | null>(null);
  const [pricing, setPricing] = useState<ProductStorefrontPricingDto | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [draftStorefront, setDraftStorefront] = useState<number | null>(null);
  const [revertToBrand, setRevertToBrand] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const [variantPricing, setVariantPricing] = useState<
    Record<string, VariantStorefrontPricingDto | null>
  >({});
  const [variantDrafts, setVariantDrafts] = useState<Record<string, number | null>>({});
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);

  const brandQuery = useQuery({
    queryKey: ["storefront", "brand", storefrontBrandId],
    queryFn: async () => {
      if (brandFromNav && brandFromNav.id === storefrontBrandId) return brandFromNav;
      if (!storefrontBrandId) return null;
      const res = await getStorefrontBrandById(storefrontBrandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load brand");
      return res.data;
    },
    enabled: Boolean(storefrontBrandId),
  });

  const brand = brandQuery.data ?? null;

  useEffect(() => {
    if (!brand) return;
    setDraftMargin(brand.storefrontPriceMargin);
    setDraftActive(brand.isActive);
  }, [brand]);

  const productsQuery = useQuery({
    queryKey: [
      "storefront",
      "brand-products",
      storefrontBrandId,
      productPage,
      productPageSize,
      debouncedProductSearch,
    ],
    queryFn: async () => {
      if (!storefrontBrandId) return null;
      const res = await getStorefrontBrandProductsForAdmin(storefrontBrandId, {
        PageSize: productPageSize,
        PageNumber: productPage,
        SearchString: debouncedProductSearch.trim() || undefined,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load products");
      return res.data;
    },
    enabled: Boolean(storefrontBrandId && brand?.isActive),
  });

  const products = productsQuery.data?.data ?? [];
  const productTotal = Number(productsQuery.data?.count ?? 0);

  const categoriesQuery = useQuery({
    queryKey: ["storefront", "brand-categories", storefrontBrandId],
    queryFn: async () => {
      if (!storefrontBrandId) return [] as StorefrontCategoryReturnDto[];
      const res = await getStorefrontBrandCategoriesForAdmin(storefrontBrandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load brand categories");
      return res.data ?? [];
    },
    enabled: Boolean(storefrontBrandId && brand?.isActive),
  });

  const exclusionsQuery = useQuery({
    queryKey: ["storefront", "brand-product-exclusions", storefrontBrandId],
    queryFn: async () => {
      if (!storefrontBrandId) return [];
      const res = await getStorefrontBrandExcludedProducts(storefrontBrandId);
      if (!res.status) throw new Error(res.message ?? "Failed to load product exclusions");
      return res.data ?? [];
    },
    enabled: Boolean(storefrontBrandId),
  });

  const excludedProductIds = useMemo(
    () => new Set(exclusionsQuery.data ?? []),
    [exclusionsQuery.data],
  );

  async function toggleProductExclusion(product: StorefrontProductDto) {
    if (!storefrontBrandId) return;
    const next = new Set(excludedProductIds);
    const isExcluded = next.has(product.productId) || product.isExcluded === true;
    if (isExcluded) next.delete(product.productId);
    else next.add(product.productId);
    const res = await setStorefrontBrandExcludedProducts(storefrontBrandId, [...next]);
    if (!res.status) {
      message.error(res.message ?? "Failed to update product availability");
      return;
    }
    message.success(next.has(product.productId) ? "Product removed from this storefront brand" : "Product restored for this storefront brand");
    await queryClient.invalidateQueries({
      queryKey: ["storefront", "brand-product-exclusions", storefrontBrandId],
    });
    await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
  }

  async function includeAllProducts() {
    if (!storefrontBrandId || excludedProductIds.size === 0) return;
    const res = await setStorefrontBrandExcludedProducts(storefrontBrandId, []);
    if (!res.status) {
      message.error(res.message ?? "Failed to include all products");
      return;
    }
    message.success("All products restored for this storefront brand");
    await queryClient.invalidateQueries({
      queryKey: ["storefront", "brand-product-exclusions", storefrontBrandId],
    });
    await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
  }

  const editableVariants = useMemo(() => {
    const variants = (editingProduct?.variants ?? []).filter(
      (v) => v.isActive && effectiveStorefrontBasePrice(v) > 0,
    );
    return variants.length > 1 ? variants : [];
  }, [editingProduct]);

  const visibleProducts = useMemo(() => {
    if (!brand || sourceFilter === "all") return products;
    return products.filter((product) => {
      const variant = pickDisplayVariant(product);
      const base = effectiveStorefrontBasePrice(variant);
      const storefront = variant?.storefrontPrice ?? 0;
      const markup = storefrontMarkupPercent(base, storefront);
      const source: ProductMarginSource =
        markup === null || markup <= 0
          ? "unset"
          : Math.abs(markup - brand.storefrontPriceMargin) < 0.01
            ? "inherited"
            : "override";
      return source === sourceFilter;
    });
  }, [brand, products, sourceFilter]);

  async function saveBrand() {
    if (!brand || !storefrontBrandId || draftMargin === null) return;
    setSavingBrand(true);
    try {
      const body: UpdateStorefrontBrandRequest = {
        ...toUpdateBody(brand),
        storefrontPriceMargin: draftMargin,
        isActive: draftActive,
      };
      const res = await updateStorefrontBrand(storefrontBrandId, body);
      if (!res.status || !res.data) {
        message.error(res.message ?? "Failed to save brand margin");
        return;
      }
      message.success(res.message ?? "Brand margin saved");
      queryClient.setQueryData(["storefront", "brand", storefrontBrandId], res.data);
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
      void productsQuery.refetch();
    } finally {
      setSavingBrand(false);
    }
  }

  async function removeBrand() {
    if (!storefrontBrandId) return;
    setDeletingBrand(true);
    try {
      const res = await deleteStorefrontBrand(storefrontBrandId);
      if (!res.status) {
        message.error(res.message ?? "Failed to delete brand");
        return;
      }
      message.success(res.message ?? "Brand deleted");
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands"] });
      navigate("/franchise-brands");
    } finally {
      setDeletingBrand(false);
    }
  }

  async function openProductEditor(product: StorefrontProductDto) {
    setEditingProduct(product);
    setRevertToBrand(false);
    setPricing(null);
    setVariantPricing({});
    setVariantDrafts({});
    setPricingLoading(true);
    try {
      const res = await getProductStorefrontPricing(product.productId);
      if (!res.status || !res.data) {
        message.error(res.message ?? "Failed to load product pricing");
        setEditingProduct(null);
        return;
      }
      setPricing(res.data);
      // Product storefront pricing is displayed/edited as integer Naira, but backend values may be fractional.
      // Round here so margin % derivation matches the UI input precision.
      setDraftStorefront(Math.round(res.data.storefrontPrice));

      const variants = (product.variants ?? []).filter(
        (v) => v.isActive && effectiveStorefrontBasePrice(v) > 0,
      );
      if (variants.length > 1) {
        const entries = await Promise.all(
          variants.map(async (variant) => {
            const vRes = await getVariantStorefrontPricing(variant.id);
            return [variant.id, vRes.status ? vRes.data : null] as const;
          }),
        );
        const nextPricing: Record<string, VariantStorefrontPricingDto | null> = {};
        const nextDrafts: Record<string, number | null> = {};
        for (const [id, data] of entries) {
          nextPricing[id] = data;
          nextDrafts[id] = data?.storefrontPrice !== undefined ? Math.round(data.storefrontPrice) : null;
        }
        setVariantPricing(nextPricing);
        setVariantDrafts(nextDrafts);
      }
    } finally {
      setPricingLoading(false);
    }
  }

  async function saveProductPricing() {
    if (!editingProduct || !pricing) return;
    setSavingProduct(true);
    try {
      let margin = pricing.brandMargin;
      if (revertToBrand) {
        margin = pricing.brandMargin;
      } else {
        const baseForMargin = Math.round(
          (pricing.retailPriceInNaira ?? 0) >= 1
            ? pricing.retailPriceInNaira!
            : pricing.priceInNaira,
        );
        if (draftStorefront === null || draftStorefront < baseForMargin) {
          message.error("Storefront price must be at least the product price.");
          return;
        }
        const derived = storefrontMarkupPercent(baseForMargin, draftStorefront);
        if (derived === null) {
          message.error("Unable to derive margin from storefront price.");
          return;
        }
        margin = Number(derived.toFixed(2));
      }

      const res = await setProductStorefrontMargin({
        productId: editingProduct.productId,
        storefrontPriceMargin: margin,
      });
      if (!res.status || !res.data) {
        message.error(res.message ?? "Failed to save product pricing");
        return;
      }
      message.success(res.message ?? "Storefront price saved");
      setEditingProduct(null);
      void productsQuery.refetch();
    } finally {
      setSavingProduct(false);
    }
  }

  async function saveVariantPricing(variant: StorefrontVariantDto) {
    const draft = variantDrafts[variant.id];
    if (draft === null || draft === undefined) return;
    const baseForMargin = Math.round(effectiveStorefrontBasePrice(variant));
    if (draft < baseForMargin) {
      message.error("Storefront price must be at least the variant price.");
      return;
    }
    const derived = storefrontMarkupPercent(baseForMargin, draft);
    if (derived === null) {
      message.error("Unable to derive margin from storefront price.");
      return;
    }
    setSavingVariantId(variant.id);
    try {
      const res = await setVariantStorefrontMargin({
        variantId: variant.id,
        storefrontPriceMargin: Number(derived.toFixed(2)),
      });
      if (!res.status || !res.data) {
        message.error(res.message ?? "Failed to save variant pricing");
        return;
      }
      message.success(res.message ?? "Variant storefront price saved");
      setVariantPricing((prev) => ({ ...prev, [variant.id]: res.data }));
      setVariantDrafts((prev) => ({ ...prev, [variant.id]: res.data!.storefrontPrice }));
      void productsQuery.refetch();
    } finally {
      setSavingVariantId(null);
    }
  }

  if (brandQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  if (!brand) {
    return (
      <Empty description="Storefront brand not found">
        <Button onClick={() => navigate("/franchise-brands")}>Back to brands</Button>
      </Empty>
    );
  }

  const columns: TableColumnsType<StorefrontProductDto> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (name: string, product) => (
        <div>
          <div className="font-medium">{name}</div>
          <Typography.Text type="secondary" className="text-xs">
            {product.slug ?? product.productId}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Product price",
      key: "basePrice",
      width: 140,
      render: (_, product) => {
        const v = pickDisplayVariant(product);
        const basePrice = effectiveStorefrontBasePrice(v);
        return basePrice > 0 ? formatStorefrontNaira(basePrice) : "—";
      },
    },
    {
      title: "Storefront price",
      key: "storefrontPrice",
      width: 150,
      render: (_, product) => {
        const v = pickDisplayVariant(product);
        if (!v || v.storefrontPrice <= 0) {
          return <Typography.Text type="secondary">Not configured</Typography.Text>;
        }
        return <span className="font-medium">{formatStorefrontNaira(v.storefrontPrice)}</span>;
      },
    },
    {
      title: "Markup",
      key: "markup",
      width: 90,
      render: (_, product) => {
        const v = pickDisplayVariant(product);
        const markup = storefrontMarkupPercent(
          effectiveStorefrontBasePrice(v),
          v?.storefrontPrice ?? 0,
        );
        return markup === null ? "—" : `${markup.toFixed(2)}%`;
      },
    },
    {
      title: "Source",
      key: "source",
      render: (_, product) => {
        const v = pickDisplayVariant(product);
        const markup = storefrontMarkupPercent(
          effectiveStorefrontBasePrice(v),
          v?.storefrontPrice ?? 0,
        );
        const source: ProductMarginSource =
          markup === null || markup <= 0
            ? "unset"
            : Math.abs(markup - brand.storefrontPriceMargin) < 0.01
              ? "inherited"
              : "override";
        return sourceTag(source, markup);
      },
    },
    {
      title: "Availability",
      key: "availability",
      width: 150,
      render: (_, product) => (
        <Space direction="vertical" size={2}>
          <Tag color={excludedProductIds.has(product.productId) || product.isExcluded ? "error" : "success"}>
            {excludedProductIds.has(product.productId) || product.isExcluded ? "Excluded" : "Included"}
          </Tag>
          {canEdit && (
            <Button size="small" onClick={() => void toggleProductExclusion(product)}>
              {excludedProductIds.has(product.productId) || product.isExcluded ? "Restore" : "Remove"}
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 180,
      render: (_, product) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          disabled={!canEdit}
          onClick={() => void openProductEditor(product)}
        >
          Edit storefront price
        </Button>
      ),
    },
  ];

  const primaryPricingBase = pricing
    ? (pricing.retailPriceInNaira ?? 0) >= 1
      ? pricing.retailPriceInNaira!
      : pricing.priceInNaira
    : null;
  const retailPriceIsPrimary = (pricing?.retailPriceInNaira ?? 0) >= 1;
  const brandDefaultStorefront =
    pricing && brand
      ? retailPriceIsPrimary
        ? Math.round(pricing.retailPriceInNaira!)
        : Math.round(
            storefrontPriceFromMargin(Math.round(pricing.priceInNaira), brand.storefrontPriceMargin),
          )
      : null;

  const derivedMarkup =
    pricing && draftStorefront !== null && !revertToBrand
      ? storefrontMarkupPercent(Math.round(pricing.priceInNaira), draftStorefront)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/franchise-brands")}>
          All brands
        </Button>
        {canEdit && (
          <Popconfirm
            title="Delete this storefront brand?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => void removeBrand()}
          >
            <Button danger icon={<DeleteOutlined />} loading={deletingBrand}>
              Delete brand
            </Button>
          </Popconfirm>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Typography.Title level={3} className="!m-0">
              {brand.name} — storefront margin
            </Typography.Title>
            <Typography.Text type="secondary">
              Brand default margin applies to products without an override.
            </Typography.Text>
          </div>
          {canEdit && storefrontBrandId ? (
            <Button
              type="default"
              icon={<SettingOutlined />}
              onClick={() => navigate(`/franchise-brands/${storefrontBrandId}/theme`)}
            >
              Theme design
            </Button>
          ) : null}
        </div>
      </div>

      <Card title="Brand margin settings">
        <Form layout="vertical" className="max-w-xl">
          <Form.Item
            label="Default margin %"
            extra="Products without an override inherit this margin. TD Customers pay product price + margin."
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              addonAfter="%"
              className="w-full"
              value={draftMargin}
              disabled={!canEdit}
              onChange={(value) => setDraftMargin(value)}
            />
          </Form.Item>
          <Form.Item label="Active on storefront">
            <Switch
              checked={draftActive}
              disabled={!canEdit}
              onChange={setDraftActive}
              checkedChildren="Active"
              unCheckedChildren="Inactive"
            />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              loading={savingBrand}
              disabled={!canEdit || draftMargin === null}
              onClick={() => void saveBrand()}
            >
              Save brand margin
            </Button>
            <Button
              disabled={!canEdit}
              onClick={() => {
                setDraftMargin(brand.storefrontPriceMargin);
                setDraftActive(brand.isActive);
              }}
            >
              Reset
            </Button>
          </Space>
        </Form>
      </Card>

      <Card
        title={`Products (${productTotal})`}
        extra={
          <Space>
            <Popconfirm
              title="Include every product for this brand?"
              description="This clears the global product exclusions for the brand."
              okText="Include all"
              onConfirm={() => void includeAllProducts()}
            >
              <Button disabled={!canEdit || excludedProductIds.size === 0}>
                Include all
              </Button>
            </Popconfirm>
            <Input
              allowClear
              placeholder="Search products…"
              value={productSearch}
              onChange={(event) => {
                setProductSearch(event.target.value);
                setProductPage(1);
              }}
              style={{ width: 220 }}
            />
            <Select
              value={sourceFilter}
              onChange={setSourceFilter}
              className="min-w-40"
              options={[
                { value: "all", label: "All sources" },
                { value: "inherited", label: "Inherited" },
                { value: "override", label: "Overridden" },
                { value: "unset", label: "Not configured" },
              ]}
            />
          </Space>
        }
      >
        <Table
          rowKey="productId"
          columns={columns}
          dataSource={visibleProducts}
          loading={productsQuery.isLoading || productsQuery.isFetching || exclusionsQuery.isLoading}
          pagination={{
            current: productPage,
            pageSize: productPageSize,
            total: productTotal,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setProductPage(nextPage);
              setProductPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Card
        title={`Derived categories (${categoriesQuery.data?.length ?? 0})`}
        loading={categoriesQuery.isLoading || categoriesQuery.isFetching}
      >
        {categoriesQuery.data && categoriesQuery.data.length > 0 ? (
          <Space wrap>
            {categoriesQuery.data.map((category) => (
              <Button
                key={category.id}
                type="link"
                onClick={() => navigate(`/franchise-categories/${category.id}`, {
                  state: { category, storefrontBrandId, storefrontBrandName: brand.name },
                })}
              >
                {category.name} ({category.productCount})
              </Button>
            ))}
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No categories for the included products" />
        )}
      </Card>

      <Drawer
        open={editingProduct !== null}
        width={480}
        title={`Edit storefront price — ${pricing?.productName ?? editingProduct?.productName ?? ""}`}
        onClose={() => setEditingProduct(null)}
        extra={
          <Button
            type="primary"
            loading={savingProduct}
            disabled={!canEdit || pricingLoading}
            onClick={() => void saveProductPricing()}
          >
            Save product
          </Button>
        }
      >
        {pricingLoading ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : pricing ? (
          <>
            <Descriptions
              column={1}
              size="small"
              className="mb-4"
              items={[
                {
                  key: "base",
                  label: retailPriceIsPrimary ? "Retail price (primary)" : "Product price",
                  children: primaryPricingBase === null
                    ? "—"
                    : formatStorefrontNaira(primaryPricingBase),
                },
                {
                  key: "brand",
                  label: "Brand default storefront",
                  children:
                    brandDefaultStorefront === null || brand.storefrontPriceMargin <= 0
                      ? "Not configured"
                      : retailPriceIsPrimary
                        ? `${formatStorefrontNaira(brandDefaultStorefront)} (retail price)`
                        : `${formatStorefrontNaira(brandDefaultStorefront)} (${brand.storefrontPriceMargin.toFixed(2)}%)`,
                },
                {
                  key: "current",
                  label: "Current source",
                  children: sourceTag(productMarginSource(pricing), pricing.effectiveMargin),
                },
              ]}
            />

            <Form layout="vertical">
              <Form.Item
                label="Storefront price"
                required
                extra={
                  retailPriceIsPrimary
                    ? "RetailPriceInNaira is currently the final storefront price. This margin is only used if retail price becomes unavailable."
                    : "Only this field is editable. Margin is calculated automatically."
                }
              >
                <InputNumber
                  min={Math.round(primaryPricingBase ?? 0)}
                  precision={0}
                  addonBefore="₦"
                  className="w-full"
                  disabled={revertToBrand || !canEdit}
                  value={revertToBrand ? brandDefaultStorefront : draftStorefront}
                  onChange={(value) => {
                    setRevertToBrand(false);
                    setDraftStorefront(value);
                  }}
                  onBlur={(e) => {
                    // Antd InputNumber can keep a “pending” typed value until blur.
                    // On Enter, the control may reset to the last controlled value if we didn't commit.
                    const raw = (e.target as HTMLInputElement).value;
                    const next = raw === "" ? null : Number(raw.replace(/,/g, ""));
                    setRevertToBrand(false);
                    setDraftStorefront(next);
                  }}
                />
              </Form.Item>
            </Form>

            <Alert
              className="mb-4"
              type={revertToBrand ? "warning" : "info"}
              showIcon
              message="Derived margin"
              description={
                revertToBrand
                  ? brand.storefrontPriceMargin <= 0
                    ? "Reverting uses the brand margin (currently not set)."
                    : `Will revert to brand margin → storefront ${formatStorefrontNaira(brandDefaultStorefront!)} · ${brand.storefrontPriceMargin.toFixed(2)}%`
                  : derivedMarkup === null
                    ? "Enter a storefront price at or above the product price."
                    : `${formatStorefrontNaira(Math.round(pricing.priceInNaira))} → ${formatStorefrontNaira(draftStorefront!)} = ${derivedMarkup.toFixed(2)}% margin`
              }
            />

            <Button
              danger
              block
              disabled={!canEdit || productMarginSource(pricing) !== "override"}
              onClick={() => {
                setRevertToBrand(true);
                setDraftStorefront(brandDefaultStorefront);
              }}
            >
              Revert to brand margin
            </Button>

            {editableVariants.length > 0 && (
              <>
                <Divider />
                <Typography.Title level={5}>Variant margins</Typography.Title>
                <Typography.Text type="secondary" className="mb-3 block">
                  Override storefront price per variant when needed.
                </Typography.Text>
                <div className="space-y-4">
                  {editableVariants.map((variant, index) => {
                    const draft = variantDrafts[variant.id];
                    const derived =
                      draft !== null && draft !== undefined
                        ? storefrontMarkupPercent(Math.round(variant.priceInNaira), draft)
                        : null;
                    return (
                      <Card key={variant.id} size="small" title={variantLabel(variant, index)}>
                        <div className="mb-2 text-xs text-muted-foreground">
                          Base {formatStorefrontNaira(variant.priceInNaira)}
                          {variantPricing[variant.id]
                            ? ` · effective ${variantPricing[variant.id]!.effectiveMargin.toFixed(2)}%`
                            : ""}
                        </div>
                        <Space.Compact className="w-full">
                          <InputNumber
                            min={Math.round(variant.priceInNaira)}
                            precision={0}
                            addonBefore="₦"
                            className="w-full"
                            disabled={!canEdit}
                            value={draft}
                            onChange={(value) =>
                              setVariantDrafts((prev) => ({ ...prev, [variant.id]: value }))
                            }
                            onBlur={(e) => {
                              const raw = (e.target as HTMLInputElement).value;
                              const next = raw === "" ? null : Number(raw.replace(/,/g, ""));
                              setVariantDrafts((prev) => ({ ...prev, [variant.id]: next }));
                            }}
                          />
                          <Button
                            type="primary"
                            disabled={!canEdit || draft === null || draft === undefined}
                            loading={savingVariantId === variant.id}
                            onClick={() => void saveVariantPricing(variant)}
                          >
                            Save
                          </Button>
                        </Space.Compact>
                        {derived !== null && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Derived margin {derived.toFixed(2)}%
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
