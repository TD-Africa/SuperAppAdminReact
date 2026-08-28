import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AppstoreOutlined, PercentageOutlined } from "@ant-design/icons";
import { getActiveStorefrontBrands, getStorefrontProducts } from "@/lib/storefrontApi";
import {
  formatStorefrontNaira,
  pickDefaultVariant,
  storefrontMarkupPercent,
  type StorefrontProductDto,
} from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

export default function FranchiseProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = AntdApp.useApp();

  const brandIdFromUrl = searchParams.get("brandId") ?? "";
  const brandNameFromUrl = searchParams.get("brand") ?? "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [brandId, setBrandId] = useState(brandIdFromUrl || ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (brandIdFromUrl) setBrandId(brandIdFromUrl);
  }, [brandIdFromUrl]);

  const brandsQuery = useQuery({
    queryKey: ["storefront", "brands"],
    queryFn: async () => {
      const res = await getActiveStorefrontBrands();
      if (!res.status) throw new Error(res.message ?? "Failed to load brands");
      return res.data ?? [];
    },
  });

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      storefrontBrandId: brandId !== ALL ? brandId : undefined,
    }),
    [pageSize, page, debouncedSearch, brandId],
  );

  const productsQuery = useQuery({
    queryKey: ["storefront", "products", queryParams],
    queryFn: async () => {
      const res = await getStorefrontProducts(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront products");
      return res.data;
    },
  });

  useEffect(() => {
    if (productsQuery.isError) {
      message.error(
        productsQuery.error instanceof Error
          ? productsQuery.error.message
          : "Unable to load storefront products.",
      );
    }
  }, [productsQuery.isError, productsQuery.error, message]);

  const rows = productsQuery.data?.data ?? [];
  const totalItems = Number(productsQuery.data?.count ?? 0);

  const brandOptions = useMemo(() => {
    const options = (brandsQuery.data ?? []).map((b) => ({
      value: b.id,
      label: b.name,
    }));
    return [{ value: ALL, label: "All brands" }, ...options];
  }, [brandsQuery.data]);

  const selectedBrandLabel =
    brandId !== ALL
      ? (brandsQuery.data?.find((b) => b.id === brandId)?.name ?? brandNameFromUrl)
      : null;

  const columns: TableColumnsType<StorefrontProductDto> = [
    {
      title: "",
      key: "image",
      width: 64,
      fixed: "left",
      render: (_, row) => {
        const src = row.images?.[0] ?? undefined;
        return (
          <Avatar
            shape="square"
            src={src}
            icon={!src ? <AppstoreOutlined /> : undefined}
          />
        );
      },
    },
    {
      title: "Product",
      dataIndex: "productName",
      fixed: "left",
      width: 240,
      render: (name: string, row) => (
        <div className="max-w-[220px]">
          <div className="truncate font-medium">{name}</div>
          {row.slug && (
            <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
          )}
        </div>
      ),
    },
    {
      title: "Brand",
      dataIndex: "brandName",
      width: 140,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Qty",
      key: "qty",
      width: 90,
      align: "right",
      render: (_, row) => {
        const v = pickDefaultVariant(row);
        return v ? v.availableQuantity.toLocaleString() : "—";
      },
    },
    {
      title: "Price (NGN)",
      key: "price",
      width: 140,
      align: "right",
      render: (_, row) => {
        const v = pickDefaultVariant(row);
        return v ? formatStorefrontNaira(v.priceInNaira) : "—";
      },
    },
    {
      title: "Storefront price",
      key: "storefront",
      width: 160,
      align: "right",
      render: (_, row) => {
        const v = pickDefaultVariant(row);
        if (!v) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <span className="font-semibold text-[#800020]">
            {formatStorefrontNaira(v.storefrontPrice)}
          </span>
        );
      },
    },
    {
      title: "Markup",
      key: "markup",
      width: 100,
      align: "right",
      render: (_, row) => {
        const v = pickDefaultVariant(row);
        if (!v) return "—";
        const markup = storefrontMarkupPercent(v.priceInNaira, v.storefrontPrice);
        return markup === null ? "—" : <span className="font-medium">{markup.toFixed(2)}%</span>;
      },
    },
    {
      title: "Published",
      dataIndex: "isStorefrontPublished",
      width: 110,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "default"}>{v ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Available",
      key: "available",
      width: 110,
      render: (_, row) => {
        const v = pickDefaultVariant(row);
        if (!v) return <Tag>Unknown</Tag>;
        return (
          <Tag color={v.isAvailable ? "blue" : "default"}>
            {v.isAvailable ? "Yes" : "No"}
          </Tag>
        );
      },
    },
    {
      title: "Variants",
      key: "variants",
      width: 90,
      align: "right",
      render: (_, row) => row.variants?.length ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">Franchise products</Typography.Title>
        <Typography.Text type="secondary">
          Storefront catalogue with NGN base and storefront prices
          {selectedBrandLabel ? ` · filtered by ${selectedBrandLabel}` : ""}.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-7"
            allowClear
            placeholder="Search products…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            prefix={<PercentageOutlined className="text-muted-foreground" />}
          />
          <Select
            className="md:col-span-5"
            value={brandId || ALL}
            loading={brandsQuery.isLoading}
            options={brandOptions}
            onChange={(value) => {
              setPage(1);
              setBrandId(value);
              const next = new URLSearchParams(searchParams);
              if (value === ALL) {
                next.delete("brandId");
                next.delete("brand");
              } else {
                next.set("brandId", value);
                const name = brandsQuery.data?.find((b) => b.id === value)?.name;
                if (name) next.set("brand", name);
              }
              setSearchParams(next, { replace: true });
            }}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontProductDto>
          rowKey="productId"
          columns={columns}
          dataSource={rows}
          loading={productsQuery.isLoading || productsQuery.isFetching}
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="No storefront products" /> }}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {brandId !== ALL && (
        <Button type="link" className="!px-0" onClick={() => navigate("/franchise-brands")}>
          ← Back to franchise brands
        </Button>
      )}
    </div>
  );
}
