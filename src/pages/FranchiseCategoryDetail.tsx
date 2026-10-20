import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  getStorefrontBrandProductsForAdmin,
  getStorefrontBrands,
  getStorefrontCategoryById,
} from "@/lib/storefrontApi";
import {
  formatStorefrontNaira,
  pickDisplayVariant,
  type StorefrontCategoryDto,
  type StorefrontProductDto,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function FranchiseCategoryDetailPage() {
  const { storefrontCategoryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();
  const navigationState = (location.state as {
    category?: StorefrontCategoryDto;
    storefrontBrandId?: string;
    storefrontBrandName?: string;
  } | null) ?? {};
  const categoryFromNav = navigationState.category;
  const storefrontBrandId = navigationState.storefrontBrandId;
  const storefrontBrandName = navigationState.storefrontBrandName;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const categoryQuery = useQuery({
    queryKey: ["storefront", "category", storefrontCategoryId],
    queryFn: async () => {
      if (categoryFromNav && categoryFromNav.id === storefrontCategoryId) return categoryFromNav;
      if (!storefrontCategoryId) return null;
      const res = await getStorefrontCategoryById(storefrontCategoryId);
      if (!res.status) throw new Error(res.message ?? "Failed to load category");
      return res.data;
    },
    enabled: Boolean(storefrontCategoryId),
  });

  const category = categoryQuery.data ?? null;

  const productsQuery = useQuery({
    queryKey: [
      "storefront",
      "category-products-admin",
      storefrontCategoryId,
      storefrontBrandId,
      debouncedSearch,
    ],
    queryFn: async () => {
      if (!storefrontCategoryId) return { data: [] as StorefrontProductDto[], count: 0, pageNumber: 1 };

      let brandRows: Array<{ id: string; name: string }>;
      if (storefrontBrandId) {
        brandRows = [{ id: storefrontBrandId, name: storefrontBrandName ?? "Storefront brand" }];
      } else {
        const brandRes = await getStorefrontBrands({ PageSize: 500, PageNumber: 1, isActive: true });
        if (!brandRes.status) throw new Error(brandRes.message ?? "Failed to load storefront brands");
        brandRows = (brandRes.data?.data ?? []).map((brand) => ({ id: brand.id, name: brand.name }));
      }

      const productsByBrand = await Promise.all(
        brandRows.map(async (brand) => {
          const products: StorefrontProductDto[] = [];
          let productPage = 1;
          let productCount = Number.POSITIVE_INFINITY;
          while (products.length < productCount) {
            const res = await getStorefrontBrandProductsForAdmin(brand.id, {
              PageSize: 100,
              PageNumber: productPage,
              SearchString: debouncedSearch.trim() || undefined,
            });
            if (!res.status) throw new Error(res.message ?? `Failed to load products for ${brand.name}`);
            const rows = res.data?.data ?? [];
            products.push(...rows);
            productCount = Number(res.data?.count ?? products.length);
            if (rows.length === 0) break;
            productPage += 1;
          }
          return products;
        }),
      );

      const unique = new Map<string, StorefrontProductDto>();
      for (const products of productsByBrand) {
        for (const product of products) {
          if (!product.isStorefrontPublished || product.isExcluded) continue;
          if (!(product.categoryIds ?? []).includes(storefrontCategoryId)) continue;
          unique.set(product.productId, product);
        }
      }

      const all = [...unique.values()].sort((left, right) =>
        left.productName.localeCompare(right.productName),
      );
      return {
        data: all,
        count: all.length,
        pageNumber: 1,
      };
    },
    enabled: Boolean(category),
  });

  useEffect(() => {
    if (!productsQuery.isError) return;
    message.error(
      productsQuery.error instanceof Error
        ? productsQuery.error.message
        : "Unable to load eligible category products.",
    );
  }, [productsQuery.isError, productsQuery.error, message]);

  const eligibleProducts = productsQuery.data?.data ?? [];
  const products = eligibleProducts.slice((page - 1) * pageSize, page * pageSize);

  const columns: TableColumnsType<StorefrontProductDto> = [
    {
      title: "Product",
      key: "product",
      render: (_, product) => (
        <div>
          <div className="font-medium">{product.productName}</div>
          <Typography.Text type="secondary" className="text-xs">
            {product.slug ?? product.productId}
          </Typography.Text>
        </div>
      ),
    },
    { title: "Brand", dataIndex: "brandName", width: 180, render: (value) => value ?? "—" },
    {
      title: "Storefront price",
      key: "price",
      width: 160,
      align: "right",
      render: (_, product) => {
        const variant = pickDisplayVariant(product);
        return variant && variant.storefrontPrice > 0
          ? formatStorefrontNaira(variant.storefrontPrice)
          : "—";
      },
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: () => <Tag color="success">Eligible</Tag>,
    },
  ];

  if (categoryQuery.isLoading) {
    return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  }

  if (!category) {
    return (
      <Empty description="Storefront category not found">
        <Button onClick={() => navigate("/franchise-categories")}>Back to categories</Button>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(storefrontBrandId ? `/franchise-brands/${storefrontBrandId}` : "/franchise-categories")}
      >
        {storefrontBrandId ? "Back to brand" : "All categories"}
      </Button>

      <div>
        <Typography.Title level={3} className="!m-0">{category.name}</Typography.Title>
        <Typography.Text type="secondary">
          Mirrored from SuperApp. Product membership follows the source category and the configured storefront brands.
          {storefrontBrandName ? ` Showing products included in ${storefrontBrandName}.` : ""}
        </Typography.Text>
      </div>

      <Card title="Source category">
        <Space direction="vertical">
          <Typography.Text>SuperApp category ID: <Typography.Text code>{category.superAppCategoryId ?? category.id}</Typography.Text></Typography.Text>
          <Typography.Text type="secondary">
            Storefront category ID: <Typography.Text code>{category.id}</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            Category names, IDs, and product relationships are synchronized from SuperApp. Remove products from a storefront brand to exclude them globally for that brand.
          </Typography.Text>
        </Space>
      </Card>

      <Card
        title={`Eligible products (${eligibleProducts.length})`}
        extra={
          <Input
            allowClear
            placeholder="Search products…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            style={{ width: 240 }}
          />
        }
      >
        <Table<StorefrontProductDto>
          rowKey="productId"
          columns={columns}
          dataSource={products}
          loading={productsQuery.isLoading || productsQuery.isFetching}
          locale={{ emptyText: <Empty description="No eligible products in this category" /> }}
          pagination={{
            current: page,
            pageSize,
            total: eligibleProducts.length,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>
    </div>
  );
}
