import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Button,
  Skeleton,
  Tag,
  Descriptions,
  Divider,
  Typography,
  App as AntdApp,
  Empty,
  Table,
  Result,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  SyncOutlined,
  FileImageOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import type {
  LocationWithQuantityResponse,
  ProductReturnDto,
  ProductVariantReturnDto,
} from "@/lib/types";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Props {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailModal({ productId, open, onOpenChange }: Props) {
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProducts));
  const [imageIndex, setImageIndex] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const res = await apiGet<ProductReturnDto>(`Product/GetProduct/${productId}`);
      // Backend returns Result<T> with status=false for 404s (inactive/deleted products).
      // Surface the message verbatim and skip retrying — there's nothing to retry.
      if (!res.status) throw new Error(res.message ?? "Product not found");
      return res.data;
    },
    enabled: !!productId && open,
    retry: false,
  });

  useEffect(() => {
    setImageIndex(0);
  }, [productId]);

  const images = data?.productImageUrls ?? [];
  const activeImage = images[imageIndex];

  async function handleSyncImages() {
    if (!data?.dynamicsId) return;
    setSyncing(true);
    const res = await apiPost<boolean>(
      "Product/SyncSpecificProductImages/sync-specific-images",
      [data.dynamicsId],
    );
    setSyncing(false);
    if (res.status) {
      message.success(res.message ?? "Product images synced");
      refetch();
    } else {
      message.error(res.message ?? "Failed to sync images");
    }
  }

  const variants = data?.variants ?? [];
  // Variant attribute columns vary per product (a phone has color+config, a
  // shirt has size+style). Only surface the attributes that at least one
  // variant actually populates so the table doesn't fill with empty columns.
  const variantAttributes = (
    [
      { key: "colorId", title: "Color" },
      { key: "configId", title: "Configuration" },
      { key: "sizeId", title: "Size" },
      { key: "styleId", title: "Style" },
      { key: "versionId", title: "Version" },
    ] as const
  ).filter(({ key }) => variants.some((v) => v[key]));

  const variantColumns: TableColumnsType<ProductVariantReturnDto> = [
    ...variantAttributes.map(({ key, title }) => ({
      title,
      dataIndex: key,
      render: (v: string | null) => v || "—",
    })),
    {
      title: "Price (NGN)",
      dataIndex: "priceInNaira",
      align: "right" as const,
      render: (v: number) => formatCurrency(v, "NGN"),
    },
    {
      title: "Price (USD)",
      dataIndex: "priceInDollar",
      align: "right" as const,
      render: (v: number) => formatCurrency(v, "USD"),
    },
    {
      title: "Warehouse",
      key: "warehouse",
      render: (_: unknown, v: ProductVariantReturnDto) => {
        const names = (v.warehouses ?? []).map((w) => w.name).filter(Boolean);
        return names.length ? names.join(", ") : "—";
      },
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      align: "right" as const,
      render: (v: number) => (
        <span className="font-medium">{formatNumber(v)}</span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, v: ProductVariantReturnDto) => (
        <div className="flex flex-wrap gap-1">
          <Tag color={v.isActive ? "success" : "default"}>
            {v.isActive ? "Active" : "Inactive"}
          </Tag>
          {v.isDefault && <Tag color="blue">Default</Tag>}
        </div>
      ),
    },
  ];

  const warehouseColumns: TableColumnsType<LocationWithQuantityResponse> = [
    {
      title: "Warehouse name",
      dataIndex: "name",
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Warehouse Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{v ?? "—"}</span>
      ),
    },
    {
      title: "Price (NGN)",
      key: "priceInNaira",
      align: "right",
      // Prices are product-level, not per-warehouse — pull from the product.
      render: () => formatCurrency(data?.priceInNaira ?? 0, "NGN"),
    },
    {
      title: "Price (USD)",
      key: "priceInDollar",
      align: "right",
      render: () => formatCurrency(data?.priceInDollar ?? 0, "USD"),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      align: "right",
      render: (v: number) => (
        <span className="font-medium">{formatNumber(v)}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      align: "center",
      render: (v: boolean) => (
        <Tag color={v ? "success" : "default"}>{v ? "Active" : "Inactive"}</Tag>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.productName ?? "Product details"}
      width={960}
      footer={[
        canEdit && (
          <Button
            key="sync"
            icon={<SyncOutlined spin={syncing} />}
            disabled={syncing || !data?.dynamicsId}
            onClick={handleSyncImages}
          >
            Sync images
          </Button>
        ),
        <Button key="close" type="primary" onClick={() => onOpenChange(false)}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : isError || !data ? (
        <Result
          status="404"
          title="Product unavailable"
          subTitle={
            (error as Error)?.message ??
            "This product may be inactive or no longer exists."
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
              {activeImage ? (
                <img
                  src={activeImage.url}
                  alt={data.productName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Empty image={<FileImageOutlined style={{ fontSize: 48 }} />} description="No image" />
              )}
              {images.length > 1 && (
                <>
                  <Button
                    shape="circle"
                    icon={<LeftOutlined />}
                    className="!absolute left-3 top-1/2 -translate-y-1/2"
                    onClick={() =>
                      setImageIndex((i) => (i - 1 + images.length) % images.length)
                    }
                  />
                  <Button
                    shape="circle"
                    icon={<RightOutlined />}
                    className="!absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                  />
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                    {imageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Typography.Title level={4} className="!m-0">
                  {data.productName}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {data.shortDescription ?? "No description"}
                </Typography.Text>
              </div>
              <Divider className="!my-2" />
              <Descriptions column={2} size="small" colon={false}>
                <Descriptions.Item label="Price (USD)">
                  {formatCurrency(data.priceInDollar, "USD")}
                </Descriptions.Item>
                <Descriptions.Item label="Price (NGN)">
                  {formatCurrency(data.priceInNaira, "NGN")}
                </Descriptions.Item>
                <Descriptions.Item label="Quantity">
                  {formatNumber(data.quantity)}
                </Descriptions.Item>
                <Descriptions.Item label="Brand">
                  {data.brand?.name ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {data.category ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Dynamics ID">
                  {data.dynamicsId ?? "—"}
                </Descriptions.Item>
              </Descriptions>
              <Divider className="!my-2" />
              <div className="flex flex-wrap gap-2">
                <Tag color={data.isActive ? "success" : "default"}>
                  {data.isActive ? "Active" : "Inactive"}
                </Tag>
                <Tag color={data.isVisible ? "blue" : "default"}>
                  {data.isVisible ? "Visible" : "Hidden"}
                </Tag>
                {data.isFeaturedProduct && <Tag color="gold">Featured</Tag>}
              </div>
            </div>
          </div>

          <Divider className="!my-4" />
          {data.hasVariants && variants.length > 0 ? (
            <div>
              <Typography.Title level={5} className="!mb-3 text-center">
                Stock Breakdown
              </Typography.Title>
              <Table<ProductVariantReturnDto>
                rowKey="id"
                dataSource={variants}
                columns={variantColumns}
                pagination={false}
                size="middle"
                bordered
                scroll={{ x: "max-content" }}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <Typography.Title level={5} className="!mb-3 text-center">
                Stock Breakdown
              </Typography.Title>
              <Table<LocationWithQuantityResponse>
                rowKey={(r) => `${r.id}-${r.dynamicsId ?? ""}`}
                dataSource={data.warehouse ?? []}
                columns={warehouseColumns}
                pagination={false}
                size="middle"
                bordered
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No warehouse stock data for this product."
                    />
                  ),
                }}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
