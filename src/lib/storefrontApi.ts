import { apiGet, apiPost } from "./api";
import type { ApiResult } from "./types";
import type {
  StorefrontBrandDto,
  StorefrontCategoryDto,
  StorefrontPagedProducts,
  StorefrontPagedStoreOwners,
  StorefrontProductDto,
  StorefrontQuoteDto,
  StorefrontQuoteRequest,
} from "./storefrontTypes";

function toQuery(params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function getActiveStorefrontBrands() {
  return apiGet<StorefrontBrandDto[]>("Storefront/GetActiveStorefrontBrands");
}

export function getActiveStorefrontCategories() {
  return apiGet<StorefrontCategoryDto[]>("Storefront/GetActiveStorefrontCategories");
}

export function getStoreOwners(params: {
  PageSize?: number;
  PageNumber?: number;
  SearchString?: string;
}) {
  return apiGet<StorefrontPagedStoreOwners>(
    `Storefront/GetStoreOwners${toQuery(params)}`,
  );
}

export function getStorefrontProducts(params: {
  PageSize?: number;
  PageNumber?: number;
  SearchString?: string;
  storefrontBrandId?: string;
}) {
  return apiGet<StorefrontPagedProducts>(
    `Storefront/GetProducts${toQuery(params)}`,
  );
}

export function getProductsByStorefrontCategory(
  storefrontCategoryId: string,
  params: {
    PageSize?: number;
    PageNumber?: number;
    SearchString?: string;
    storefrontBrandId?: string;
  } = {},
) {
  return apiGet<StorefrontPagedProducts>(
    `Storefront/GetProductsByStorefrontCategory/${storefrontCategoryId}${toQuery(params)}`,
  );
}

export function getProductStorefrontPricing(productId: string) {
  return apiGet<StorefrontProductDto>(
    `Storefront/GetProductStorefrontPricing/${productId}`,
  );
}

export function getStorefrontCategoriesByProduct(productId: string) {
  return apiGet<StorefrontCategoryDto[]>(
    `Storefront/GetStorefrontCategoriesByProduct/${productId}`,
  );
}

export function quoteStorefront(body: StorefrontQuoteRequest): Promise<ApiResult<StorefrontQuoteDto>> {
  return apiPost<StorefrontQuoteDto>("Storefront/Quote", body);
}
