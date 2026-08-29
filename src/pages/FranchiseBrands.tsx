import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
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
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import {
  addStorefrontBrand,
  deleteStorefrontBrand,
  getStorefrontBrands,
} from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import type { BrandReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

function marginLabel(margin: number) {
  if (margin <= 0) return <Tag color="warning">Not set</Tag>;
  return `${margin.toFixed(2)}%`;
}

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const debouncedCatalogSearch = useDebouncedValue(catalogSearch, 350);
  const [form] = Form.useForm<{
    brandId: string;
    storefrontPriceMargin: number;
    isActive: boolean;
  }>();

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      isActive: isActive === ALL ? undefined : isActive === "true",
    }),
    [pageSize, page, debouncedSearch, isActive],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["storefront", "brands-admin", queryParams],
    queryFn: async () => {
      const res = await getStorefrontBrands(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
      return res.data;
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["catalog-brands-for-storefront", debouncedCatalogSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("PageSize", "50");
      params.set("PageNumber", "1");
      if (debouncedCatalogSearch.trim()) params.set("SearchString", debouncedCatalogSearch.trim());
      params.set("isActive", "true");
      const res = await apiGet<PaginationResponse<BrandReturnDTO>>(
        `brand/getAllBrands?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load catalog brands");
      return res.data?.data ?? [];
    },
    enabled: addOpen,
  });

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? error.message : "Unable to load storefront brands.",
      );
    }
  }, [isError, error, message]);

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);
  const existingBrandIds = useMemo(
    () => new Set(rows.map((b) => b.brandId)),
    [rows],
  );

  const catalogOptions = useMemo(() => {
    return (catalogQuery.data ?? [])
      .filter((b) => !existingBrandIds.has(b.id))
      .map((b) => ({ value: b.id, label: b.name, brand: b }));
  }, [catalogQuery.data, existingBrandIds]);

  async function createBrand() {
    const values = await form.validateFields();
    const selected = catalogQuery.data?.find((b) => b.id === values.brandId);
    if (!selected) {
      message.error("Select a catalog brand");
      return;
    }
    setSaving(true);
    try {
      const res = await addStorefrontBrand({
        brandId: selected.id,
        brandImageUrl: selected.brandImageUrl ?? "",
        name: selected.name,
        dynamicsId: selected.dynamicsId ?? "",
        storefrontPriceMargin: values.storefrontPriceMargin,
        isActive: values.isActive,
      });
      if (!res.status) {
        message.error(res.message ?? "Failed to add storefront brand");
        return;
      }
      message.success(res.message ?? "Storefront brand added");
      setAddOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands"] });
    } finally {
      setSaving(false);
    }
  }

  async function removeBrand(brand: StorefrontBrandAdminDto) {
    const res = await deleteStorefrontBrand(brand.id);
    if (!res.status) {
      message.error(res.message ?? "Failed to delete brand");
      return;
    }
    message.success(res.message ?? "Brand deleted");
    void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
    void queryClient.invalidateQueries({ queryKey: ["storefront", "brands"] });
  }

  const columns: TableColumnsType<StorefrontBrandAdminDto> = [
    {
      title: "",
      dataIndex: "brandImageUrl",
      width: 64,
      render: (url: string | null, brand) => (
        <Avatar
          shape="square"
          src={url ?? undefined}
          icon={!url ? <ShopOutlined /> : undefined}
        >
          {!url ? brand.name.slice(0, 1) : null}
        </Avatar>
      ),
    },
    {
      title: "Brand",
      dataIndex: "name",
      render: (name: string) => <span className="font-medium">{name}</span>,
    },
    {
      title: "Margin",
      dataIndex: "storefrontPriceMargin",
      width: 120,
      render: (margin: number) => marginLabel(margin),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      width: 140,
      render: (value: string) => (
        <span className="text-xs text-muted-foreground">{value || "—"}</span>
      ),
    },
    {
      title: "Created",
      dataIndex: "dateCreated",
      width: 120,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 260,
      render: (_, brand) => (
        <Space size={4}>
          <Button
            type="primary"
            size="small"
            icon={<SettingOutlined />}
            onClick={() =>
              navigate(`/franchise-brands/${brand.id}`, { state: { brand } })
            }
          >
            Set margin
          </Button>
          <Button
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() =>
              navigate(
                `/franchise-products?brandId=${encodeURIComponent(brand.id)}&brand=${encodeURIComponent(brand.name)}`,
              )
            }
          >
            Products
          </Button>
          {canEdit && (
            <Popconfirm
              title="Delete this storefront brand?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => void removeBrand(brand)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Franchise brands
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage storefront brands and default price margins. TD Customers pay product price + margin.
          </Typography.Text>
        </div>
        {canEdit && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.setFieldsValue({ storefrontPriceMargin: 0, isActive: true });
              setCatalogSearch("");
              setAddOpen(true);
            }}
          >
            Add brand
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap gap-3">
          <Input
            allowClear
            placeholder="Search brand…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            prefix={<ShopOutlined className="text-muted-foreground" />}
            className="min-w-[220px] flex-1"
          />
          <Select
            value={isActive}
            onChange={(value) => {
              setIsActive(value);
              setPage(1);
            }}
            className="min-w-[140px]"
            options={[
              { value: ALL, label: "All statuses" },
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontBrandAdminDto>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isLoading || isFetching}
          locale={{ emptyText: <Empty description="No storefront brands" /> }}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            hideOnSinglePage: totalItems <= pageSize,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Modal
        open={addOpen}
        title="Add storefront brand"
        onCancel={() => setAddOpen(false)}
        onOk={() => void createBrand()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="brandId"
            label="Catalog brand"
            rules={[{ required: true, message: "Select a brand" }]}
          >
            <Select
              showSearch
              placeholder="Search catalog brands…"
              options={catalogOptions}
              loading={catalogQuery.isFetching}
              optionFilterProp="label"
              onSearch={setCatalogSearch}
              filterOption={false}
            />
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
