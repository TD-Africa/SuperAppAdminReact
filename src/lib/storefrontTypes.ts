import type { PaginationResponse } from "./types";

/** GET Storefront/GetActiveStorefrontBrands */
export interface StorefrontBrandDto {
  id: string;
  name: string;
  brandImageUrl: string | null;
}

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

/** Shared product shape from GetProducts / GetProductsByStorefrontCategory / GetProductStorefrontPricing */
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

/** Markup % implied by storefront vs base NGN price. */
export function storefrontMarkupPercent(baseNaira: number, storefrontNaira: number): number | null {
  if (baseNaira <= 0) return null;
  return ((storefrontNaira / baseNaira) - 1) * 100;
}

export function formatStorefrontNaira(amount: number) {
  return `₦${Math.round(amount).toLocaleString()}`;
}
