import { InputNumber } from "antd";

/** productId → minimum units, or null for "no minimum". */
export type QualifyingMinimums = Record<string, number | null>;

/**
 * Optional per-product minimums on a deal's own products. One row per selected
 * product, blank meaning no minimum — so a product dropped from the deal takes
 * its minimum with it, which is what the backend does too.
 */
export function DealQualifyingQuantitiesEditor({
  productIds,
  productNames,
  value,
  onChange,
  disabled,
}: {
  productIds: string[];
  productNames: Record<string, string>;
  value: QualifyingMinimums;
  onChange: (value: QualifyingMinimums) => void;
  disabled?: boolean;
}) {
  if (productIds.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Pick the deal&apos;s products first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {productIds.map((id) => (
        <div
          key={id}
          className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-2"
        >
          <span className="truncate text-sm">
            {productNames[id] ?? `Product ${id.slice(0, 8)}`}
          </span>
          <InputNumber
            min={1}
            precision={0}
            value={value[id] ?? null}
            onChange={(v) => onChange({ ...value, [id]: v ?? null })}
            placeholder="No minimum"
            style={{ width: "100%" }}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

/** The request list: only the deal's current products, only set minimums. */
export function toQualifyingQuantities(
  productIds: string[],
  value: QualifyingMinimums,
): { productId: string; minQuantity: number }[] {
  return productIds.flatMap((productId) => {
    const minQuantity = value[productId];
    return minQuantity && minQuantity > 0 ? [{ productId, minQuantity }] : [];
  });
}
