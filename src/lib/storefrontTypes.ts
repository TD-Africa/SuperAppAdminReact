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

/** POST AddStorefrontBrand — same fields as update (no storefront brand id yet). */
export type AddStorefrontBrandRequest = UpdateStorefrontBrandRequest;

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

/** GET GetVariantStorefrontPricing | PUT SetVariantStorefrontMargin response */
export interface VariantStorefrontPricingDto {
  variantId: string;
  productId: string;
  priceInNaira: number;
  productMargin: number;
  brandMargin: number;
  effectiveMargin: number;
  storefrontPrice: number;
}

export interface SetVariantStorefrontMarginRequest {
  variantId: string;
  storefrontPriceMargin: number;
}

export interface SetProductVisibilityRequest {
  productId: string;
  isVisible: boolean;
}

export type StorefrontPagedBrands = PaginationResponse<StorefrontBrandAdminDto>;

export type ProductMarginSource = "override" | "inherited" | "unset";

/** GET Storefront/GetActiveStorefrontCategories | GetStorefrontCategoriesByProduct */
export interface StorefrontCategoryDto {
  id: string;
  name: string;
  isActive: boolean;
  dateCreated: string;
  productCount: number;
}

export type StorefrontPagedCategories = PaginationResponse<StorefrontCategoryDto>;

export interface AddStorefrontCategoryRequest {
  name: string;
  isActive: boolean;
}

export interface UpdateStorefrontCategoryRequest {
  name: string;
  isActive: boolean;
}

export interface StorefrontCategoryProductsRequest {
  storefrontCategoryId: string;
  productIds: string[];
}

export interface StorefrontProductCategoriesRequest {
  productId: string;
  storefrontCategoryIds: string[];
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

/** Shared product shape from GetProducts / GetPublishedProduct */
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

/** GET GetProductsByStorefrontCategory/{storefrontCategoryId} */
export interface StorefrontCategoryProductDto {
  productId: string;
  productName: string;
  dynamicsId: string;
  isActive: boolean;
  priceInNaira: number;
  storefrontPriceMargin: number;
  storefrontPrice: number;
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
export type StorefrontPagedCategoryProducts = PaginationResponse<StorefrontCategoryProductDto>;
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

// —— Payouts ——

export type StorefrontPayoutStatus =
  | "Requested"
  | "Approved"
  | "Processing"
  | "Paid"
  | "Rejected"
  | "Failed"
  | "Cancelled";

export interface StorefrontPayoutDto {
  id: string;
  ownerId: string | null;
  walletId: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string | null;
  status: StorefrontPayoutStatus;
  requestReference: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumberLast4: string | null;
  paystackRecipientCode: string | null;
  paystackTransferCode: string | null;
  paystackReference: string | null;
  reason: string | null;
  failureReason: string | null;
  requestedAt: string;
  approvedAt: string | null;
  processingAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
}

export interface StorefrontPayoutAuditDto {
  id: string;
  payoutId: string;
  action: string | null;
  fromStatus: StorefrontPayoutStatus;
  toStatus: StorefrontPayoutStatus;
  actorUserId: string | null;
  note: string | null;
  dateCreated: string;
}

export interface StorefrontPayoutDecisionRequest {
  reason?: string | null;
}

export interface StorefrontPayoutRequest {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName?: string | null;
  idempotencyKey?: string | null;
  reason?: string | null;
  currency: string;
}

export interface StorefrontPayoutJobDto {
  queuedCount: number;
  payoutIds: string[] | null;
}

export type StorefrontPagedPayouts = PaginationResponse<StorefrontPayoutDto>;

// —— Admin / settlement wallet ——

export interface StorefrontWalletAdjustmentRequest {
  amount: number;
  reference: string;
  description: string;
}

export interface StorefrontWalletTransactionDto {
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
  transactionKind: string | null;
  payoutId: string | null;
  providerReference: string | null;
  createdByUserId: string | null;
  transactionDate: string;
}

export interface StorefrontWalletStatsDto {
  ownerId: string | null;
  walletId: string | null;
  currency: string | null;
  walletBalance: number;
  totalOrders: number;
  paidOrders: number;
  revenue: number;
  totalCommission: number;
  currentCommission: number;
  commissionPaid: number;
  pendingCommission: number;
  ordersWaitingForCommission: number;
  reservedForPayout: number;
  totalPayoutsPaid: number;
}

export interface StorefrontWalletOrderDto {
  orderId: string;
  orderReference: string | null;
  externalOrderId: string | null;
  amount: number;
  commission: number;
  commissionStatus: string;
  isPaid: boolean;
  isDynamicsPosted: boolean;
  orderStatus: string | null;
  customerName: string | null;
  dateCreated: string;
}

export type StorefrontPagedWalletTransactions =
  PaginationResponse<StorefrontWalletTransactionDto>;
export type StorefrontPagedWalletOrders = PaginationResponse<StorefrontWalletOrderDto>;

// —— Super admin wallet ——

export interface SuperAdminWalletDto {
  walletId: string | null;
  walletKey: string | null;
  balance: number;
  currency: string | null;
  updatedAt: string | null;
}

export interface SuperAdminWalletAdjustmentRequest {
  amount: number;
  reference: string;
  description: string;
}

export interface SuperAdminWalletTransactionDto {
  id: string;
  isDeleted: boolean;
  orderId: string | null;
  storefrontOwnerId: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: string | null;
  transactionKind: string | null;
  reference: string | null;
  description: string | null;
  status: string | null;
  externalOrderId: string | null;
  paymentReference: string | null;
  createdByUserId: string | null;
  metadataJson: string | null;
  transactionDate: string;
}

export interface SuperAdminWalletTransactionUpdateRequest {
  amount: number;
  type: string;
  reference: string;
  description: string;
  metadataJson?: string | null;
}

export interface SuperAdminWalletTransactionDeleteRequest {
  reason: string;
}

export type SuperAdminPagedTransactions =
  PaginationResponse<SuperAdminWalletTransactionDto>;

// —— Storefront orders ——

export interface StorefrontProductQuantity {
  productId: string;
  variantId?: string;
  locationId?: string | null;
  quantity: number;
}

export interface StorefrontPaidOrderRequest {
  storefrontOwnerId: string;
  externalOrderId: string;
  paymentReference: string;
  amountPaid?: number;
  fees?: number;
  currency: string;
  products?: StorefrontProductQuantity[] | null;
  deliveryMethodId: string;
  deliveryAddress?: string | null;
  locationId?: string | null;
  name: string;
  phoneNumber: string;
  email?: string | null;
  referralId?: string | null;
}

export interface StorefrontPaidOrderResponse {
  orderId: string;
  externalOrderId: string | null;
  storefrontOwnerId: string | null;
  superAppAmount: number;
  storefrontAmountPaid: number;
  currency: string | null;
  isPaid: boolean;
  isDynamicsPosted: boolean;
  walletCreditAmount: number;
  walletDebitAmount: number;
  walletFeeAmount: number;
  storefrontEarningAmount: number;
  storefrontWalletBalanceAfter: number | null;
  superAdminWalletCreditAmount: number;
  superAdminWalletBalance: number | null;
  earning: StorefrontEarningDto | null;
}
