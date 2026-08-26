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
  Space,
  Table,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AppstoreOutlined, ShopOutlined } from "@ant-design/icons";
import { getActiveStorefrontBrands } from "@/lib/storefrontApi";
import type { StorefrontBrandDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["storefront", "brands"],
    queryFn: async () => {
      const res = await getActiveStorefrontBrands();
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
      return res.data ?? [];
    },
  });

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? error.message : "Unable to load storefront brands.",
      );
    }
  }, [isError, error, message]);

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((brand) => brand.name.toLowerCase().includes(q));
  }, [data, debouncedSearch]);

  const columns: TableColumnsType<StorefrontBrandDto> = [
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
      title: "",
      key: "actions",
      align: "right",
      width: 140,
      render: (_, brand) => (
        <Space size={4}>
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
        <Typography.Title level={3} className="!m-0">Franchise brands</Typography.Title>
        <Typography.Text type="secondary">
          Active storefront brands from Storefront/GetActiveStorefrontBrands.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search brand…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<ShopOutlined className="text-muted-foreground" />}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontBrandDto>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isLoading || isFetching}
          locale={{ emptyText: <Empty description="No storefront brands" /> }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </Card>
    </div>
  );
}
