import { apiDelete, apiGet, apiPost, apiPut } from "./storefrontHttp";
import type { ApiResult, PaginationResponse, TicketResponse } from "./types";
import type {
  AddStorefrontBrandRequest,
  AddStorefrontCategoryRequest,
  ProductStorefrontPricingDto,
  SetProductVisibilityRequest,
  SetVariantStorefrontMarginRequest,
  StorefrontBrandAdminDto,
  StorefrontBrandDto,
  StorefrontBrandThemeDto,
  StorefrontBrandThemeRequest,
  StorefrontCategoryDto,
  StorefrontCategoryProductsRequest,
  StorefrontCommissionSettingsDto,
  StorefrontCommissionSettingsRequest,
  StorefrontDashboardDto,
  StorefrontEarningsSummaryDto,
  StorefrontOwnerBrandDto,
  StorefrontOwnerBrandMarginBulkRequest,
  StorefrontOwnerBrandSelectionRequest,
  StorefrontOwnerConfigurationRequest,
  StorefrontOwnerDetailDto,
  StorefrontOwnerInvitationResponse,
  StorefrontOwnerInvitationValidationResponse,
  StorefrontOwnerInvitationTokenRequest,
  StorefrontCouponRequestDecision,
  StorefrontCouponRequestResponse,
  StorefrontCouponRequestStatus,
  StorefrontPagedCouponRequests,
  CreateStorefrontCouponRequest,
  StorefrontPagedBrands,
  StorefrontPagedCategories,
  StorefrontPagedCategoryProducts,
  StorefrontPagedEarnings,
  StorefrontPagedOwnerCandidates,
  StorefrontPagedOwnerDetails,
  StorefrontPagedPayouts,
  StorefrontPagedProducts,
  StorefrontPagedStoreOwners,
  StorefrontPagedWalletLedger,
  StorefrontPagedWalletOrders,
  StorefrontPagedWalletTransactions,
  StorefrontPaidOrderRequest,
  StorefrontPaidOrderResponse,
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
  StorefrontSettlementCancellationRequest,
  StorefrontShippingOptionsDto,
  StorefrontShippingQuoteDto,
  StorefrontShippingQuoteRequest,
  StorefrontShippingRateDto,
  StorefrontShippingRateRequest,
  StorefrontSettlementRecoveryDto,
  StorefrontSettlementRefundCompletionRequest,
  StorefrontTicketCommentRequest,
  StorefrontTicketRequest,
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

// —— Storefront commission settings (OEM) ——

export function getStorefrontCommissionSettings() {
  return apiGet<StorefrontCommissionSettingsDto>("Storefront/GetCommissionSettings");
}

export function updateStorefrontCommissionSettings(
  body: StorefrontCommissionSettingsRequest,
) {
  return apiPut<StorefrontCommissionSettingsDto>(
    "Storefront/UpdateCommissionSettings",
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

// —— Storefront shipping ——

export function getStorefrontShippingOptions() {
  return apiGet<StorefrontShippingOptionsDto>("Storefront/GetShippingOptions");
}

export function getStorefrontShippingQuote(body: StorefrontShippingQuoteRequest) {
  return apiPost<StorefrontShippingQuoteDto>("Storefront/GetShippingQuote", body);
}

// —— Storefront shipping rates ——

export function getStorefrontShippingRates(params: { isActive?: boolean } = {}) {
  return apiGet<StorefrontShippingRateDto[]>(
    `Storefront/GetShippingRates${toQuery(params)}`,
  );
}

export function addStorefrontShippingRate(body: StorefrontShippingRateRequest) {
  return apiPost<StorefrontShippingRateDto>("Storefront/AddShippingRate", body);
}

export function updateStorefrontShippingRate(
  rateId: string,
  body: StorefrontShippingRateRequest,
) {
  return apiPut<StorefrontShippingRateDto>(
    `Storefront/UpdateShippingRate/${rateId}`,
    body,
  );
}

export function deleteStorefrontShippingRate(rateId: string) {
  return apiDelete<boolean>(`Storefront/DeleteShippingRate/${rateId}`);
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

// —— Store owner management (StorefrontOwner) ——

/** Rich store-owner list (invite status, suspension, primary brand). */
export function getStorefrontOwners(params: PagedParams = {}) {
  return apiGet<StorefrontPagedOwnerDetails>(
    `Storefront/GetStorefrontOwners${toQuery(params)}`,
  );
}

export function getAcceptedStorefrontOwners(params: PagedOwnerParams = {}) {
  return apiGet<StorefrontPagedOwnerDetails>(
    `Storefront/GetAcceptedStorefrontOwners${toQuery(params)}`,
  );
}

export function getOwnerCandidates(params: PagedOwnerParams = {}) {
  return apiGet<StorefrontPagedOwnerCandidates>(
    `Storefront/GetOwnerCandidates${toQuery(params)}`,
  );
}

export function getStorefrontOwner(ownerId: string) {
  return apiGet<StorefrontOwnerDetailDto>(
    `Storefront/GetStorefrontOwner/${encodeURIComponent(ownerId)}`,
  );
}

export function inviteStorefrontOwner(ownerId: string) {
  return apiPost<StorefrontOwnerInvitationResponse>(
    `Storefront/InviteStorefrontOwner/${encodeURIComponent(ownerId)}`,
  );
}

export function resendStorefrontOwnerInvitation(ownerId: string) {
  return apiPost<StorefrontOwnerInvitationResponse>(
    `Storefront/ResendStorefrontOwnerInvitation/${encodeURIComponent(ownerId)}`,
  );
}

export function revokeStorefrontOwnerInvitation(ownerId: string) {
  return apiPost<StorefrontOwnerInvitationResponse>(
    `Storefront/RevokeStorefrontOwnerInvitation/${encodeURIComponent(ownerId)}`,
  );
}

export function validateStorefrontOwnerInvitation(
  body: StorefrontOwnerInvitationTokenRequest,
) {
  return apiPost<StorefrontOwnerInvitationValidationResponse>(
    "Storefront/ValidateStorefrontOwnerInvitation",
    body,
  );
}

export function acceptStorefrontOwnerInvitation(
  body: StorefrontOwnerInvitationTokenRequest,
) {
  return apiPost<StorefrontOwnerInvitationValidationResponse>(
    "Storefront/AcceptStorefrontOwnerInvitation",
    body,
  );
}

export function configureStorefrontOwner(
  ownerId: string,
  body: StorefrontOwnerConfigurationRequest,
) {
  return apiPut<StorefrontOwnerDetailDto>(
    `Storefront/ConfigureStorefrontOwner/${encodeURIComponent(ownerId)}`,
    body,
  );
}

export function setStorefrontOwnerBrands(
  ownerId: string,
  body: StorefrontOwnerBrandSelectionRequest,
) {
  return apiPut<StorefrontOwnerBrandDto[]>(
    `Storefront/SetStorefrontOwnerBrands/${encodeURIComponent(ownerId)}`,
    body,
  );
}

export function setStorefrontOwnerBrandMargins(
  body: StorefrontOwnerBrandMarginBulkRequest,
) {
  return apiPut<StorefrontOwnerBrandDto[]>(
    "Storefront/SetStorefrontOwnerBrandMargins",
    body,
  );
}

export function getStorefrontOwnerBrands(ownerId: string) {
  return apiGet<StorefrontOwnerBrandDto[]>(
    `Storefront/GetStorefrontOwnerBrands/${encodeURIComponent(ownerId)}`,
  );
}

export function getStorefrontOwnerPrimaryBrand(ownerId: string) {
  return apiGet<StorefrontOwnerBrandDto>(
    `Storefront/GetStorefrontOwnerPrimaryBrand/${encodeURIComponent(ownerId)}`,
  );
}

export function getStorefrontBrandTheme(storefrontBrandId: string) {
  return apiGet<StorefrontBrandThemeDto>(
    `Storefront/GetStorefrontBrandTheme/${encodeURIComponent(storefrontBrandId)}`,
  );
}

export function setStorefrontBrandTheme(
  storefrontBrandId: string,
  body: StorefrontBrandThemeRequest,
) {
  return apiPut<StorefrontBrandThemeDto>(
    `Storefront/SetStorefrontBrandTheme/${encodeURIComponent(storefrontBrandId)}`,
    body,
  );
}

// —— Per-owner catalog & quote ——

export function getOwnerBrands(ownerId: string) {
  return apiGet<StorefrontBrandDto[]>(
    `Storefront/GetOwnerBrands/${encodeURIComponent(ownerId)}`,
  );
}

export function getOwnerProducts(
  ownerId: string,
  params: PagedOwnerParams & {
    storefrontCategoryId?: string;
    storefrontBrandId?: string;
  } = {},
) {
  return apiGet<StorefrontPagedProducts>(
    `Storefront/GetOwnerProducts/${encodeURIComponent(ownerId)}${toQuery(params)}`,
  );
}

export function getOwnerProduct(ownerId: string, productId: string) {
  return apiGet<StorefrontProductDto>(
    `Storefront/GetOwnerProduct/${encodeURIComponent(ownerId)}/${encodeURIComponent(productId)}`,
  );
}

export function getOwnerQuote(ownerId: string, body: StorefrontQuoteRequest) {
  return apiPost<StorefrontQuoteDto>(
    `Storefront/GetOwnerQuote/${encodeURIComponent(ownerId)}`,
    body,
  );
}

// —— Per-owner dashboard ——

export function getStorefrontOwnerDashboard(
  ownerId: string,
  params: {
    StartDate?: string;
    EndDate?: string;
    RecentActivitySize?: number;
  } = {},
) {
  return apiGet<StorefrontDashboardDto>(
    `admin/storefront/dashboard/${encodeURIComponent(ownerId)}${toQuery(params)}`,
  );
}

// —— Payout completion ops ——

export function createAdminPayoutForOwner(ownerId: string, body: StorefrontPayoutRequest) {
  return apiPost<StorefrontPayoutDto>(
    `admin/storefront/payouts/owner/${encodeURIComponent(ownerId)}`,
    body,
  );
}

export function cancelAdminPayoutForOwner(
  payoutId: string,
  ownerId: string,
  body: StorefrontPayoutDecisionRequest = {},
) {
  return apiPost<StorefrontPayoutDto>(
    `admin/storefront/payouts/${encodeURIComponent(payoutId)}/cancel-owner/${encodeURIComponent(ownerId)}`,
    body,
  );
}

// —— Settlement order parity ——

export function getStorefrontSettlementOrder(orderId: string) {
  return apiGet<StorefrontSettlementRecoveryDto>(
    `storefront/settlement-orders/${encodeURIComponent(orderId)}`,
  );
}

export function cancelStorefrontSettlementOrder(
  orderId: string,
  body: StorefrontSettlementCancellationRequest,
) {
  return apiPost<StorefrontSettlementRecoveryDto>(
    `storefront/settlement-orders/${encodeURIComponent(orderId)}/cancel`,
    body,
  );
}

export function completeStorefrontSettlementRefund(
  orderId: string,
  body: StorefrontSettlementRefundCompletionRequest,
) {
  return apiPost<StorefrontSettlementRecoveryDto>(
    `storefront/settlement-orders/${encodeURIComponent(orderId)}/refund-completed`,
    body,
  );
}

// —— Settlement recovery (admin) ——

export function getSettlementRecoveryOrder(orderId: string) {
  return apiGet<StorefrontSettlementRecoveryDto>(
    `admin/storefront/settlement-recovery/orders/${encodeURIComponent(orderId)}`,
  );
}

export function cancelSettlementRecoveryOrder(
  orderId: string,
  body: StorefrontSettlementCancellationRequest,
) {
  return apiPost<StorefrontSettlementRecoveryDto>(
    `admin/storefront/settlement-recovery/orders/${encodeURIComponent(orderId)}/cancel`,
    body,
  );
}

export function completeSettlementRecoveryRefund(
  orderId: string,
  body: StorefrontSettlementRefundCompletionRequest,
) {
  return apiPost<StorefrontSettlementRecoveryDto>(
    `admin/storefront/settlement-recovery/orders/${encodeURIComponent(orderId)}/refund-completed`,
    body,
  );
}

export function getPendingSettlementRefunds(maxCount = 100) {
  return apiGet<StorefrontSettlementRecoveryDto[]>(
    `admin/storefront/settlement-recovery/pending-refunds${toQuery({ maxCount })}`,
  );
}

export function recoverFailedDynamicsSettlements() {
  return apiPost<number>("admin/storefront/settlement-recovery/recover-failed-dynamics");
}

// —— Per-owner storefront tickets ——

type PagedTicketParams = PagedOwnerParams & {
  ticketStatus?: string;
  ticketCategory?: string;
};

export function getStorefrontTickets(ownerId: string, params: PagedTicketParams = {}) {
  return apiGet<PaginationResponse<TicketResponse>>(
    `admin/storefront/tickets/${encodeURIComponent(ownerId)}${toQuery(params)}`,
  );
}

export function createStorefrontTicket(ownerId: string, body: StorefrontTicketRequest) {
  return apiPost<TicketResponse>(
    `admin/storefront/tickets/${encodeURIComponent(ownerId)}`,
    body,
  );
}

export function getStorefrontTicket(ownerId: string, ticketId: string) {
  return apiGet<TicketResponse>(
    `admin/storefront/tickets/${encodeURIComponent(ownerId)}/${encodeURIComponent(ticketId)}`,
  );
}

export function addStorefrontTicketComment(
  ownerId: string,
  ticketId: string,
  body: StorefrontTicketCommentRequest,
) {
  return apiPost<TicketResponse>(
    `admin/storefront/tickets/${encodeURIComponent(ownerId)}/${encodeURIComponent(ticketId)}/comments`,
    body,
  );
}

// —— Store owner coupon requests ——

type CouponRequestListParams = PagedParams & {
  status?: StorefrontCouponRequestStatus;
};

export function getStorefrontCouponRequests(params: CouponRequestListParams = {}) {
  return apiGet<StorefrontPagedCouponRequests>(
    `admin/storefront/owner-coupon-requests${toQuery(params)}`,
  );
}

export function getStorefrontCouponRequest(requestId: string) {
  return apiGet<StorefrontCouponRequestResponse>(
    `admin/storefront/owner-coupon-requests/${encodeURIComponent(requestId)}`,
  );
}

export function getOwnerCouponRequests(ownerId: string, params: PagedParams = {}) {
  return apiGet<StorefrontPagedCouponRequests>(
    `admin/storefront/owner-coupon-requests/owner/${encodeURIComponent(ownerId)}${toQuery(params)}`,
  );
}

export function createOwnerCouponRequest(ownerId: string, body: CreateStorefrontCouponRequest) {
  return apiPost<StorefrontCouponRequestResponse>(
    `admin/storefront/owner-coupon-requests/owner/${encodeURIComponent(ownerId)}`,
    body,
  );
}

export function decideStorefrontCouponRequest(
  requestId: string,
  body: StorefrontCouponRequestDecision,
) {
  return apiPut<StorefrontCouponRequestResponse>(
    `admin/storefront/owner-coupon-requests/${encodeURIComponent(requestId)}/decision`,
    body,
  );
}

// —— Brand API ——

export interface BrandDto {
  id: string;
  name: string;
  brandImageUrl: string | null;
  dynamicsId: string | null;
  isActive: boolean;
}

export interface BrandProductDto {
  id: string;
  productName: string;
  brand: BrandDto;
  priceInNaira: number;
  priceInDollar: number;
  dynamicsId: string | null;
  isActive: boolean;
  productImageUrls: Array<{ imageUrl: string }> | null;
}

export function getAllBrands(params: {
  PageSize?: number;
  PageNumber?: number;
  SearchString?: string;
  isActive?: boolean;
} = {}) {
  return apiGet<PaginationResponse<BrandDto>>(
    `Brand/GetAllBrands${toQuery(params)}`,
  );
}

export function getBrandProducts(
  brandId: string,
  params: {
    PageSize?: number;
    PageNumber?: number;
    SearchString?: string;
  } = {},
) {
  return apiGet<PaginationResponse<BrandProductDto>>(
    `Brand/GetBrandProducts/${brandId}/products${toQuery(params)}`,
  );
}
