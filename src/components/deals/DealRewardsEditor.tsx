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

const DEFAULT_VARIANT = "__default__";

function variantLabel(v: ProductVariantReturnDto): string {
  const parts = [v.colorId, v.configId, v.sizeId, v.styleId, v.versionId].filter(Boolean);
  const name = parts.length > 0 ? parts.join(" · ") : "Variant";
  return v.isDefault ? `${name} (default)` : name;
}

/**
 * The variant picker for one reward row. Only shown when the product has more
 * than one active variant — for the rest, "default variant" is the only answer.
 */
function RewardVariantSelect({
  productId,
  value,
  onChange,
  disabled,
}: {
  productId: string | null;
  value: string | null;
  onChange: (v: string | null) => void;
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

  // The backend refuses an inactive variant, so don't offer one.
  const variants = (product?.variants ?? []).filter((v) => v.isActive);
  if (!productId || (!isFetching && variants.length <= 1)) {
    return (
      <Select
        disabled
        value={DEFAULT_VARIANT}
        options={[{ value: DEFAULT_VARIANT, label: "Default variant" }]}
        style={{ width: "100%" }}
      />
    );
  }

  return (
    <Select
      loading={isFetching}
      disabled={disabled}
      value={value ?? DEFAULT_VARIANT}
      onChange={(v: string) => onChange(v === DEFAULT_VARIANT ? null : v)}
      options={[
        { value: DEFAULT_VARIANT, label: "Default variant" },
        ...variants.map((v) => ({ value: v.id, label: variantLabel(v) })),
      ]}
      style={{ width: "100%" }}
    />
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
