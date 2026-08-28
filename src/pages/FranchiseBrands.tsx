import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AppstoreOutlined, SettingOutlined, ShopOutlined } from "@ant-design/icons";
import { getStorefrontBrands } from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

function marginLabel(margin: number) {
  if (margin <= 0) return <Tag color="warning">Not set</Tag>;
  return `${margin.toFixed(2)}%`;
}

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? error.message : "Unable to load storefront brands.",
      );
    }
  }, [isError, error, message]);

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

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
      width: 220,
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
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Franchise brands
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage storefront brands and default price margins. TD Customers pay product price + margin.
        </Typography.Text>
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
    </div>
  );
}
