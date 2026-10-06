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
  SettingOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import {
  addStorefrontBrand,
  getStorefrontBrands,
} from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import type { BrandReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";

function marginLabel(margin: number) {
  if (margin <= 0) return <Tag color="warning">Not set</Tag>;
  return `${margin.toFixed(2)}%`;
}

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [brandSearch, setBrandSearch] = useState("");

  const [addConfigOpen, setAddConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    name: string;
    brandImageUrl: string;
    dynamicsId: string;
    catalogBrandIds: string[];
    storefrontPriceMargin: number;
    isActive: boolean;
  }>();

  const catalogBrandsQuery = useQuery({
    queryKey: ["catalog-brands-admin", "all"],
    queryFn: async () => {
      const all: BrandReturnDTO[] = [];
      let pageNumber = 1;
      const pageSize = 500;
      while (true) {
        const res = await apiGet<PaginationResponse<BrandReturnDTO>>(
          `brand/getAllBrands?PageSize=${pageSize}&PageNumber=${pageNumber}`,
        );
        if (!res.status) throw new Error(res.message ?? "Failed to load catalog brands");
        all.push(...(res.data?.data ?? []));
        if (pageNumber * pageSize >= Number(res.data?.count ?? 0)) return all;
        pageNumber += 1;
      }
    },
  });

  const storefrontBrandsAllQueryKey = ["storefront", "brands-admin-all"] as const;
  const storefrontBrandsAllQuery = useQuery({
    queryKey: storefrontBrandsAllQueryKey,
    queryFn: async () => {
      const perPage = 500;
      let pageNumber = 1;
      const all: StorefrontBrandAdminDto[] = [];

      while (true) {
        const res = await getStorefrontBrands({ PageSize: perPage, PageNumber: pageNumber });
        if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");

        all.push(...(res.data?.data ?? []));
        const total = res.data?.count ?? 0;
        if (pageNumber * perPage >= total) return all;
        pageNumber += 1;
      }
    },
  });

  useEffect(() => {
    if (catalogBrandsQuery.isError) {
      message.error(
        catalogBrandsQuery.error instanceof Error
          ? catalogBrandsQuery.error.message
          : "Unable to load catalog brands.",
      );
    }
  }, [catalogBrandsQuery.isError, catalogBrandsQuery.error, message]);

  useEffect(() => {
    if (storefrontBrandsAllQuery.isError) {
      message.error(
        storefrontBrandsAllQuery.error instanceof Error
          ? storefrontBrandsAllQuery.error.message
          : "Unable to load storefront brands.",
      );
    }
  }, [storefrontBrandsAllQuery.isError, storefrontBrandsAllQuery.error, message]);

  function openAddConfig() {
    form.setFieldsValue({
      name: "",
      brandImageUrl: "",
      dynamicsId: "",
      catalogBrandIds: [],
      storefrontPriceMargin: 0,
      isActive: true,
    });
    setAddConfigOpen(true);
  }

  async function addFromConfig() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await addStorefrontBrand({
        catalogBrandIds: values.catalogBrandIds,
        brandImageUrl: values.brandImageUrl,
        name: values.name,
        dynamicsId: values.dynamicsId,
        storefrontPriceMargin: values.storefrontPriceMargin,
        isActive: values.isActive,
      });
      if (!res.status) {
        message.error(res.message ?? "Failed to add storefront brand");
        return;
      }

      message.success(res.message ?? "Storefront brand added");
      setAddConfigOpen(false);
      form.resetFields();

      void queryClient.invalidateQueries({ queryKey: storefrontBrandsAllQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands"] });
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(() => {
    const search = brandSearch.trim().toLowerCase();
    return (storefrontBrandsAllQuery.data ?? []).filter((brand) =>
      !search
      || brand.name.toLowerCase().includes(search)
      || brand.catalogBrands?.some((source) => source.name?.toLowerCase().includes(search)),
    );
  }, [brandSearch, storefrontBrandsAllQuery.data]);

  const columns: TableColumnsType<StorefrontBrandAdminDto> = [
    {
      title: "",
      key: "image",
      width: 64,
      render: (_, row) => (
        <Avatar
          shape="square"
          src={row.brandImageUrl ?? undefined}
          icon={!row.brandImageUrl ? <ShopOutlined /> : undefined}
        >
          {!row.brandImageUrl ? row.name.slice(0, 1) : null}
        </Avatar>
      ),
    },
    {
      title: "Brand",
      key: "name",
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.catalogBrands?.map((source) => source.name).filter(Boolean).join(", ") || "No catalog brands linked"}
          </div>
        </div>
      ),
    },
    {
      title: "Added",
      key: "added",
      width: 120,
      render: (_, row) => <Switch checked={row.isActive} disabled />,
    },
    {
      title: "Margin",
      key: "margin",
      width: 140,
      render: (_, row) => marginLabel(row.storefrontPriceMargin),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, row) => (
        <Tag color={row.isActive ? "success" : "default"}>
          {row.isActive ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Dynamics ID",
      key: "dynamicsId",
      width: 160,
      render: (_, row) => (
        <span className="text-xs text-muted-foreground">{row.dynamicsId || "—"}</span>
      ),
    },
    {
      title: "Created",
      key: "created",
      width: 140,
      render: (_, row) => new Date(row.dateCreated).toLocaleDateString(),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 260,
      render: (_, row) => (
        <Space size={4}>
          <>
              <Button
                type="primary"
                size="small"
                icon={<SettingOutlined />}
                onClick={() =>
                  navigate(`/franchise-brands/${row.id}`, {
                    state: { brand: row },
                  })
                }
              >
                Set margin
              </Button>
              <Button
                size="small"
                icon={<AppstoreOutlined />}
                onClick={() =>
                  navigate(
                    `/franchise-products?brandId=${encodeURIComponent(
                      row.id,
                    )}&brand=${encodeURIComponent(row.name)}`,
                  )
                }
              >
                Products
              </Button>
          </>
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
            Create explicit storefront brands and group the SuperApp catalog brands they represent. Themes and owner catalog selection use these storefront brands.
          </Typography.Text>
        </div>
        <Button type="primary" disabled={!canEdit} onClick={openAddConfig} icon={<ShopOutlined />}>
          Create storefront brand
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap gap-3">
          <Input
            allowClear
            placeholder="Search brand…"
            value={brandSearch}
            onChange={(event) => setBrandSearch(event.target.value)}
            prefix={<ShopOutlined className="text-muted-foreground" />}
            className="min-w-[220px] flex-1"
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontBrandAdminDto>
          rowKey={(row) => row.id}
          columns={columns}
          dataSource={rows}
          loading={
            catalogBrandsQuery.isLoading ||
            catalogBrandsQuery.isFetching ||
            storefrontBrandsAllQuery.isLoading ||
            storefrontBrandsAllQuery.isFetching
          }
          locale={{ emptyText: <Empty description="No storefront brands found" /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        open={addConfigOpen}
        title="Add storefront brand"
        onCancel={() => {
          setAddConfigOpen(false);
          form.resetFields();
        }}
        onOk={() => void addFromConfig()}
        confirmLoading={saving}
        destroyOnClose
        okText="Add brand"
      >
        <div className="space-y-2">
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Storefront brand name"
              rules={[{ required: true, message: "Enter a storefront brand name" }]}
            >
              <Input placeholder="e.g. Samsung OEM" />
            </Form.Item>
            <Form.Item
              name="catalogBrandIds"
              label="SuperApp catalog brands"
              rules={[{ required: true, message: "Select at least one catalog brand" }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Select the brands grouped by this storefront brand"
                options={(catalogBrandsQuery.data ?? []).map((brand) => ({
                  value: brand.id,
                  label: brand.name,
                }))}
              />
            </Form.Item>
            <Form.Item name="brandImageUrl" label="Logo URL">
              <Input placeholder="Optional storefront logo URL" />
            </Form.Item>
            <Form.Item name="dynamicsId" label="Storefront Dynamics ID">
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
        </div>
      </Modal>
    </div>
  );
}
