import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Skeleton,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import type {
  VatBrandDto,
  VatChangeDto,
  VatProductDto,
  VatStatus,
  VatSummaryDto,
} from "@/lib/types";

const DEACTIVATE_PHRASE = "DEACTIVATE";

const STATUS_COLOR: Record<VatStatus, string> = {
  On: "green",
  Partial: "gold",
  Off: "default",
};

// What the confirm modal is about to change. A rate is only asked for when
// switching VAT on; switching off keeps each product's rate for later.
type PendingChange =
  | { kind: "brand"; brand: VatBrandDto; enabled: boolean }
  | { kind: "products"; products: VatProductDto[]; enabled: false }
  | { kind: "all" };

async function unwrap<T>(p: Promise<{ status: boolean; message?: string | null; data: T }>) {
  const res = await p;
  if (!res.status) throw new Error(res.message ?? "Request failed");
  return res.data;
}

function changedMessage(res: VatChangeDto | null) {
  if (!res) return "VAT updated";
  const n = res.productsUpdated;
  return `VAT ${res.enabled ? "on" : "off"} for ${n} product${n === 1 ? "" : "s"}`;
}

export default function VatSettings() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewProducts = hasPermission(Permission.CanViewProducts);
  const canViewBrands = hasPermission(Permission.CanViewBrands);
  const canEditBrands = hasPermission(Permission.CanEditBrands);
  const canEditProducts = hasPermission(Permission.CanEditProducts);

  const [search, setSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [phrase, setPhrase] = useState("");

  const summary = useQuery({
    queryKey: ["vat", "summary"],
    queryFn: () => unwrap(apiGet<VatSummaryDto>("vat/summary")),
    enabled: canViewProducts,
  });

  const brands = useQuery({
    queryKey: ["vat", "brands"],
    queryFn: () => unwrap(apiGet<VatBrandDto[]>("vat/brands")),
    enabled: canViewBrands,
  });

  const mutation = useMutation({
    mutationFn: (change: PendingChange) => {
      switch (change.kind) {
        case "brand":
          return unwrap(
            apiPut<VatChangeDto>(`vat/brands/${change.brand.brandId}`, {
              enabled: change.enabled,
              rate: change.enabled ? rate : null,
            }),
          );
        case "products":
          return unwrap(
            apiPut<VatChangeDto>("vat/products", {
              productIds: change.products.map((p) => p.productId),
              enabled: false,
            }),
          );
        case "all":
          return unwrap(apiPost<VatChangeDto>("vat/deactivate-all"));
      }
    },
    onSuccess: (res) => {
      message.success(changedMessage(res));
      setSelectedProductIds([]);
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["vat"] });
      // Product VAT feeds prices shown elsewhere in the admin.
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = brands.data ?? [];
    return q ? rows.filter((b) => b.name.toLowerCase().includes(q)) : rows;
  }, [brands.data, search]);

  function openModal(change: PendingChange) {
    setRate(null);
    setPhrase("");
    setPending(change);
  }

  function closeModal() {
    setPending(null);
  }

  if (!canViewProducts && !canViewBrands) return null;

  const data = summary.data;
  const vatProducts = data?.vatProducts ?? [];
  const truncated = data ? data.productsWithVat > vatProducts.length : false;

  return (
    <Card
      title="VAT"
      extra={
        canEditProducts && (data?.productsWithVat ?? 0) > 0 ? (
          <Button danger onClick={() => openModal({ kind: "all" })}>
            Deactivate VAT everywhere
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        <Typography.Paragraph type="secondary" className="!mb-0">
          Product VAT drives every price: cart, checkout, D365 and invoices. New
          products start without VAT. Turning VAT off keeps each product's rate,
          so turning it back on restores it.
        </Typography.Paragraph>

        {canViewProducts &&
          (summary.isLoading ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : summary.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load VAT summary"
              description={(summary.error as Error).message}
              action={
                <Button size="small" onClick={() => summary.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : data ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Statistic title="Products" value={data.products} />
              <Statistic title="Products with VAT" value={data.productsWithVat} />
              <Statistic title="Brands with VAT" value={data.brandsWithVat} />
            </div>
          ) : null)}

        {canViewBrands && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Typography.Text strong>By brand</Typography.Text>
              <Input.Search
                allowClear
                placeholder="Search brands"
                className="md:!w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {brands.isError ? (
              <Alert
                type="error"
                showIcon
                message="Could not load brands"
                description={(brands.error as Error).message}
                action={
                  <Button size="small" onClick={() => brands.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : (
              <Table<VatBrandDto>
                size="small"
                rowKey="brandId"
                loading={brands.isLoading}
                dataSource={filteredBrands}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                scroll={{ x: true }}
                columns={[
                  { title: "Brand", dataIndex: "name" },
                  {
                    title: "VAT",
                    dataIndex: "vatStatus",
                    width: 110,
                    render: (s: VatStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
                  },
                  {
                    title: "Products with VAT",
                    width: 160,
                    render: (_, b) => `${b.productsWithVat} / ${b.productCount}`,
                  },
                  {
                    title: "Enabled",
                    width: 100,
                    align: "right",
                    render: (_, b) => (
                      <Switch
                        // Partial reads as "on" so the switch offers the clean-up (all off);
                        // "Turn on for all" is the second button for that case.
                        checked={b.vatStatus !== "Off"}
                        disabled={!canEditBrands || b.productCount === 0}
                        onChange={(on) => openModal({ kind: "brand", brand: b, enabled: on })}
                      />
                    ),
                  },
                  ...(canEditBrands
                    ? [
                        {
                          title: "",
                          width: 140,
                          render: (_: unknown, b: VatBrandDto) =>
                            b.vatStatus === "Partial" ? (
                              <Button
                                size="small"
                                type="link"
                                onClick={() => openModal({ kind: "brand", brand: b, enabled: true })}
                              >
                                Turn on for all
                              </Button>
                            ) : null,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        )}

        {canViewProducts && data && data.productsWithVat > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Typography.Text strong>Products with VAT</Typography.Text>
              {canEditProducts && (
                <Button
                  disabled={selectedProductIds.length === 0}
                  onClick={() =>
                    openModal({
                      kind: "products",
                      enabled: false,
                      products: vatProducts.filter((p) =>
                        selectedProductIds.includes(p.productId),
                      ),
                    })
                  }
                >
                  Remove VAT from {selectedProductIds.length || ""} selected
                </Button>
              )}
            </div>
            {truncated && (
              <Alert
                type="info"
                showIcon
                message={`Showing the first ${vatProducts.length} of ${data.productsWithVat} products with VAT.`}
              />
            )}
            <Table<VatProductDto>
              size="small"
              rowKey="productId"
              dataSource={vatProducts}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: true }}
              rowSelection={
                canEditProducts
                  ? {
                      selectedRowKeys: selectedProductIds,
                      onChange: (keys) => setSelectedProductIds(keys as string[]),
                    }
                  : undefined
              }
              columns={[
                { title: "Product", dataIndex: "productName" },
                { title: "Brand", dataIndex: "brandName", render: (v) => v ?? "—" },
                {
                  title: "Rate",
                  dataIndex: "vatRate",
                  width: 100,
                  align: "right",
                  render: (v: number) => `${v}%`,
                },
              ]}
            />
          </div>
        )}
      </div>

      <Modal
        open={pending !== null}
        title={modalTitle(pending)}
        okText="Confirm"
        okButtonProps={{
          danger: pending?.kind === "all" || (pending?.kind === "brand" && !pending.enabled),
          disabled: pending?.kind === "all" && phrase !== DEACTIVATE_PHRASE,
        }}
        confirmLoading={mutation.isPending}
        onOk={() => pending && mutation.mutate(pending)}
        onCancel={closeModal}
        destroyOnClose
      >
        {pending?.kind === "brand" && (
          <div className="space-y-4">
            <Typography.Paragraph className="!mb-0">
              This changes the price of all {pending.brand.productCount} products
              of <b>{pending.brand.name}</b>, including any other brand records
              with the same name.
            </Typography.Paragraph>
            {pending.enabled && (
              <div className="space-y-1">
                <Typography.Text>VAT rate (optional)</Typography.Text>
                <InputNumber
                  className="w-full"
                  min={0.01}
                  max={100}
                  step={0.5}
                  precision={2}
                  suffix="%"
                  placeholder="Keep each product's current rate"
                  value={rate}
                  onChange={(v) => setRate(v ?? null)}
                />
              </div>
            )}
          </div>
        )}
        {pending?.kind === "products" && (
          <Typography.Paragraph className="!mb-0">
            Remove VAT from {pending.products.length} product
            {pending.products.length === 1 ? "" : "s"}? Their prices change
            immediately. Each product keeps its rate in case VAT is turned back on.
          </Typography.Paragraph>
        )}
        {pending?.kind === "all" && (
          <div className="space-y-3">
            <Alert
              type="warning"
              showIcon
              message={`Every product with VAT (${data?.productsWithVat ?? 0}) will be priced without it, across cart, checkout, D365 and invoices.`}
            />
            <Typography.Text>
              Type <b>{DEACTIVATE_PHRASE}</b> to confirm.
            </Typography.Text>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </div>
        )}
      </Modal>
    </Card>
  );
}

function modalTitle(change: PendingChange | null) {
  if (!change) return null;
  switch (change.kind) {
    case "brand":
      return `Turn VAT ${change.enabled ? "on" : "off"} for ${change.brand.name}?`;
    case "products":
      return "Remove VAT from selected products?";
    case "all":
      return "Deactivate VAT on every product?";
  }
}
