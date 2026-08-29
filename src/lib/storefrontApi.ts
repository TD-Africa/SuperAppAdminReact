import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import type { ApiResult } from "./types";
import type {
  AddStorefrontBrandRequest,
  AddStorefrontCategoryRequest,
  ProductStorefrontPricingDto,
  SetProductVisibilityRequest,
  SetVariantStorefrontMarginRequest,
  StorefrontBrandAdminDto,
  StorefrontBrandDto,
  StorefrontCategoryDto,
  StorefrontCategoryProductsRequest,
  StorefrontEarningsSummaryDto,
  StorefrontPagedBrands,
  StorefrontPagedCategories,
  StorefrontPagedCategoryProducts,
  StorefrontPagedEarnings,
  StorefrontPagedProducts,
  StorefrontPagedStoreOwners,
  StorefrontPagedWalletLedger,
  StorefrontProductCategoriesRequest,
  StorefrontProductDto,
  StorefrontQuoteDto,
  StorefrontQuoteRequest,
  StorefrontWalletBalanceDto,
  UpdateStorefrontBrandRequest,
  UpdateStorefrontCategoryRequest,
  VariantStorefrontPricingDto,
} from "./storefrontTypes";

function toQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Optional owner scope for admin views (backend may ignore until supported). */
type OwnerScope = { ownerId?: string };

type PagedOwnerParams = OwnerScope & {
  PageSize?: number;
  PageNumber?: number;
  SearchString?: string;
};

export function getActiveStorefrontBrands() {
  return apiGet<StorefrontBrandDto[]>("Storefront/GetActiveStorefrontBrands");
}

export function getStorefrontBrands(params: {
  PageSize?: number;
  PageNumber?: number;
  SearchString?: string;
  isActive?: boolean;
}) {
  return apiGet<StorefrontPagedBrands>(
    `Storefront/GetStorefrontBrands${toQuery(params)}`,
  );
}

export function addStorefrontBrand(body: AddStorefrontBrandRequest) {
  return apiPost<StorefrontBrandAdminDto>("Storefront/AddStorefrontBrand", body);
}

export function updateStorefrontBrand(
  storefrontBrandId: string,
  body: UpdateStorefrontBrandRequest,
) {
  return apiPut<StorefrontBrandAdminDto>(
    `Storefront/UpdateStorefrontBrand/${storefrontBrandId}`,
    body,
  );
}

export function deleteStorefrontBrand(storefrontBrandId: string) {
  return apiDelete<boolean>(`Storefront/DeleteStorefrontBrand/${storefrontBrandId}`);
}

/** No dedicated get-by-id endpoint — scan paginated list. */
export async function getStorefrontBrandById(
  storefrontBrandId: string,
): Promise<ApiResult<StorefrontBrandAdminDto>> {
  const pageSize = 50;
  let pageNumber = 1;

  while (true) {
    const res = await getStorefrontBrands({ PageSize: pageSize, PageNumber: pageNumber });
    if (!res.status) return { data: null, message: res.message, status: false };

    const found = res.data?.data?.find((brand) => brand.id === storefrontBrandId) ?? null;
    if (found) return { data: found, message: res.message, status: true };

    const total = res.data?.count ?? 0;
    if (pageNumber * pageSize >= total) {
      return { data: null, message: "Storefront brand not found", status: false };
    }
    pageNumber += 1;
  }
}

export function getActiveStorefrontCategories() {
  return apiGet<StorefrontCategoryDto[]>("Storefront/GetActiveStorefrontCategories");
}

export function getStorefrontCategories(params: {
  PageSize?: number;
  PageNumber?: number;
  SearchString?: string;
  isActive?: boolean;
} = {}) {
  return apiGet<StorefrontPagedCategories>(
    `Storefront/GetStorefrontCategories${toQuery(params)}`,
  );
}

export function addStorefrontCategory(body: AddStorefrontCategoryRequest) {
  return apiPost<StorefrontCategoryDto>("Storefront/AddStorefrontCategory", body);
}

export function updateStorefrontCategory(
  storefrontCategoryId: string,
  body: UpdateStorefrontCategoryRequest,
) {
  return apiPut<StorefrontCategoryDto>(
    `Storefront/UpdateStorefrontCategory/${storefrontCategoryId}`,
    body,
  );
}

export function deleteStorefrontCategory(storefrontCategoryId: string) {
  return apiDelete<boolean>(
    `Storefront/DeleteStorefrontCategory/${storefrontCategoryId}`,
  );
}

export function addProductsToStorefrontCategory(body: StorefrontCategoryProductsRequest) {
  return apiPost<boolean>("Storefront/AddProductsToStorefrontCategory", body);
}

export function removeProductsFromStorefrontCategory(body: StorefrontCategoryProductsRequest) {
  return apiPost<boolean>("Storefront/RemoveProductsFromStorefrontCategory", body);
}

export function addStorefrontCategoriesToProduct(body: StorefrontProductCategoriesRequest) {
  return apiPost<boolean>("Storefront/AddStorefrontCategoriesToProduct", body);
}

export function removeStorefrontCategoriesFromProduct(body: StorefrontProductCategoriesRequest) {
  return apiPost<boolean>("Storefront/RemoveStorefrontCategoriesFromProduct", body);
}

/** No dedicated get-by-id — scan paginated list. */
export async function getStorefrontCategoryById(
  storefrontCategoryId: string,
): Promise<ApiResult<StorefrontCategoryDto>> {
  const pageSize = 50;
  let pageNumber = 1;

  while (true) {
    const res = await getStorefrontCategories({ PageSize: pageSize, PageNumber: pageNumber });
    if (!res.status) return { data: null, message: res.message, status: false };

    const found =
      res.data?.data?.find((category) => category.id === storefrontCategoryId) ?? null;
    if (found) return { data: found, message: res.message, status: true };

    const total = res.data?.count ?? 0;
    if (pageNumber * pageSize >= total) {
      return { data: null, message: "Storefront category not found", status: false };
    }
    pageNumber += 1;
  }
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
  return apiGet<StorefrontPagedCategoryProducts>(
    `Storefront/GetProductsByStorefrontCategory/${storefrontCategoryId}${toQuery(params)}`,
  );
}

export function getProductStorefrontPricing(productId: string) {
  return apiGet<ProductStorefrontPricingDto>(
    `Storefront/GetProductStorefrontPricing/${productId}`,
  );
}

export function setProductStorefrontMargin(body: {
  productId: string;
  storefrontPriceMargin: number;
}) {
  return apiPut<ProductStorefrontPricingDto>(
    "Storefront/SetProductStorefrontMargin",
    body,
  );
}

export function setProductVisibility(body: SetProductVisibilityRequest) {
  return apiPut<boolean>("Storefront/SetProductVisibility", body);
}

export function getVariantStorefrontPricing(variantId: string) {
  return apiGet<VariantStorefrontPricingDto>(
    `Storefront/GetVariantStorefrontPricing/${variantId}`,
  );
}

export function setVariantStorefrontMargin(body: SetVariantStorefrontMarginRequest) {
  return apiPut<VariantStorefrontPricingDto>(
    "Storefront/SetVariantStorefrontMargin",
    body,
  );
}

export function getPublishedProduct(productId: string) {
  return apiGet<StorefrontProductDto>(`Storefront/GetPublishedProduct/${productId}`);
}

export function getStorefrontCategoriesByProduct(productId: string) {
  return apiGet<StorefrontCategoryDto[]>(
    `Storefront/GetStorefrontCategoriesByProduct/${productId}`,
  );
}

export function quoteStorefront(body: StorefrontQuoteRequest): Promise<ApiResult<StorefrontQuoteDto>> {
  return apiPost<StorefrontQuoteDto>("Storefront/Quote", body);
}

export function getStorefrontWalletBalance(params: OwnerScope = {}) {
  return apiGet<StorefrontWalletBalanceDto>(
    `storefront/wallet/balance${toQuery(params)}`,
  );
}

export function getStorefrontWallet(params: OwnerScope = {}) {
  return apiGet<StorefrontEarningsSummaryDto>(
    `storefront/wallet${toQuery(params)}`,
  );
}

export function getStorefrontWalletLedger(params: PagedOwnerParams = {}) {
  return apiGet<StorefrontPagedWalletLedger>(
    `storefront/wallet/ledger${toQuery(params)}`,
  );
}

export function getStorefrontWalletTransactions(params: PagedOwnerParams = {}) {
  return apiGet<StorefrontPagedEarnings>(
    `storefront/wallet/transactions${toQuery(params)}`,
  );
}

export function getStorefrontEarningsSummary(params: OwnerScope = {}) {
  return apiGet<StorefrontEarningsSummaryDto>(
    `storefront/earnings/summary${toQuery(params)}`,
  );
}

export function getStorefrontEarnings(params: PagedOwnerParams = {}) {
  return apiGet<StorefrontPagedEarnings>(
    `storefront/earnings${toQuery(params)}`,
  );
}
