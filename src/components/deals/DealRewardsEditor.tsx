import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, InputNumber, Select } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { ProductReturnDto, ProductVariantReturnDto } from "@/lib/types";
import { ProductSearchSelect } from "@/components/ProductSearchSelect";

/** One free item in a BuyXGetYFree deal, as edited in the form. */
export interface RewardRow {
  /** Local key only — rows have no id of their own until saved. */
  key: string;
  productId: string | null;
  /** Label for the selected product, so it renders before any search runs. */
  productName: string | null;
  /** null = the product's default variant (the backend picks it). */
  variantId: string | null;
  quantity: number;
}

let nextKey = 0;
export function newRewardRow(partial: Partial<RewardRow> = {}): RewardRow {
  nextKey += 1;
  return {
    key: `reward-${nextKey}`,
    productId: null,
    productName: null,
    variantId: null,
    quantity: 1,
    ...partial,
  };
}

/** Stock for a variant: at `locationId` when given, else across every warehouse. */
function stockOf(v: ProductVariantReturnDto, locationId?: string): number {
  const rows = v.warehouses ?? [];
  if (locationId) {
    return rows.filter((w) => w.id === locationId).reduce((s, w) => s + (w.quantity ?? 0), 0);
  }
  return Math.max(v.quantity ?? 0, rows.reduce((s, w) => s + (w.quantity ?? 0), 0));
}

function variantLabel(v: ProductVariantReturnDto, locationId?: string): string {
  const parts = [v.colorId, v.configId, v.sizeId, v.styleId, v.versionId].filter(Boolean);
  const name = parts.length > 0 ? parts.join(" · ") : `Variant ${v.id.slice(0, 8)}`;
  const stock = stockOf(v, locationId);
  return `${name}${v.isDefault ? " (default)" : ""} · ${stock} in stock${
    locationId ? " here" : ""
  }`;
}

/**
 * The variant picker for one reward row.
 *
 * Always an explicit variant, pre-selected to the one with the most stock at the
 * deal's warehouse. "Product default" is NOT offered: the backend resolves it to
 * the variant flagged `isDefault`, which is often a superseded one sitting at
 * zero — and the cart caps free units at the stock of the warehouse supplying
 * the Buy items, so a zero-stock reward silently never appears.
 */
function RewardVariantSelect({
  productId,
  value,
  onChange,
  locationId,
  disabled,
}: {
  productId: string | null;
  value: string | null;
  onChange: (v: string | null) => void;
  /** The deal's warehouse — free stock is taken from where the Buy items ship. */
  locationId?: string;
  disabled?: boolean;
}) {
  const { data: product, isFetching } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const res = await apiGet<ProductReturnDto>(`Product/GetProduct/${productId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load product");
      return res.data;
    },
    enabled: !!productId,
    staleTime: 60_000,
    retry: false,
  });

  // The backend refuses an inactive variant, so don't offer one. Most stock
  // first, so the sensible choice is at the top.
  const variants = useMemo(
    () =>
      (product?.variants ?? [])
        .filter((v) => v.isActive)
        .sort((a, b) => stockOf(b, locationId) - stockOf(a, locationId)),
    [product, locationId],
  );

  // Fill in an explicit variant once the product loads, so nothing is saved as
  // "whatever the backend calls default".
  useEffect(() => {
    if (!value && variants.length > 0) onChange(variants[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, variants]);

  if (!productId) {
    return <Select disabled placeholder="Pick a product first" style={{ width: "100%" }} />;
  }

  const selected = variants.find((v) => v.id === value);
  // Saved against a variant that is no longer active (or never loaded) — show
  // it rather than silently swapping it, and say so below.
  const unknown = !!value && !isFetching && !selected;
  const noStock = !!selected && stockOf(selected, locationId) <= 0;

  return (
    <div>
      <Select
        loading={isFetching}
        disabled={disabled}
        value={value ?? undefined}
        onChange={(v: string) => onChange(v)}
        placeholder="Loading variants…"
        options={[
          ...(unknown && value
            ? [{ value, label: `Variant ${value.slice(0, 8)} · inactive or unknown` }]
            : []),
          ...variants.map((v) => ({ value: v.id, label: variantLabel(v, locationId) })),
        ]}
        style={{ width: "100%" }}
        status={unknown || noStock ? "warning" : undefined}
      />
      {(unknown || noStock) && (
        <div className="mt-1 text-xs text-amber-600">
          {unknown
            ? "This variant isn't active any more, so the free item will never be added."
            : "No stock at the deal's warehouse — the free item won't be added until it's restocked."}
        </div>
      )}
    </div>
  );
}

/**
 * The "Get free" side of a cross-product deal: which items are added free for
 * every completed set of qualifying units, and how many of each.
 */
export function DealRewardsEditor({
  value,
  onChange,
  locationId,
  disabled,
}: {
  value: RewardRow[];
  onChange: (rows: RewardRow[]) => void;
  locationId?: string;
  disabled?: boolean;
}) {
  const update = (key: string, patch: Partial<RewardRow>) =>
    onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_96px_32px] gap-2 text-xs text-muted-foreground md:grid">
          <span>Product</span>
          <span>Variant</span>
          <span>Qty per set</span>
          <span />
        </div>
      )}
      {value.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_96px_32px]"
        >
          <ProductSearchSelect
            value={row.productId}
            onChange={(id) => update(row.key, { productId: id, productName: null, variantId: null })}
            initialSelection={
              row.productId && row.productName
                ? { id: row.productId, productName: row.productName }
                : null
            }
            extraParams={{ locationId }}
            placeholder="Search for the free product…"
            disabled={disabled}
          />
          <RewardVariantSelect
            productId={row.productId}
            value={row.variantId}
            onChange={(variantId) => update(row.key, { variantId })}
            locationId={locationId}
            disabled={disabled}
          />
          <InputNumber
            min={1}
            precision={0}
            value={row.quantity}
            onChange={(v) => update(row.key, { quantity: v ?? 1 })}
            style={{ width: "100%" }}
            disabled={disabled}
          />
          <Button
            icon={<DeleteOutlined />}
            aria-label="Remove free item"
            onClick={() => onChange(value.filter((r) => r.key !== row.key))}
            disabled={disabled}
          />
        </div>
      ))}
      <Button
        icon={<PlusOutlined />}
        onClick={() => onChange([...value, newRewardRow()])}
        disabled={disabled}
      >
        Add free item
      </Button>
    </div>
  );
}
