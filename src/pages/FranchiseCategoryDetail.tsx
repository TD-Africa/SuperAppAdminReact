import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
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
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  addProductsToStorefrontCategory,
  getProductsByStorefrontCategory,
  getStorefrontCategoryById,
  getStorefrontProducts,
  removeProductsFromStorefrontCategory,
  updateStorefrontCategory,
} from "@/lib/storefrontApi";
import {
  formatStorefrontNaira,
  type StorefrontCategoryDto,
  type StorefrontCategoryProductDto,
} from "@/lib/storefrontTypes";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function FranchiseCategoryDetailPage() {
  const { storefrontCategoryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const categoryFromNav = (location.state as { category?: StorefrontCategoryDto } | null)?.category;

  const [draftName, setDraftName] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(20);
  const [addOpen, setAddOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearch, 350);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!category) return;
    setDraftName(category.name);
    setDraftActive(category.isActive);
  }, [category]);

  const productsQuery = useQuery({
    queryKey: [
      "storefront",
      "category-products",
      storefrontCategoryId,
      productPage,
      productPageSize,
    ],
    queryFn: async () => {
      if (!storefrontCategoryId) return null;
      const res = await getProductsByStorefrontCategory(storefrontCategoryId, {
        PageSize: productPageSize,
        PageNumber: productPage,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load products");
      return res.data;
    },
    enabled: Boolean(storefrontCategoryId),
  });

  const products = productsQuery.data?.data ?? [];
  const productTotal = Number(productsQuery.data?.count ?? 0);
  const assignedIds = useMemo(
    () => new Set(products.map((p) => p.productId)),
    [products],
  );

  const catalogSearchQuery = useQuery({
    queryKey: ["storefront", "products-for-category", debouncedProductSearch],
    queryFn: async () => {
      const res = await getStorefrontProducts({
        PageSize: 30,
        PageNumber: 1,
        SearchString: debouncedProductSearch.trim() || undefined,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to search products");
      return res.data?.data ?? [];
    },
    enabled: addOpen,
  });

  const addOptions = useMemo(() => {
    return (catalogSearchQuery.data ?? [])
      .filter((p) => !assignedIds.has(p.productId))
      .map((p) => ({
        value: p.productId,
        label: `${p.productName}${p.brandName ? ` · ${p.brandName}` : ""}`,
      }));
  }, [catalogSearchQuery.data, assignedIds]);

  async function saveCategory() {
    if (!storefrontCategoryId || !draftName.trim()) return;
    setSaving(true);
    try {
      const res = await updateStorefrontCategory(storefrontCategoryId, {
        name: draftName.trim(),
        isActive: draftActive,
      });
      if (!res.status || !res.data) {
        message.error(res.message ?? "Failed to update category");
        return;
      }
      message.success(res.message ?? "Category updated");
      queryClient.setQueryData(["storefront", "category", storefrontCategoryId], res.data);
      void queryClient.invalidateQueries({ queryKey: ["storefront", "categories-admin"] });
    } finally {
      setSaving(false);
    }
  }

  async function addProducts() {
    if (!storefrontCategoryId || selectedProductIds.length === 0) return;
    setAdding(true);
    try {
      const res = await addProductsToStorefrontCategory({
        storefrontCategoryId,
        productIds: selectedProductIds,
      });
      if (!res.status) {
        message.error(res.message ?? "Failed to add products");
        return;
      }
      message.success(res.message ?? "Products added");
      setAddOpen(false);
      setSelectedProductIds([]);
      setProductSearch("");
      void productsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["storefront", "categories-admin"] });
    } finally {
      setAdding(false);
    }
  }

  async function removeProduct(productId: string) {
    if (!storefrontCategoryId) return;
    setRemovingId(productId);
    try {
      const res = await removeProductsFromStorefrontCategory({
        storefrontCategoryId,
        productIds: [productId],
      });
      if (!res.status) {
        message.error(res.message ?? "Failed to remove product");
        return;
      }
      message.success(res.message ?? "Product removed");
      void productsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["storefront", "categories-admin"] });
    } finally {
      setRemovingId(null);
    }
  }

  if (categoryQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  if (!category) {
    return (
      <Empty description="Storefront category not found">
        <Button onClick={() => navigate("/franchise-categories")}>Back to categories</Button>
      </Empty>
    );
  }

  const columns: TableColumnsType<StorefrontCategoryProductDto> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (name: string, product) => (
        <div>
          <div className="font-medium">{name}</div>
          <Typography.Text type="secondary" className="text-xs">
            {product.dynamicsId || product.productId}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Price (NGN)",
      dataIndex: "priceInNaira",
      width: 130,
      align: "right",
      render: (price: number) =>
        price > 0 ? formatStorefrontNaira(price) : "—",
    },
    {
      title: "Margin",
      dataIndex: "storefrontPriceMargin",
      width: 100,
      align: "right",
      render: (margin: number) =>
        margin > 0 ? `${margin.toFixed(2)}%` : <Tag color="warning">Not set</Tag>,
    },
    {
      title: "Storefront price",
      dataIndex: "storefrontPrice",
      width: 140,
      align: "right",
      render: (price: number) =>
        price > 0 ? (
          <span className="font-medium">{formatStorefrontNaira(price)}</span>
        ) : (
          "—"
        ),
    },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 90,
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 100,
      render: (_, product) =>
        canEdit ? (
          <Popconfirm
            title="Remove product from this category?"
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => void removeProduct(product.productId)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={removingId === product.productId}
            />
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/franchise-categories")}>
          All categories
        </Button>
      </Space>

      <div>
        <Typography.Title level={3} className="!m-0">
          {category.name}
        </Typography.Title>
        <Typography.Text type="secondary">
          Edit category settings and manage assigned products.
        </Typography.Text>
      </div>

      <Card title="Category settings">
        <Form layout="vertical" className="max-w-xl">
          <Form.Item label="Name" required>
            <Input
              value={draftName}
              disabled={!canEdit}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Active">
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
              loading={saving}
              disabled={!canEdit || !draftName.trim()}
              onClick={() => void saveCategory()}
            >
              Save category
            </Button>
            <Button
              disabled={!canEdit}
              onClick={() => {
                setDraftName(category.name);
                setDraftActive(category.isActive);
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
          canEdit ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedProductIds([]);
                setProductSearch("");
                setAddOpen(true);
              }}
            >
              Add products
            </Button>
          ) : null
        }
      >
        <Table
          rowKey="productId"
          columns={columns}
          dataSource={products}
          loading={productsQuery.isLoading || productsQuery.isFetching}
          locale={{ emptyText: <Empty description="No products in this category" /> }}
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

      <Modal
        open={addOpen}
        title="Add products to category"
        onCancel={() => setAddOpen(false)}
        onOk={() => void addProducts()}
        okButtonProps={{ disabled: selectedProductIds.length === 0 }}
        confirmLoading={adding}
        destroyOnClose
      >
        <div className="space-y-3 pt-2">
          <Input
            allowClear
            placeholder="Search storefront products…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          <Select
            mode="multiple"
            className="w-full"
            placeholder="Select products"
            value={selectedProductIds}
            onChange={setSelectedProductIds}
            options={addOptions}
            loading={catalogSearchQuery.isFetching}
            optionFilterProp="label"
            showSearch
          />
        </div>
      </Modal>
    </div>
  );
}
