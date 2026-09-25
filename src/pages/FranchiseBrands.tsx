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
  deleteStorefrontBrand,
  getStorefrontBrands,
} from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import type { BrandReturnDTO, PaginationResponse } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function marginLabel(margin: number) {
  if (margin <= 0) return <Tag color="warning">Not set</Tag>;
  return `${margin.toFixed(2)}%`;
}

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [catalogSearch, setCatalogSearch] = useState("");
  const debouncedCatalogSearch = useDebouncedValue(catalogSearch, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [addConfigOpen, setAddConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCatalogBrand, setSelectedCatalogBrand] = useState<BrandReturnDTO | null>(null);

  const [form] = Form.useForm<{
    storefrontPriceMargin: number;
    isActive: boolean;
  }>();

  const catalogQueryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedCatalogSearch.trim() || undefined,
    }),
    [pageSize, page, debouncedCatalogSearch],
  );

  const catalogQuery = useQuery({
    queryKey: ["catalog-brands-admin", catalogQueryParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("PageSize", String(catalogQueryParams.PageSize));
      params.set("PageNumber", String(catalogQueryParams.PageNumber));
      if (catalogQueryParams.SearchString) {
        params.set("SearchString", catalogQueryParams.SearchString);
      }

      // Requirement: show all catalog brands, so do not filter by isActive.
      const res = await apiGet<PaginationResponse<BrandReturnDTO>>(
        `brand/getAllBrands?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load catalog brands");
      return res.data;
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

  const storefrontBrandByBrandId = useMemo(() => {
    return new Map<string, StorefrontBrandAdminDto>(
      (storefrontBrandsAllQuery.data ?? []).map((b) => [b.brandId, b]),
    );
  }, [storefrontBrandsAllQuery.data]);

  useEffect(() => {
    if (catalogQuery.isError) {
      message.error(
        catalogQuery.error instanceof Error
          ? catalogQuery.error.message
          : "Unable to load catalog brands.",
      );
    }
  }, [catalogQuery.isError, catalogQuery.error, message]);

  useEffect(() => {
    if (storefrontBrandsAllQuery.isError) {
      message.error(
        storefrontBrandsAllQuery.error instanceof Error
          ? storefrontBrandsAllQuery.error.message
          : "Unable to load storefront brands.",
      );
    }
  }, [storefrontBrandsAllQuery.isError, storefrontBrandsAllQuery.error, message]);

  function openAddConfig(catalogBrand: BrandReturnDTO) {
    setSelectedCatalogBrand(catalogBrand);
    form.setFieldsValue({
      storefrontPriceMargin: 0,
      isActive: true,
    });
    setAddConfigOpen(true);
  }

  async function addFromConfig() {
    if (!selectedCatalogBrand) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await addStorefrontBrand({
        brandId: selectedCatalogBrand.id,
        brandImageUrl: selectedCatalogBrand.brandImageUrl ?? "",
        name: selectedCatalogBrand.name,
        dynamicsId: selectedCatalogBrand.dynamicsId ?? "",
        storefrontPriceMargin: values.storefrontPriceMargin,
        isActive: values.isActive,
      });
      if (!res.status) {
        message.error(res.message ?? "Failed to add storefront brand");
        return;
      }

      message.success(res.message ?? "Storefront brand added");
      setAddConfigOpen(false);
      setSelectedCatalogBrand(null);
      form.resetFields();

      void queryClient.invalidateQueries({ queryKey: storefrontBrandsAllQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brands"] });
    } finally {
      setSaving(false);
    }
  }

  async function removeStorefrontBrand(brandAdmin: StorefrontBrandAdminDto) {
    const res = await deleteStorefrontBrand(brandAdmin.id);
    if (!res.status) {
      message.error(res.message ?? "Failed to delete brand");
      return;
    }

    message.success(res.message ?? "Brand deleted");
    void queryClient.invalidateQueries({ queryKey: storefrontBrandsAllQueryKey });
    void queryClient.invalidateQueries({ queryKey: ["storefront", "brands-admin"] });
    void queryClient.invalidateQueries({ queryKey: ["storefront", "brands"] });
  }

  type CatalogRow = {
    catalog: BrandReturnDTO;
    storefront: StorefrontBrandAdminDto | null;
  };

  const rows: CatalogRow[] = useMemo(() => {
    const catalogRows = catalogQuery.data?.data ?? [];
    return catalogRows.map((catalog) => ({
      catalog,
      storefront: storefrontBrandByBrandId.get(catalog.id) ?? null,
    }));
  }, [catalogQuery.data, storefrontBrandByBrandId]);

  const totalItems = Number(catalogQuery.data?.count ?? 0);

  const columns: TableColumnsType<CatalogRow> = [
    {
      title: "",
      key: "image",
      width: 64,
      render: (_, row) => (
        <Avatar
          shape="square"
          src={row.catalog.brandImageUrl ?? undefined}
          icon={!row.catalog.brandImageUrl ? <ShopOutlined /> : undefined}
        >
          {!row.catalog.brandImageUrl ? row.catalog.name.slice(0, 1) : null}
        </Avatar>
      ),
    },
    {
      title: "Brand",
      key: "name",
      render: (_, row) => <span className="font-medium">{row.catalog.name}</span>,
    },
    {
      title: "Added",
      key: "added",
      width: 120,
      render: (_, row) => (
        <Switch
          checked={row.storefront != null}
          disabled={!canEdit}
          onChange={(checked) => {
            if (checked) {
              if (row.storefront) return;
              openAddConfig(row.catalog);
              return;
            }

            if (!row.storefront) return;
            void Modal.confirm({
              title: "Remove this storefront brand?",
              okText: "Remove",
              okButtonProps: { danger: true },
              onOk: async () => {
                await removeStorefrontBrand(row.storefront!);
              },
            });
          }}
        />
      ),
    },
    {
      title: "Margin",
      key: "margin",
      width: 140,
      render: (_, row) => (row.storefront ? marginLabel(row.storefront.storefrontPriceMargin) : "—"),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, row) =>
        row.storefront ? (
          <Tag color={row.storefront.isActive ? "success" : "default"}>
            {row.storefront.isActive ? "Active" : "Inactive"}
          </Tag>
        ) : (
          <Tag>—</Tag>
        ),
    },
    {
      title: "Dynamics ID",
      key: "dynamicsId",
      width: 160,
      render: (_, row) => (
        <span className="text-xs text-muted-foreground">{row.catalog.dynamicsId ?? "—"}</span>
      ),
    },
    {
      title: "Created",
      key: "created",
      width: 140,
      render: (_, row) => (row.storefront ? new Date(row.storefront.dateCreated).toLocaleDateString() : "—"),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 260,
      render: (_, row) => (
        <Space size={4}>
          {row.storefront ? (
            <>
              <Button
                type="primary"
                size="small"
                icon={<SettingOutlined />}
                onClick={() =>
                  navigate(`/franchise-brands/${row.storefront!.id}`, {
                    state: { brand: row.storefront! },
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
                      row.storefront!.id,
                    )}&brand=${encodeURIComponent(row.storefront!.name)}`,
                  )
                }
              >
                Products
              </Button>
            </>
          ) : (
            <Tag color="default">Not added</Tag>
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
            Manage storefront brand associations and default price margins. TD Customers pay product price + margin.
          </Typography.Text>
        </div>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap gap-3">
          <Input
            allowClear
            placeholder="Search brand…"
            value={catalogSearch}
            onChange={(event) => {
              setPage(1);
              setCatalogSearch(event.target.value);
            }}
            prefix={<ShopOutlined className="text-muted-foreground" />}
            className="min-w-[220px] flex-1"
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CatalogRow>
          rowKey={(row) => row.catalog.id}
          columns={columns}
          dataSource={rows}
          loading={
            catalogQuery.isLoading ||
            catalogQuery.isFetching ||
            storefrontBrandsAllQuery.isLoading ||
            storefrontBrandsAllQuery.isFetching
          }
          locale={{ emptyText: <Empty description="No catalog brands found" /> }}
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
        open={addConfigOpen}
        title="Add storefront brand"
        onCancel={() => {
          setAddConfigOpen(false);
          setSelectedCatalogBrand(null);
          form.resetFields();
        }}
        onOk={() => void addFromConfig()}
        confirmLoading={saving}
        destroyOnClose
        okText="Add brand"
      >
        <div className="space-y-2">
          {selectedCatalogBrand ? (
            <div className="text-sm text-muted-foreground">
              Adding: <span className="font-medium text-foreground">{selectedCatalogBrand.name}</span>
            </div>
          ) : null}

          <Form form={form} layout="vertical">
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
