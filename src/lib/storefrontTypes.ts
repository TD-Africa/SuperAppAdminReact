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
  withdrawnAmount: number;
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

// —— Storefront shipping (StorefrontShipping) ——

/** GET Storefront/GetShippingOptions */
export interface StorefrontShippingOptionsDto {
  originRegions: string[] | null;
  destinationRegions: string[] | null;
  paymentModes: string[] | null;
  defaultOriginRegion: string | null;
  defaultPaymentMode: string | null;
  baseWeightKg: number;
}

/** POST Storefront/GetShippingQuote request */
export interface StorefrontShippingQuoteRequest {
  originRegion: string;
  destinationRegion: string;
  weightKg: number;
  paymentMode: string;
}

/** POST Storefront/GetShippingQuote response */
export interface StorefrontShippingQuoteDto {
  originRegion: string | null;
  destinationRegion: string | null;
  paymentMode: string | null;
  weightKg: number;
  baseWeightKg: number;
  extraKgCount: number;
  baseFee: number;
  extraKgFee: number;
  totalFee: number;
  currency: string | null;
}

// —— Storefront shipping rates (StorefrontShippingRate) ——

/** POST Storefront/AddShippingRate | PUT Storefront/UpdateShippingRate request */
export interface StorefrontShippingRateRequest {
  originRegion: string;
  destinationRegion: string;
  paymentMode: string;
  baseFee: number;
  extraKgFee: number;
  currency: string;
  isActive: boolean;
}

/** GET Storefront/GetShippingRates | POST AddShippingRate | PUT UpdateShippingRate response */
export interface StorefrontShippingRateDto {
  id: string;
  originRegion: string | null;
  destinationRegion: string | null;
  paymentMode: string | null;
  baseFee: number;
  extraKgFee: number;
  currency: string | null;
  isActive: boolean;
  dateCreated: string;
  dateModified: string | null;
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
  commissionReconciled: boolean;
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
  shippingFee?: number;
  shippingOriginRegion?: string | null;
  shippingDestinationRegion?: string | null;
  shippingWeightKg?: number;
  shippingPaymentMode?: string | null;
}

export interface StorefrontPaidOrderResponse {
  orderId: string;
  externalOrderId: string | null;
  storefrontOwnerId: string | null;
  superAppAmount: number;
  shippingFee: number;
  storefrontAmountPaid: number;
  currency: string | null;
  isPaid: boolean;
  isDynamicsPosted: boolean;
  walletCreditAmount: number;
  walletDebitAmount: number;
  walletFeeAmount: number;
  storefrontEarningAmount: number;
  oemCommissionPercent: number;
  oemCommissionAmount: number;
  storefrontWalletBalanceAfter: number | null;
  superAdminWalletCreditAmount: number;
  superAdminWalletBalance: number | null;
  earning: StorefrontEarningDto | null;
}

// —— Store owner management (StorefrontOwner) ——

/** GET Storefront/GetStorefrontOwners | GetAcceptedStorefrontOwners | GetStorefrontOwner/{ownerId} */
export interface StorefrontOwnerDetailDto {
  id: string | null;
  email: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phoneNumber: string | null;
  isCacVerified: boolean;
  userStatus: string | null;
  userType: string | null;
  isSuspended: boolean;
  isDeleted: boolean;
  isActive: boolean;
  isInvited: boolean;
  isInvitationAccepted: boolean;
  invitedAt: string | null;
  acceptedAt: string | null;
  primaryStorefrontBrandId: string | null;
  defaultStorefrontPriceMargin: number | null;
}

/** GET Storefront/GetOwnerCandidates */
export interface StorefrontOwnerCandidateDto {
  id: string | null;
  email: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phoneNumber: string | null;
  isCacVerified: boolean;
  isAlreadyInvited: boolean;
  isInvitationAccepted: boolean;
}

/** POST Storefront/InviteStorefrontOwner | ResendStorefrontOwnerInvitation */
export interface StorefrontOwnerInvitationResponse {
  owner: StorefrontOwnerDetailDto;
  expiresAt: string;
  sentAt: string;
}

/** POST Storefront/ValidateStorefrontOwnerInvitation */
export interface StorefrontOwnerInvitationValidationResponse {
  ownerId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  companyName: string | null;
  phoneNumber: string | null;
  isCacVerified: boolean;
  expiresAt: string;
  isAccepted: boolean;
}

export interface StorefrontOwnerInvitationTokenRequest {
  token: string;
}

/** GET Storefront/GetStorefrontOwnerBrands/{ownerId} | GetStorefrontOwnerPrimaryBrand/{ownerId} */
export interface StorefrontOwnerBrandDto {
  storefrontBrandId: string;
  brandId: string | null;
  name: string | null;
  brandImageUrl: string | null;
  isSelected: boolean;
  isPrimary: boolean;
  storefrontPriceMargin: number | null;
  globalStorefrontPriceMargin: number;
  themeName: string | null;
  themeJson: string | null;
  ownerDefaultStorefrontPriceMargin: number | null;
}

export interface StorefrontOwnerBrandMarginEntry {
  ownerId: string;
  storefrontBrandId: string;
  storefrontPriceMargin: number | null;
}

export interface StorefrontOwnerBrandMarginBulkRequest {
  entries: StorefrontOwnerBrandMarginEntry[];
}

export interface StorefrontOwnerBrandSelectionRequest {
  storefrontBrandIds: string[];
  primaryStorefrontBrandId?: string | null;
}

/** PUT Storefront/ConfigureStorefrontOwner/{ownerId} */
export interface StorefrontOwnerConfigurationRequest {
  storefrontBrandIds?: string[] | null;
  primaryStorefrontBrandId?: string | null;
  defaultStorefrontPriceMargin?: number | null;
  brandMargins?: StorefrontOwnerBrandMarginEntry[] | null;
}

// —— Brand theme ——

/** GET Storefront/GetStorefrontBrandTheme/{storefrontBrandId} */
export interface StorefrontBrandThemeDto {
  storefrontBrandId: string;
  themeName: string | null;
  themeJson: string | null;
  isActive: boolean;
}

/** PUT Storefront/SetStorefrontBrandTheme/{storefrontBrandId} */
export interface StorefrontBrandThemeRequest {
  themeName: string;
  themeJson: string;
  isActive?: boolean;
}

// —— Per-owner dashboard ——

/** GET admin/storefront/dashboard/{ownerId} */
export interface StorefrontDashboardDto {
  ownerId: string | null;
  currency: string | null;
  totalOrders: number;
  paidOrders: number;
  grossSales: number;
  superAppOrderValue: number;
  currentWalletBalance: number;
  totalCommission: number;
  currentCommission: number;
  commissionPaid: number;
  pendingCommission: number;
  ordersWaitingForCommission: number;
  reservedForPayout: number;
  totalPayoutsPaid: number;
  recentActivity: StorefrontDashboardActivityDto[] | null;
}

export interface StorefrontDashboardActivityDto {
  type: string | null;
  reference: string | null;
  description: string | null;
  amount: number;
  status: string | null;
  date: string;
  orderId: string | null;
  payoutId: string | null;
}

// —— Per-owner quote (reuses StorefrontQuoteDto response) ——

/** POST Storefront/GetOwnerQuote/{ownerId} request line (ProductQuantity). */
export interface StorefrontProductQuantityRequest {
  productId: string;
  variantId?: string;
  locationId?: string | null;
  quantity: number;
}

// —— Settlement recovery ——

export type StorefrontSettlementRecoveryStatus =
  | "RefundPending"
  | "Refunded"
  | "Failed";

/** GET admin/storefront/settlement-recovery/orders/{orderId} | pending-refunds */
export interface StorefrontSettlementRecoveryDto {
  id: string;
  orderId: string;
  ownerId: string | null;
  externalOrderId: string | null;
  paymentReference: string | null;
  refundAmount: number;
  currency: string | null;
  status: StorefrontSettlementRecoveryStatus | null;
  reason: string | null;
  providerRefundReference: string | null;
  failureReason: string | null;
  attemptCount: number;
  requestedAt: string;
  reversedAt: string | null;
  refundedAt: string | null;
  lastAttemptAt: string | null;
}

export interface StorefrontSettlementCancellationRequest {
  reason?: string | null;
}

export interface StorefrontSettlementRefundCompletionRequest {
  providerRefundReference: string;
}

// —— Per-owner tickets (responses reuse TicketResponse from types.ts) ——

export interface StorefrontTicketRequest {
  description: string;
  category?: string;
  topic: string;
}

export interface StorefrontTicketCommentRequest {
  comment: string;
}

// Pagination helpers for new list endpoints
export type StorefrontPagedOwnerDetails = PaginationResponse<StorefrontOwnerDetailDto>;
export type StorefrontPagedOwnerCandidates = PaginationResponse<StorefrontOwnerCandidateDto>;
export type StorefrontPagedSettlementRecovery = PaginationResponse<StorefrontSettlementRecoveryDto>;

// —— Store owner coupon requests ——

export type StorefrontCouponRequestStatus = "Pending" | "Approved" | "Rejected";

export interface StorefrontCouponRequestProductInput {
  productId: string;
  requestedPriceInNaira?: number | null;
  requestedPriceInDollar?: number | null;
}

export interface StorefrontCouponRequestProductResponse {
  id: string;
  productId: string;
  requestedPriceInNaira: number | null;
  requestedPriceInDollar: number | null;
}

/** POST admin/storefront/owner-coupon-requests/owner/{ownerId} */
export interface CreateStorefrontCouponRequest {
  name: string;
  requestedCode?: string | null;
  reason: string;
  products: StorefrontCouponRequestProductInput[];
}

/** PUT admin/storefront/owner-coupon-requests/{requestId}/decision */
export interface StorefrontCouponRequestDecision {
  status: StorefrontCouponRequestStatus;
  adminNote?: string | null;
}

/** GET admin/storefront/owner-coupon-requests* */
export interface StorefrontCouponRequestResponse {
  id: string;
  storefrontOwnerId: string | null;
  storefrontOwnerEmail: string | null;
  storefrontOwnerName: string | null;
  name: string | null;
  requestedCode: string | null;
  reason: string | null;
  status: StorefrontCouponRequestStatus;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  dateCreated: string;
  dateModified: string | null;
  products: StorefrontCouponRequestProductResponse[] | null;
}

export type StorefrontPagedCouponRequests = PaginationResponse<StorefrontCouponRequestResponse>;
