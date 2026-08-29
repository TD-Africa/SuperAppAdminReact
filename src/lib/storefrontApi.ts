import { apiGet, apiPost, apiPut } from "./api";
import type { ApiResult } from "./types";
import type {
  ProductStorefrontPricingDto,
  StorefrontBrandAdminDto,
  StorefrontBrandDto,
  StorefrontCategoryDto,
  StorefrontEarningsSummaryDto,
  StorefrontPagedBrands,
  StorefrontPagedEarnings,
  StorefrontPagedProducts,
  StorefrontPagedStoreOwners,
  StorefrontPagedWalletLedger,
  StorefrontQuoteDto,
  StorefrontQuoteRequest,
  StorefrontWalletBalanceDto,
  UpdateStorefrontBrandRequest,
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

export function updateStorefrontBrand(
  storefrontBrandId: string,
  body: UpdateStorefrontBrandRequest,
) {
  return apiPut<StorefrontBrandAdminDto>(
    `Storefront/UpdateStorefrontBrand/${storefrontBrandId}`,
    body,
  );
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
