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
import { getStorefrontBrands } from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";

function marginLabel(margin: number) {
  if (margin <= 0) return <Tag color="warning">Not set</Tag>;
  return `${margin.toFixed(2)}%`;
}

function catalogBrandLabel(brand: StorefrontBrandAdminDto) {
  const names = (brand.catalogBrands ?? [])
    .map((source) => source.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length > 0) return names.join(", ");

  const ids = (brand.catalogBrandIds ?? []).filter(Boolean);
  if (ids.length > 0) return `Source catalog brand IDs: ${ids.join(", ")}`;

  if (brand.brandId) return `Legacy catalog brand ID: ${brand.brandId}`;

  return "No catalog brands linked";
}

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [brandSearch, setBrandSearch] = useState("");

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
    if (storefrontBrandsAllQuery.isError) {
      message.error(
        storefrontBrandsAllQuery.error instanceof Error
          ? storefrontBrandsAllQuery.error.message
          : "Unable to load storefront brands.",
      );
    }
  }, [storefrontBrandsAllQuery.isError, storefrontBrandsAllQuery.error, message]);

  const rows = useMemo(() => {
    const search = brandSearch.trim().toLowerCase();
    return (storefrontBrandsAllQuery.data ?? []).filter((brand) =>
      !search
      || brand.name.toLowerCase().includes(search)
      || brand.catalogBrands?.some((source) => source.name?.toLowerCase().includes(search))
      || brand.catalogBrandIds?.some((id) => id.toLowerCase().includes(search))
      || brand.brandId?.toLowerCase().includes(search),
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
            {catalogBrandLabel(row)}
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
        <Button type="primary" disabled={!canEdit} onClick={() => navigate("/franchise-products/add-brand?from=brands")} icon={<ShopOutlined />}>
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
            storefrontBrandsAllQuery.isLoading ||
            storefrontBrandsAllQuery.isFetching
          }
          locale={{ emptyText: <Empty description="No storefront brands found" /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

    </div>
  );
}
