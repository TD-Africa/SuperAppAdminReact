import { apiDelete, apiGet, apiPost, apiPut } from "./storefrontHttp";
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
  StorefrontPaidOrderRequest,
  StorefrontPaidOrderResponse,
  StorefrontPagedBrands,
  StorefrontPagedCategories,
  StorefrontPagedCategoryProducts,
  StorefrontPagedEarnings,
  StorefrontPagedPayouts,
  StorefrontPagedProducts,
  StorefrontPagedStoreOwners,
  StorefrontPagedWalletLedger,
  StorefrontPagedWalletOrders,
  StorefrontPagedWalletTransactions,
  StorefrontPayoutAuditDto,
  StorefrontPayoutDecisionRequest,
  StorefrontPayoutDto,
  StorefrontPayoutJobDto,
  StorefrontPayoutRequest,
  StorefrontPayoutStatus,
  StorefrontProductCategoriesRequest,
  StorefrontProductDto,
  StorefrontQuoteDto,
  StorefrontQuoteRequest,
  StorefrontWalletAdjustmentRequest,
  StorefrontWalletBalanceDto,
  StorefrontWalletStatsDto,
  StorefrontWalletTransactionDto,
  SuperAdminPagedTransactions,
  SuperAdminWalletAdjustmentRequest,
  SuperAdminWalletDto,
  SuperAdminWalletTransactionDeleteRequest,
  SuperAdminWalletTransactionDto,
  SuperAdminWalletTransactionUpdateRequest,
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

type PagedParams = {
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

// —— Settlement wallet (storefront/settlement-wallet) ——

export function getSettlementWallet() {
  return apiGet<StorefrontWalletBalanceDto>("storefront/settlement-wallet");
}

export function getSettlementWalletBalance(params: OwnerScope = {}) {
  return apiGet<StorefrontWalletBalanceDto>(
    `storefront/settlement-wallet/balance${toQuery(params)}`,
  );
}

export function getSettlementWalletLedger(params: PagedParams = {}) {
  return apiGet<StorefrontPagedWalletLedger>(
    `storefront/settlement-wallet/ledger${toQuery(params)}`,
  );
}

export function getSettlementWalletTransactions(params: PagedParams = {}) {
  return apiGet<StorefrontPagedWalletTransactions>(
    `storefront/settlement-wallet/transactions${toQuery(params)}`,
  );
}

export function getSettlementWalletHistory(params: PagedParams = {}) {
  return apiGet<StorefrontPagedWalletTransactions>(
    `storefront/settlement-wallet/history${toQuery(params)}`,
  );
}

export function getSettlementWalletStats() {
  return apiGet<StorefrontWalletStatsDto>("storefront/settlement-wallet/stats");
}

export function getSettlementWalletOrders(params: PagedParams = {}) {
  return apiGet<StorefrontPagedWalletOrders>(
    `storefront/settlement-wallet/orders${toQuery(params)}`,
  );
}

/** @deprecated Use getSettlementWalletBalance */
export function getStorefrontWalletBalance(params: OwnerScope = {}) {
  return getSettlementWalletBalance(params);
}

/** @deprecated Use getSettlementWallet */
export function getStorefrontWallet(params: OwnerScope = {}) {
  return apiGet<StorefrontEarningsSummaryDto>(
    `storefront/settlement-wallet${toQuery(params)}`,
  );
}

/** @deprecated Use getSettlementWalletLedger */
export function getStorefrontWalletLedger(params: PagedOwnerParams = {}) {
  return getSettlementWalletLedger(params);
}

/** @deprecated Use getSettlementWalletTransactions */
export function getStorefrontWalletTransactions(params: PagedOwnerParams = {}) {
  return getSettlementWalletTransactions(params);
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

// —— Admin storefront payouts ——

type AdminPayoutListParams = PagedParams & {
  ownerId?: string;
  status?: StorefrontPayoutStatus;
};

export function getAdminPayouts(params: AdminPayoutListParams = {}) {
  return apiGet<StorefrontPagedPayouts>(
    `admin/storefront/payouts${toQuery(params)}`,
  );
}

export function getAdminPayout(payoutId: string) {
  return apiGet<StorefrontPayoutDto>(`admin/storefront/payouts/${payoutId}`);
}

export function getAdminPayoutAudit(payoutId: string) {
  return apiGet<StorefrontPayoutAuditDto[]>(
    `admin/storefront/payouts/${payoutId}/audit`,
  );
}

export function approveAdminPayout(payoutId: string) {
  return apiPost<StorefrontPayoutDto>(
    `admin/storefront/payouts/${payoutId}/approve`,
  );
}

export function rejectAdminPayout(
  payoutId: string,
  body: StorefrontPayoutDecisionRequest = {},
) {
  return apiPost<StorefrontPayoutDto>(
    `admin/storefront/payouts/${payoutId}/reject`,
    body,
  );
}

export function processAdminPayout(payoutId: string) {
  return apiPost<StorefrontPayoutDto>(
    `admin/storefront/payouts/${payoutId}/process`,
  );
}

export function queueApprovedAdminPayouts(maxPayouts = 100) {
  return apiPost<StorefrontPayoutJobDto>(
    `admin/storefront/payouts/queue-approved${toQuery({ maxPayouts })}`,
  );
}

// —— Storefront payouts (owner-scoped) ——

export function getStorefrontPayouts(
  params: PagedParams & { status?: StorefrontPayoutStatus } = {},
) {
  return apiGet<StorefrontPagedPayouts>(`storefront/payouts${toQuery(params)}`);
}

export function requestStorefrontPayout(body: StorefrontPayoutRequest) {
  return apiPost<StorefrontPayoutDto>("storefront/payouts", body);
}

export function getStorefrontPayout(payoutId: string) {
  return apiGet<StorefrontPayoutDto>(`storefront/payouts/${payoutId}`);
}

export function getStorefrontPayoutAudit(payoutId: string) {
  return apiGet<StorefrontPayoutAuditDto[]>(
    `storefront/payouts/${payoutId}/audit`,
  );
}

export function cancelStorefrontPayout(
  payoutId: string,
  body: StorefrontPayoutDecisionRequest = {},
) {
  return apiPost<StorefrontPayoutDto>(
    `storefront/payouts/${payoutId}/cancel`,
    body,
  );
}

// —— Admin storefront wallets ——

export function getAdminStorefrontWallet(ownerId: string) {
  return apiGet<StorefrontWalletBalanceDto>(
    `admin/storefront/wallets/${encodeURIComponent(ownerId)}`,
  );
}

export function getAdminStorefrontWalletStats(ownerId: string) {
  return apiGet<StorefrontWalletStatsDto>(
    `admin/storefront/wallets/${encodeURIComponent(ownerId)}/stats`,
  );
}

export function getAdminStorefrontWalletTransactions(
  ownerId: string,
  params: PagedParams = {},
) {
  return apiGet<StorefrontPagedWalletTransactions>(
    `admin/storefront/wallets/${encodeURIComponent(ownerId)}/transactions${toQuery(params)}`,
  );
}

export function getAdminStorefrontWalletOrders(
  ownerId: string,
  params: PagedParams = {},
) {
  return apiGet<StorefrontPagedWalletOrders>(
    `admin/storefront/wallets/${encodeURIComponent(ownerId)}/orders${toQuery(params)}`,
  );
}

export function creditAdminStorefrontWallet(
  ownerId: string,
  body: StorefrontWalletAdjustmentRequest,
) {
  return apiPost<StorefrontWalletTransactionDto>(
    `admin/storefront/wallets/${encodeURIComponent(ownerId)}/credit`,
    body,
  );
}

export function debitAdminStorefrontWallet(
  ownerId: string,
  body: StorefrontWalletAdjustmentRequest,
) {
  return apiPost<StorefrontWalletTransactionDto>(
    `admin/storefront/wallets/${encodeURIComponent(ownerId)}/debit`,
    body,
  );
}

// —— Super admin wallet ——

export function getSuperAdminWallet() {
  return apiGet<SuperAdminWalletDto>("admin/storefront/superadmin-wallet");
}

export function getSuperAdminWalletTransactions(params: PagedParams = {}) {
  return apiGet<SuperAdminPagedTransactions>(
    `admin/storefront/superadmin-wallet/transactions${toQuery(params)}`,
  );
}

export function getSuperAdminWalletTransaction(transactionId: string) {
  return apiGet<SuperAdminWalletTransactionDto>(
    `admin/storefront/superadmin-wallet/transactions/${transactionId}`,
  );
}

export function updateSuperAdminWalletTransaction(
  transactionId: string,
  body: SuperAdminWalletTransactionUpdateRequest,
) {
  return apiPut<SuperAdminWalletTransactionDto>(
    `admin/storefront/superadmin-wallet/transactions/${transactionId}`,
    body,
  );
}

export function deleteSuperAdminWalletTransaction(
  transactionId: string,
  body: SuperAdminWalletTransactionDeleteRequest,
) {
  return apiDelete<SuperAdminWalletTransactionDto>(
    `admin/storefront/superadmin-wallet/transactions/${transactionId}`,
    { data: body },
  );
}

export function creditSuperAdminWallet(body: SuperAdminWalletAdjustmentRequest) {
  return apiPost<SuperAdminWalletTransactionDto>(
    "admin/storefront/superadmin-wallet/credit",
    body,
  );
}

export function debitSuperAdminWallet(body: SuperAdminWalletAdjustmentRequest) {
  return apiPost<SuperAdminWalletTransactionDto>(
    "admin/storefront/superadmin-wallet/debit",
    body,
  );
}

// —— Storefront orders ——

export function createStorefrontOrder(body: StorefrontPaidOrderRequest) {
  return apiPost<StorefrontPaidOrderResponse>("storefront/orders", body);
}

export function createStorefrontSettlementOrder(body: StorefrontPaidOrderRequest) {
  return apiPost<StorefrontPaidOrderResponse>("storefront/settlement-orders", body);
}
