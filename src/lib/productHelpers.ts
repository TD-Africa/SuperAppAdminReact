import type { ProductReturnDto } from "./types";

/** Product-level price, falling back to the first variant with a non-zero price. */
export function effectiveProductPrice(
  product: ProductReturnDto,
  currency: "naira" | "dollar",
): number {
  const pick = (v: { priceInNaira: number; priceInDollar: number }) =>
    currency === "naira" ? v.priceInNaira : v.priceInDollar;
  const base = pick(product);
  if (base > 0) return base;
  const variants = product.variants ?? [];
  const fromDefault = variants.find((v) => v.isDefault && pick(v) > 0);
  if (fromDefault) return pick(fromDefault);
  const fromAny = variants.find((v) => pick(v) > 0);
  return fromAny ? pick(fromAny) : base;
}

export function productThumbnail(product: ProductReturnDto): string | undefined {
  const urls = product.productImageUrls ?? [];
  const sorted = [...urls].sort((a, b) => a.position - b.position);
  return sorted[0]?.url ?? undefined;
}
