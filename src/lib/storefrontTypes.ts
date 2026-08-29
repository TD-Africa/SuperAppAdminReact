import type { PaginationResponse } from "./types";

/** GET Storefront/GetActiveStorefrontBrands */
export interface StorefrontBrandDto {
  id: string;
  name: string;
  brandImageUrl: string | null;
}

/** GET Storefront/GetStorefrontBrands | PUT UpdateStorefrontBrand */
export interface StorefrontBrandAdminDto {
  id: string;
  brandId: string;
  brandImageUrl: string | null;
  name: string;
  dynamicsId: string;
  isActive: boolean;
  storefrontPriceMargin: number;
  dateCreated: string;
}

export interface UpdateStorefrontBrandRequest {
  brandId: string;
  brandImageUrl: string;
  name: string;
  dynamicsId: string;
  storefrontPriceMargin: number;
  isActive: boolean;
}

/** GET GetProductStorefrontPricing | PUT SetProductStorefrontMargin */
export interface ProductStorefrontPricingDto {
  productId: string;
  productName: string;
  priceInNaira: number;
  productMargin: number;
  brandMargin: number;
  effectiveMargin: number;
  storefrontPrice: number;
}

export type StorefrontPagedBrands = PaginationResponse<StorefrontBrandAdminDto>;

export type ProductMarginSource = "override" | "inherited" | "unset";

/** GET Storefront/GetActiveStorefrontCategories */
export interface StorefrontCategoryDto {
  id: string;
  name: string;
  isActive: boolean;
  dateCreated: string;
  productCount: number;
}

export interface StorefrontVariantDto {
  id: string;
  isDefault: boolean;
  isActive: boolean;
  colorId: string | null;
  configId: string | null;
  sizeId: string | null;
  styleId: string | null;
  versionId: string | null;
  priceInNaira: number;
  storefrontPrice: number;
  availableQuantity: number;
  isAvailable: boolean;
}

/** Shared product shape from GetProducts / GetProductsByStorefrontCategory */
export interface StorefrontProductDto {
  productId: string;
  productName: string;
  slug: string | null;
  shortDescription: string | null;
  brandName: string | null;
  categoryIds: string[] | null;
  images: string[] | null;
  isStorefrontPublished: boolean;
  variants: StorefrontVariantDto[] | null;
}

/** GET Storefront/GetStoreOwners */
export interface StorefrontStoreOwnerDto {
  id: string;
  companyName: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  isCacVerified: boolean;
  cacVerifiedAt: string | null;
}

export type StorefrontPagedProducts = PaginationResponse<StorefrontProductDto>;
export type StorefrontPagedStoreOwners = PaginationResponse<StorefrontStoreOwnerDto>;

/** GET storefront/wallet/balance */
export interface StorefrontWalletBalanceDto {
  walletId: string;
  ownerId: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

/** GET storefront/wallet | GET storefront/earnings/summary */
export interface StorefrontEarningsSummaryDto {
  currency: string;
  pending: number;
  available: number;
  withdrawn: number;
  reversed: number;
  totalEarned: number;
}

/** GET storefront/earnings | GET storefront/wallet/transactions */
export interface StorefrontEarningDto {
  id: string;
  orderId: string;
  externalOrderId: string | null;
  grossAmount: number;
  superAppAmount: number;
  fees: number;
  earnedAmount: number;
  currency: string;
  status: string;
  dateCreated: string;
}

/** GET storefront/wallet/ledger */
export interface StorefrontWalletLedgerDto {
  id: string;
  orderId: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: string | null;
  reference: string | null;
  description: string | null;
  status: string | null;
  externalOrderId: string | null;
  paymentReference: string | null;
  transactionDate: string;
}

export type StorefrontPagedEarnings = PaginationResponse<StorefrontEarningDto>;
export type StorefrontPagedWalletLedger = PaginationResponse<StorefrontWalletLedgerDto>;

export interface StorefrontQuoteLineRequest {
  productId: string;
  variantId: string;
  locationId: string;
  quantity: number;
}

export interface StorefrontQuoteRequest {
  products: StorefrontQuoteLineRequest[];
}

export interface StorefrontQuoteLineDto {
  variantId: string;
  quantity: number;
  unitPriceInNaira: number;
  lineTotalInNaira: number;
}

export interface StorefrontQuoteDto {
  lines: StorefrontQuoteLineDto[];
  totalInNaira: number;
}

export function pickDefaultVariant(product: StorefrontProductDto): StorefrontVariantDto | null {
  const variants = product.variants ?? [];
  return variants.find((v) => v.isDefault) ?? variants[0] ?? null;
}

/** Prefer a sellable variant over the placeholder default (often price/qty 0). */
export function pickDisplayVariant(product: StorefrontProductDto): StorefrontVariantDto | null {
  const variants = product.variants ?? [];
  return (
    variants.find((v) => v.isActive && v.isAvailable && v.priceInNaira > 0) ??
    variants.find((v) => v.isActive && v.priceInNaira > 0) ??
    variants.find((v) => v.isDefault) ??
    variants[0] ??
    null
  );
}

export function aggregateStorefrontAvailability(product: StorefrontProductDto) {
  const variants = (product.variants ?? []).filter((v) => v.isActive);
  return {
    totalQty: variants.reduce((sum, v) => sum + v.availableQuantity, 0),
    isAvailable: variants.some((v) => v.isAvailable),
  };
}

/** Markup % implied by storefront vs base NGN price. */
export function storefrontMarkupPercent(baseNaira: number, storefrontNaira: number): number | null {
  if (baseNaira <= 0) return null;
  return ((storefrontNaira / baseNaira) - 1) * 100;
}

export function formatStorefrontNaira(amount: number) {
  return `₦${Math.round(amount).toLocaleString()}`;
}

export function storefrontPriceFromMargin(baseNaira: number, marginPercent: number) {
  return baseNaira * (1 + marginPercent / 100);
}

export function productMarginSource(
  pricing: Pick<ProductStorefrontPricingDto, "productMargin" | "brandMargin">,
): ProductMarginSource {
  if (pricing.productMargin !== pricing.brandMargin) return "override";
  if (pricing.brandMargin > 0) return "inherited";
  return "unset";
}
