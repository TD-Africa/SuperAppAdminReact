import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Progress,
  Segmented,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AppstoreOutlined, ArrowLeftOutlined, SearchOutlined, ShopOutlined } from "@ant-design/icons";
import {
  addStorefrontBrand,
  getAllBrands,
  getBrandProducts,
  getStorefrontBrands,
  getStorefrontEligibleBrandProducts,
  setStorefrontBrandExcludedProducts,
  type BrandDto,
} from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import { effectiveProductPrice, productThumbnail } from "@/lib/productHelpers";
import type { ApiResult, PaginationResponse, ProductReturnDto } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency } from "@/lib/utils";

type AddedFilter = "not-added" | "added" | "all";

interface BrandFormValues {
  name: string;
  brandImageUrl: string;
  dynamicsId: string;
  storefrontPriceMargin: number;
  isActive: boolean;
}

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

async function loadAllPages(
  fetchPage: (page: { PageSize: number; PageNumber: number }) => Promise<ApiResult<PaginationResponse<ProductReturnDto>>>,
) {
  const products: ProductReturnDto[] = [];
  const pageSize = 100;
  let pageNumber = 1;
  while (true) {
    const res = await fetchPage({ PageSize: pageSize, PageNumber: pageNumber });
    if (!res.status) throw new Error(res.message ?? "Failed to load products for this brand");
    const page = res.data?.data ?? [];
    products.push(...page);
    if (page.length === 0 || products.length >= Number(res.data?.count ?? products.length)) {
      return products;
    }
    pageNumber += 1;
  }
}

function findExistingStorefrontBrand(
  source: BrandDto,
  storefrontBrands: StorefrontBrandAdminDto[],
) {
  // Older storefront-brand records may not have a catalog brand ID, so also
  // match on name and Dynamics ID.
  return storefrontBrands.find(
    (existing) =>
      existing.catalogBrandIds?.includes(source.id)
      || existing.brandId === source.id
      || normalize(existing.name) === normalize(source.name)
      || (Boolean(source.dynamicsId) && normalize(existing.dynamicsId) === normalize(source.dynamicsId)),
  );
}

export default function FranchiseAddStorefrontBrandPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canEditBrands = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const returnTo = searchParams.get("from") === "brands" ? "/franchise-brands" : "/franchise-products";

  const [step, setStep] = useState<"pick" | "complete">("pick");
  const [search, setSearch] = useState("");
  const [addedFilter, setAddedFilter] = useState<AddedFilter>("not-added");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  const catalogBrandsQuery = useQuery({
    queryKey: ["catalog-brands-admin", "add-storefront-brand"],
    queryFn: async () => {
      const all: BrandDto[] = [];
      const pageSize = 500;
      let pageNumber = 1;
      while (true) {
        const res = await getAllBrands({ PageSize: pageSize, PageNumber: pageNumber });
        if (!res.status) throw new Error(res.message ?? "Failed to load SuperApp brands");
        all.push(...(res.data?.data ?? []));
        if (pageNumber * pageSize >= Number(res.data?.count ?? 0)) return all;
        pageNumber += 1;
      }
    },
  });

  const storefrontBrandsQuery = useQuery({
    queryKey: ["storefront", "brands-admin-all"],
    queryFn: async () => {
      const all: StorefrontBrandAdminDto[] = [];
      const pageSize = 500;
      let pageNumber = 1;
      while (true) {
        const res = await getStorefrontBrands({ PageSize: pageSize, PageNumber: pageNumber });
        if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
        all.push(...(res.data?.data ?? []));
        if (pageNumber * pageSize >= Number(res.data?.count ?? 0)) return all;
        pageNumber += 1;
      }
    },
  });

  const existingByCatalogId = useMemo(() => {
    const map = new Map<string, StorefrontBrandAdminDto>();
    const storefrontBrands = storefrontBrandsQuery.data ?? [];
    for (const brand of catalogBrandsQuery.data ?? []) {
      const existing = findExistingStorefrontBrand(brand, storefrontBrands);
      if (existing) map.set(brand.id, existing);
    }
    return map;
  }, [catalogBrandsQuery.data, storefrontBrandsQuery.data]);

  const rows = useMemo(() => {
    const term = normalize(search);
    return (catalogBrandsQuery.data ?? [])
      .filter((brand) => {
        const added = existingByCatalogId.has(brand.id);
        if (addedFilter === "not-added" && added) return false;
        if (addedFilter === "added" && !added) return false;
        if (!term) return true;
        return normalize(brand.name).includes(term) || normalize(brand.dynamicsId).includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogBrandsQuery.data, existingByCatalogId, addedFilter, search]);

  const selectedBrands = useMemo(
    () =>
      selectedIds
        .map((id) => catalogBrandsQuery.data?.find((brand) => brand.id === id))
        .filter((brand): brand is BrandDto => Boolean(brand)),
    [selectedIds, catalogBrandsQuery.data],
  );

  function toggleSelected(id: string, on: boolean) {
    setSelectedIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function finish(ids: string[]) {
    await queryClient.invalidateQueries({ queryKey: ["storefront"] });
    if (returnTo === "/franchise-products" && ids.length > 0) {
      navigate(`/franchise-products?open=${ids.join(",")}`);
    } else {
      navigate(returnTo);
    }
  }

  function advance(createdId: string | null) {
    const nextCreated = createdId ? [...createdIds, createdId] : createdIds;
    setCreatedIds(nextCreated);
    if (currentIndex + 1 >= selectedBrands.length) {
      void finish(nextCreated);
      return;
    }
    setCurrentIndex((i) => i + 1);
  }

  const columns: TableColumnsType<BrandDto> = [
    {
      title: "",
      key: "image",
      width: 64,
      render: (_, brand) => (
        <Avatar
          shape="square"
          src={brand.brandImageUrl || undefined}
          icon={!brand.brandImageUrl ? <ShopOutlined /> : undefined}
        />
      ),
    },
    {
      title: "Brand",
      key: "name",
      render: (_, brand) => <div className="font-medium">{brand.name}</div>,
    },
    {
      title: "Add",
      key: "add",
      width: 110,
      render: (_, brand) => {
        const existing = existingByCatalogId.get(brand.id);
        return (
          <Switch
            checked={Boolean(existing) || selectedIds.includes(brand.id)}
            disabled={Boolean(existing) || !canEditBrands}
            onChange={(on) => toggleSelected(brand.id, on)}
          />
        );
      },
    },
    {
      title: "Storefront",
      key: "storefront",
      width: 220,
      render: (_, brand) => {
        const existing = existingByCatalogId.get(brand.id);
        if (!existing) return <Typography.Text type="secondary">Not added</Typography.Text>;
        return (
          <Space size={6}>
            <Tag color="success">Already added</Tag>
            <Button
              type="link"
              size="small"
              className="!px-0"
              onClick={() => navigate(`/franchise-products?open=${existing.id}`)}
            >
              Open
            </Button>
          </Space>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, brand) => (
        <Tag color={brand.isActive ? "success" : "default"}>{brand.isActive ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Dynamics ID",
      key: "dynamicsId",
      width: 180,
      render: (_, brand) => (
        <span className="text-xs text-muted-foreground">{brand.dynamicsId || "—"}</span>
      ),
    },
  ];

  const currentBrand = selectedBrands[currentIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            className="!px-0"
            onClick={() => (createdIds.length > 0 ? void finish(createdIds) : navigate(returnTo))}
          >
            Back
          </Button>
          <Typography.Title level={3} className="!m-0">
            Add storefront brands
          </Typography.Title>
          <Typography.Text type="secondary">
            {step === "pick"
              ? "Switch on the SuperApp brands you want to sell on the storefront, then continue to set each one up."
              : "Set up each selected brand. Each brand is saved when you move to the next one."}
          </Typography.Text>
        </div>
      </div>

      {step === "pick" ? (
        <>
          <Card styles={{ body: { padding: 16 } }}>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                allowClear
                className="min-w-[260px] flex-1"
                placeholder="Search brand name or Dynamics ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<SearchOutlined className="text-muted-foreground" />}
              />
              <Segmented<AddedFilter>
                value={addedFilter}
                onChange={setAddedFilter}
                options={[
                  { label: "Not added", value: "not-added" },
                  { label: "Already added", value: "added" },
                  { label: "All", value: "all" },
                ]}
              />
            </div>
          </Card>

          <Card styles={{ body: { padding: 0 } }}>
            <Table<BrandDto>
              rowKey="id"
              columns={columns}
              dataSource={rows}
              loading={catalogBrandsQuery.isLoading || storefrontBrandsQuery.isLoading}
              locale={{ emptyText: <Empty description="No brands match" /> }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
            />
          </Card>

          <div className="sticky bottom-0 z-10 rounded-lg border bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-end gap-3">
              <Typography.Text type="secondary">
                {selectedIds.length === 0
                  ? "No brands selected"
                  : `${selectedIds.length} brand${selectedIds.length === 1 ? "" : "s"} selected`}
              </Typography.Text>
              {selectedIds.length > 0 && (
                <Button onClick={() => setSelectedIds([])}>Clear</Button>
              )}
              <Button
                type="primary"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  setCurrentIndex(0);
                  setStep("complete");
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </>
      ) : currentBrand ? (
        <>
          <Card styles={{ body: { padding: 16 } }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Typography.Text strong>
                Brand {currentIndex + 1} of {selectedBrands.length}: {currentBrand.name}
              </Typography.Text>
              <Progress
                className="!m-0 max-w-[320px] flex-1"
                percent={Math.round((currentIndex / selectedBrands.length) * 100)}
                showInfo={false}
              />
            </div>
          </Card>

          <BrandSetupForm
            key={currentBrand.id}
            source={currentBrand}
            storefrontBrands={storefrontBrandsQuery.data ?? []}
            isLast={currentIndex + 1 >= selectedBrands.length}
            canGoBack={currentIndex === 0 && createdIds.length === 0}
            onBack={() => setStep("pick")}
            onSkip={() => advance(null)}
            onSaved={(id) => advance(id)}
          />
        </>
      ) : null}
    </div>
  );
}

interface BrandSetupFormProps {
  source: BrandDto;
  storefrontBrands: StorefrontBrandAdminDto[];
  isLast: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onSkip: () => void;
  onSaved: (storefrontBrandId: string) => void;
}

function BrandSetupForm({
  source,
  storefrontBrands,
  isLast,
  canGoBack,
  onBack,
  onSkip,
  onSaved,
}: BrandSetupFormProps) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<BrandFormValues>();
  const [saving, setSaving] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const productsQuery = useQuery({
    queryKey: ["storefront", "add-brand-preview-products", source.id],
    queryFn: async () => {
      const [all, eligible] = await Promise.all([
        loadAllPages((page) => getBrandProducts(source.id, page)),
        loadAllPages((page) => getStorefrontEligibleBrandProducts(source.id, page)),
      ]);
      return { all, eligible };
    },
  });

  useEffect(() => {
    if (productsQuery.data) {
      setSelectedProductIds(productsQuery.data.eligible.map((product) => product.id));
    }
  }, [productsQuery.data]);

  async function save() {
    const values = await form.validateFields();
    const name = normalize(values.name);
    const dynamicsId = normalize(values.dynamicsId);
    const duplicate = storefrontBrands.some(
      (existing) =>
        normalize(existing.name) === name
        || (dynamicsId.length > 0 && normalize(existing.dynamicsId) === dynamicsId),
    );
    if (duplicate) {
      message.error("A storefront brand with this name or Dynamics ID already exists");
      return;
    }

    setSaving(true);
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

      // The new storefront brand includes every catalog product of the source
      // brand, so anything not selected — including ineligible products the
      // picker never showed — must be excluded explicitly.
      const excluded = (productsQuery.data?.all ?? [])
        .map((product) => product.id)
        .filter((id) => !selectedProductIds.includes(id));
      if (excluded.length > 0) {
        const exclusionRes = await setStorefrontBrandExcludedProducts(res.data.id, excluded);
        if (!exclusionRes.status) {
          message.error(
            `${values.name} was created, but product exclusions could not be saved: ${exclusionRes.message ?? "try again"}`,
          );
        } else {
          message.success(`${values.name} added`);
        }
      } else {
        message.success(`${values.name} added`);
      }
      onSaved(res.data.id);
    } finally {
      setSaving(false);
    }
  }

  const products = productsQuery.data?.eligible ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
      <Card title="Storefront brand details">
        <Form<BrandFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            name: source.name,
            brandImageUrl: source.brandImageUrl ?? "",
            dynamicsId: source.dynamicsId ?? "",
            storefrontPriceMargin: 0,
            isActive: true,
          }}
        >
          <Form.Item
            name="name"
            label="Storefront brand name"
            rules={[{ required: true, message: "Enter a storefront brand name" }]}
          >
            <Input />
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
      </Card>

      <Card
        title={`Products to add (${selectedProductIds.length} of ${products.length} selected)`}
        extra={
          <Typography.Text type="secondary">Uncheck products you do not want this brand to sell.</Typography.Text>
        }
        styles={{ body: { padding: 0 } }}
      >
        {productsQuery.isError ? (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message={
                productsQuery.error instanceof Error
                  ? productsQuery.error.message
                  : "Unable to load products for this brand"
              }
            />
          </div>
        ) : (
          <Table<ProductReturnDto>
            size="small"
            rowKey="id"
            loading={productsQuery.isLoading || productsQuery.isFetching}
            dataSource={products}
            pagination={false}
            scroll={{ y: 480 }}
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
      </Card>

      <div className="sticky bottom-0 z-10 rounded-lg border bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:col-span-2">
        <div className="flex items-center justify-end gap-3">
          {canGoBack && <Button onClick={onBack}>Back to brands page</Button>}
          <Button onClick={onSkip} disabled={saving}>
            Skip
          </Button>
          <Button
            type="primary"
            loading={saving}
            disabled={productsQuery.isLoading || productsQuery.isError}
            onClick={() => void save()}
          >
            {isLast ? "Save & finish" : "Save & next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
