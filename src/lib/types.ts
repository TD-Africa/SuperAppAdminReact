import type { Permission } from "./permissions";

// Mirror of TDSuperApp.DTOs.Response.Result<T>
export interface ApiResult<T> {
  data: T | null;
  message: string | null;
  status: boolean;
}

// Mirror of TDSuperApp.DTOs.Request.UserAuthenticationDto
export interface UserAuthenticationDto {
  userName: string;
  password: string;
}

// Role permission entries in the login response are objects like { name: "CanViewDashboard" }
// (the Blazor AuthenticationService.HasPermission checks x.Name == permission).
// The GetPermissions endpoint also returns `id` on each entry — optional here so the
// shape serves both contexts.
export interface PermissionEntry {
  id?: string;
  name: Permission;
}

// Mirror of TDSuperApp.DTOs.Response.PermissionResponse — identical to PermissionEntry
// with id required. Used on the Roles admin pages.
export interface PermissionResponse {
  id: string;
  name: Permission;
}

export interface RoleResponse {
  id: string;
  name: string;
  permissions: PermissionEntry[];
}

// Mirror of TDSuperApp.DTOs.Response.AdminUserReturnDto
export interface AdminUserReturnDto {
  id: string;
  email: string;
  phoneNumber: string;
  lastName: string;
  firstName: string;
  userName: string;
  role: RoleResponse;
  isActive: boolean;
  userType?: string;
}

// Mirror of TDSuperApp.DTOs.Response.AdminAccessReturnDto
export interface AdminAccessReturnDto {
  accessToken: string;
  userDTO: AdminUserReturnDto;
}

// Mirror of TDSuperApp.DTOs.Response.AdminDashboardResponse
export interface TopRankingProductResponse {
  id: string;
  productName: string | null;
  unitSold: number;
  totalRevenue: number;
}

export interface TopRankingOrderResponse {
  id: string;
  companyName: string | null;
  orderDate: string;
  totalAmountInNaira: number;
  totalAmountInDollars: number;
  paymentMethod: string;
  isPoaTransaction: boolean;
  status: string;
}

// ---- Shared ----
export interface PaginationResponse<T> {
  data: T[] | null;
  count: number;
  pageNumber: number;
}

// ---- Brand / Location / Product support DTOs ----
export interface BrandReturnDTO {
  id: string;
  brandImageUrl: string | null;
  name: string;
  dynamicsId: string | null;
  isActive: boolean;
  // Master switch for dollar purchasing across every product under the brand.
  // Optional because BrandReturnDTO does not carry it yet — verified against
  // both the prod and test swagger on 2026-09-10, where the only response DTO
  // exposing the flag is ExchangeRateSummaryDto. Read it from there (the
  // Exchange Rates page) until the catalog DTOs catch up; this field then
  // starts populating with no further change here.
  isDollarPurchasable?: boolean;
}

export interface LocationReturnDTO {
  id: string;
  name: string;
  address: string | null;
  dynamicsId: string | null;
  isActive: boolean;
}

export interface LocationWithQuantityResponse extends LocationReturnDTO {
  quantity: number;
}

export interface ProductImageUrlReturnDTO {
  id: string;
  url: string;
  position: number;
  mediaType: string | null;
  label: string | null;
  types: string[] | null;
}

export interface ProductGroupResponse {
  id: string;
  name: string;
  products: BaseProductReturnDto[];
}

// ---- Product ----
export interface BaseProductReturnDto {
  id: string;
  dateCreated: string;
  dateModified: string | null;
  brand: BrandReturnDTO;
  mass: number;
  // Cross-warehouse TOTAL — the sum of `warehouse[]`. The backend used to scope
  // every product read to the default warehouse (TD MW); since the
  // all-warehouses migration this is stock everywhere rather than one
  // warehouse's figure. Verified against the deployed API 2026-09-10: both
  // product/getProducts and Product/GetProduct/{id} now agree on this.
  quantity: number;
  productName: string;
  shortDescription: string | null;
  slug: string | null;
  category: string | null;
  productImageUrls: ProductImageUrlReturnDTO[];
  dynamicsId: string | null;
  priceInNaira: number;
  priceInDollar: number;
  specialPrice: number;
  isActive: boolean;
  nairaCurrency: string | null;
  dollarCurrency: string | null;
  showNairaCurrency: boolean;
  // Backend serializes Warehouses as the singular "warehouse" via
  // [JsonPropertyName("warehouse")] on the C# DTO — the property is plural but
  // the wire name is singular. Match the wire name here.
  //
  // One entry per warehouse holding stock, each carrying its own `quantity`
  // (summed over that warehouse's variant rows). This was always length 1
  // before the all-warehouses migration, so `warehouse[0]` used to be "the"
  // warehouse — it is now an arbitrary one. Never index into this to label
  // stock; sum it or render the whole breakdown.
  //
  // Empty on rows returned by `isOutOfStock=true`, which bypasses the variant
  // includes entirely.
  //
  // Only ~5 of the 33 locations are active (TD MW, TD ABUJA, TD PORTHARCOURT,
  // Raw Material, Synix-Shopify), so expect a handful of entries, not dozens.
  warehouse: LocationWithQuantityResponse[] | null;
  exchangeRate: number;
  isFeaturedProduct: boolean;
  isVisible: boolean;
  hasProductGroup: boolean;
  // Whether this product opts in to dollar purchasing. The brand is the master
  // switch, so the effective answer is this AND `brand.isDollarPurchasable` —
  // never read this alone to decide whether dollars are accepted.
  //
  // Present on BaseProductReturnDto in both prod and test swagger as of
  // 2026-09-28. Still optional so an older deploy that omits it reads as
  // "unknown", not "off".
  isDollarPurchasable?: boolean;
  // The admin's own on/off switch, kept apart from `isActive`. `isActive` is
  // Dynamics' value and the catalog sync overwrites it every 20 min;
  // `adminDisabled` is never touched by the sync, so it is the only way an
  // admin "off" survives. Storefront and checkout treat a product as live only
  // when `isActive && !adminDisabled`.
  //
  // Optional because only the test API returns it (2026-09-28). Prod swagger
  // has neither this field nor `minOrderQuantity` yet.
  adminDisabled?: boolean;
  // Minimum order quantity. 0 means no minimum. Test API only, as above.
  minOrderQuantity?: number;
  // Recommended retail price from the Middleware, in naira. Null when none is
  // set. The product-level figure is copied from one source variant.
  retailPriceInNaira?: number | null;
}

// PATCH Product/EditProduct/{id}. Every field is nullable, so leaving one out
// leaves it unchanged. The response is a plain BooleanResult, not the updated
// product. `AdminDisabled` and `MinOrderQuantity` are only accepted by the test
// API for now.
export interface EditProductRequest {
  IsActive?: boolean;
  AdminDisabled?: boolean;
  IsFeaturedProduct?: boolean;
  IsDollarPurchasable?: boolean;
  MinOrderQuantity?: number;
}

export interface ProductVariantReturnDto {
  id: string;
  isDefault: boolean;
  isActive: boolean;
  colorId: string | null;
  configId: string | null;
  sizeId: string | null;
  styleId: string | null;
  versionId: string | null;
  priceInNaira: number;
  priceInDollar: number;
  specialPrice: number;
  // This variant's RRP in naira; null when none is set.
  retailPriceInNaira?: number | null;
  // This variant's total across all warehouses (backend sums `warehouses`).
  quantity: number;
  // Note the wire name is plural here, unlike the product-level `warehouse`.
  // One entry per warehouse stocking this variant.
  warehouses: LocationWithQuantityResponse[] | null;
}

export interface ProductReturnDto extends BaseProductReturnDto {
  productGroup: ProductGroupResponse | null;
  hasVariants: boolean;
  variants: ProductVariantReturnDto[] | null;
}

// ---- Customer write DTOs ----
// Mirror of TDSuperApp.DTOs.Request.CreateUserDto. Note the JSON wire name for
// UserName is `username` (lowercase), not `userName`.
export interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  addressLine: string;
  street: string;
  city: string;
  state: string;
  dynamicsId: string;
  isCreditTransactionEnabled: boolean;
  locationIds: string[];
}

// Mirror of TDSuperApp.DTOs.Request.EditUserRequest.
export interface EditCustomerRequest {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  userName?: string | null;
  creditDays?: string | null;
  creditLimit?: number | null;
  houseNumber?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  phoneNumber?: string | null;
  companyName?: string | null;
  userStatus?: UserStatus | null;
  locationIds?: string[] | null;
  enableCreditTransactions?: boolean | null;
  isActive?: boolean | null;
  roleId?: string | null;
}

// Mirror of TDSuperApp.DTOs.Dynamics.UserCreationDTO.
// WARNING: most fields have [JsonPropertyName] attributes with PascalCase wire
// names — we hand-build the request body in Kyc flow, so only store TS-side.
export interface DynamicsAccountRequest {
  dataAreaId: string;
  customerGroupId: string;
  partyType: string;
  organizationName: string;
  salesCurrencyCode: string;
  invoiceAddressState: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  invoiceAddressCity: string;
  invoiceAddressDescription: string;
  invoiceAddressStreet: string;
  invoiceAddressCountry: string;
}

// ---- Dynamics linking ----
// Mirror of TDSuperApp.DTOs.Response.CustomerSearchResponse — a candidate
// Dynamics customer record returned by GetDynamicsCandidates.
export interface CustomerSearchResponse {
  customerAccount: string | null;
  name: string | null;
}

// Mirror of TDSuperApp.DTOs.Request.LinkDynamicsRequest.
export interface LinkDynamicsRequest {
  dynamicsId: string;
}

// Mirror of TDSuperApp.DTOs.Response.DynamicsSyncResponse — returned by both
// the LinkDynamics and CreateInDynamics endpoints.
export interface DynamicsSyncResponse {
  userId: string | null;
  dynamicsId: string | null;
  message: string | null;
  method: string | null;
  syncDate: string;
}

// ---- Customer / User ----
export type UserStatus =
  | "Pending"
  | "Active"
  | "Rejected"
  | "Suspended"
  | "Incomplete";
export const UserStatusValues: UserStatus[] = [
  "Pending",
  "Active",
  "Rejected",
  "Suspended",
  "Incomplete",
];

export type UserType = "Reseller" | "SubReseller" | "SuperAdmin" | "Admin";

// The /User endpoints return this shape (extends UserReturnDto with customer-specific stats).
export interface CustomerResponse extends BaseUserResponse {
  dynamicsId: string | null;
  totalOrders: number;
  pendingOrders: number;
  creditLimit: number;
  creditDays: string | null;
  customerBalance: number;
  walletBalance: number;
  cac_FileName: string | null;
  utility_FileName: string | null;
  creditBalance: number;
  isSuspended: boolean;
  isExistingPartner: boolean;
  userStatus: UserStatus;
  userType: UserType;
  numberOfOrders: number;
  isCreditTransactionEnabled: boolean;
  userWarehouses: LocationReturnDTO[] | null;
  lastOrderDate: string | null;
  isCacVerified: boolean | null;
  cacVerifiedAt: string | null;
}

// Mirror of TDSuperApp.DTOs.Response.CreditSyncResultDto — returned by the
// per-user credit re-sync. Only the credit balance carries a "previous" value,
// so that is the single before/after the UI can report.
export interface CreditSyncResult {
  userId: string;
  dynamicsId: string;
  previousCreditBalance: number;
  newCreditBalance: number;
  newCustomerBalance: number;
  newCreditLimit: number;
  newCreditDays: string | null;
}

// ---- CAC Registration ----
// Mirrors CacRegistrationResponse / CacPersonResponse / CacRegistrantResponse in
// the admin API. Optional members are the ones the API declares nullable.
export interface CacPersonResponse {
  id?: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  homeAddress?: string | null;
  dateOfBirth: string;
  occupation: string;
  idNumber?: string | null;
  // Uploaded supporting documents. Only the names are returned; the files
  // themselves come down through the CAC documents zip export.
  passportPhotoFileName?: string | null;
  signaturePhotoFileName?: string | null;
  idFileName?: string | null;
}

/**
 * The person who submitted the registration — a row in ProspectiveCacCustomers,
 * not an ApplicationUser. `hasSuperAppAccount` reports whether
 * CacRegistration/CreateUserAfterCACIsRegistered has already run for them.
 *
 * `id` is the value that endpoint wants as `prospectiveUserId`; it equals the
 * registration's own `applicationUserId`. Null on registrations submitted by an
 * already-registered partner, which have no prospective-customer row at all.
 */
export interface CacRegistrantResponse {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  isRegistered: boolean;
  hasSuperAppAccount: boolean;
  superAppUserId: string | null;
  dateCreated: string | null;
}

export interface CacRegistrationResponse {
  id: string;
  /** The submitting ProspectiveCacCustomer's id — see `registrant`. */
  applicationUserId: string;
  firstPreferredBusinessName: string | null;
  secondPreferredBusinessName: string | null;
  businessDescription: string | null;
  objectiveOfBusiness: string | null;
  shareCapital: string | null;
  shareholdingRatio: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyHeadOfficeAddress: string | null;
  dateCreated: string;
  /** "Company" (LLC flow) or "BusinessName". See lib/cacRegistrationType. */
  registrationType: string | null;
  registrant: CacRegistrantResponse | null;
  directors: CacPersonResponse[] | null;
  secretaries: CacPersonResponse[] | null;
  proprietor?: CacPersonResponse | null;
}

// ---- Ratings ----
export interface RatingResponseWithUser {
  id: string;
  score: number;
  comment: string | null;
  dateCreated: string;
  dateModified: string | null;
  companyName: string | null;
}

// ---- Email change / Request appeals / generic "Action" enum ----
export type ActionStatus = "PENDING" | "APPROVED" | "DECLINED";
export const ActionStatusValues: ActionStatus[] = [
  "PENDING",
  "APPROVED",
  "DECLINED",
];

export interface EmailChangeResponseWithUser {
  id: string;
  userId: string;
  newEmail: string;
  oldEmail: string | null;
  companyName: string | null;
  isActedOn: boolean;
  isAccepted: boolean;
  dateCreated: string;
  dateModified: string | null;
}

export interface RequestAppealResponseWithUser {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  description: string | null;
  companyName: string | null;
  isActedOn: boolean;
  isAccepted: boolean;
  dateCreated: string;
  dateModified: string | null;
}

// ---- Ticket ----
export type TicketStatus = "Opened" | "Pending" | "Closed";
export const TicketStatusValues: TicketStatus[] = ["Opened", "Pending", "Closed"];

export type TicketCategory =
  | "Customer"
  | "Order"
  | "Authentication"
  | "Cart"
  | "Product";
export const TicketCategoryValues: TicketCategory[] = [
  "Customer",
  "Order",
  "Authentication",
  "Cart",
  "Product",
];

export interface BaseUserResponse {
  id: string;
  companyName: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  addressLine: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  dateCreated: string;
}

export interface BaseTicketCommentResponse {
  id: string;
  dateCreated: string;
  dateModified: string | null;
  comment: string;
  isAdmin: boolean;
  isRead: boolean;
}

export interface TicketResponse {
  id: string;
  description: string;
  category: TicketCategory;
  dateOpened: string;
  dateClosed: string | null;
  isEscalated: boolean;
  topic: string;
  status: TicketStatus;
  user: BaseUserResponse | null;
  hasUnreadComment: boolean;
  comments: BaseTicketCommentResponse[];
}

// ---- Admin user / Role write DTOs ----
// Mirror of TDSuperApp.DTOs.Request.AdminUserDto.
export interface AdminUserDto {
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
  phoneNumber: string;
  roleId: string;
}

// Mirror of TDSuperApp.DTOs.Request.EditAdminUserDto.
export interface EditAdminUserDto {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  userName?: string | null;
  phoneNumber?: string | null;
  roleId?: string | null;
  isActive?: boolean | null;
}

// Mirror of TDSuperApp.DTOs.Request.AdminRoleDTO (create role).
export interface AdminRoleDto {
  name: string;
  permissionIds: string[];
}

// Mirror of TDSuperApp.DTOs.Request.EditRoleRequest.
export interface EditRoleRequest {
  name?: string | null;
  permissionIds?: string[] | null;
}

// ---- MiniProduct / ProductGroup write DTOs ----
export interface MiniProductResponse {
  id: string;
  productName: string;
  dynamicsId?: string | null;
}

export interface ProductGroupRequest {
  name: string;
  productIds: string[];
}

// Mirror of ProductGroupRequest. `name` + `productIds` are required;
// `maxRemovableFromCart` caps how many units of this group a user may remove
// from their cart and is optional. `parentProductId` optionally designates a
// product as the group's parent.
export interface CreateProductGroupRequest {
  name: string;
  productIds: string[];
  maxRemovableFromCart?: number;
  parentProductId?: string | null;
}

// All fields nullable on the wire; omit a field to leave it unchanged.
export interface EditProductGroupRequest {
  name?: string;
  productIds?: string[];
  maxRemovableFromCart?: number;
  parentProductId?: string | null;
}

// ---- Promo ----
export interface PromoResponse {
  id: string;
  name: string;
  percentOff: number;
  startDate: string;
  validUntil: string | null;
  location: LocationReturnDTO;
  products: BaseProductReturnDto[];
  imageUrl: string | null;
  isActive: boolean;
}

export interface PromoRequest {
  name: string;
  percentOff: number;
  startDate: string;
  endDate: string;
  locationId: string;
  productIds: string[];
  isActive?: boolean;
}

export interface EditPromoRequest {
  name?: string | null;
  percentOff?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  locationId?: string | null;
  productIds?: string[] | null;
  isActive?: boolean | null;
}

// ---- Coupon ----
// Mirror of TDSuperApp.DTOs.Response.CouponCustomerResponse.
export interface CouponCustomerResponse {
  userId: string | null;
  companyName: string | null;
  email: string | null;
  dynamicsId: string | null;
}

// Mirror of TDSuperApp.DTOs.Response.CouponProductResponse.
export interface CouponProductResponse {
  productId: string;
  productName: string | null;
  dynamicsId: string | null;
  overridePriceInNaira: number | null;
  overridePriceInDollar: number | null;
}

// Mirror of TDSuperApp.DTOs.Request.CouponProductInput.
export interface CouponProductInput {
  productId: string;
  overridePriceInNaira?: number | null;
  overridePriceInDollar?: number | null;
}

// Mirror of TDSuperApp.DTOs.Response.CouponResponse.
export interface CouponResponse {
  id: string;
  code: string | null;
  name: string | null;
  isActive: boolean;
  startDate: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  oncePerCustomer: boolean;
  customers: CouponCustomerResponse[] | null;
  products: CouponProductResponse[] | null;
}

// Mirror of TDSuperApp.DTOs.Request.CreateCouponRequest.
export interface CreateCouponRequest {
  code: string;
  name: string;
  isActive: boolean;
  startDate?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  oncePerCustomer: boolean;
  customerUserIds?: string[] | null;
  products?: CouponProductInput[] | null;
}

// Mirror of TDSuperApp.DTOs.Request.UpdateCouponRequest. Note: `code` is not
// editable after creation.
export interface UpdateCouponRequest {
  name?: string | null;
  isActive?: boolean | null;
  startDate?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  oncePerCustomer?: boolean | null;
  customerUserIds?: string[] | null;
  products?: CouponProductInput[] | null;
}

// ---- Coupon product bulk upload ----
// `POST /api/Coupon/products/upload` (multipart, field `file`) resolves and validates
// spreadsheet rows but persists nothing — there is no coupon id in the route. The
// resolved rows are merged into the coupon form and written by the normal create/update
// call, so a bad sheet can never half-write a coupon.
export interface CouponProductUploadRow {
  rowNumber?: number | null;
  productId: string;
  productName?: string | null;
  dynamicsId?: string | null;
  // The currency the product actually sells in, when the server reports it: an override
  // priced only in the other currency is accepted but never applies at checkout.
  showNairaCurrency?: boolean | null;
  overridePriceInNaira?: number | null;
  overridePriceInDollar?: number | null;
}

// A row the server rejected (`errors`) or accepted with a caveat (`warnings`).
export interface CouponProductUploadIssue {
  rowNumber?: number | null;
  identifier?: string | null;
  message?: string | null;
}

export interface CouponProductUploadResponse {
  products?: CouponProductUploadRow[] | null;
  errors?: CouponProductUploadIssue[] | null;
  warnings?: CouponProductUploadIssue[] | null;
  totalRows?: number | null;
  resolvedRows?: number | null;
  failedRows?: number | null;
}

// ---- Deal ----
// `BuyOneGetOneFree` gives free units of the SAME product. `BuyXGetYFree` is
// cross-product: every `buyQuantity` paid units of the deal's products (any mix)
// earns the deal's `rewards` free. Repeatable, uncapped.
export type DealEnum =
  | "PercentageDiscount"
  | "FixedDiscount"
  | "BuyOneGetOneFree"
  | "BuyXGetYFree";

// BuyXGetYFree only: one free item per completed set. `variantId` omitted means
// the product's default variant. A reward can't also be a qualifying product.
export interface DealRewardItemRequest {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface DealRewardItemResponse {
  productId: string;
  variantId: string;
  productName: string | null;
  imageUrl: string | null;
  quantity: number;
}

// A per-set minimum of one of the deal's own products (DealQualifyingQuantityRequest;
// minQuantity >= 1). Only products in `productIds` can carry one; the backend
// drops minimums on products removed from the deal.
export interface DealQualifyingQuantity {
  productId: string;
  minQuantity: number;
}

// As returned on Deal/Get and Deal/GetAll (verified against the test API).
export interface DealQualifyingQuantityResponse extends DealQualifyingQuantity {
  productName: string | null;
}

export interface DynamicsLocationResponse {
  locationId: string;
  locationName: string;
}

export interface DealProductResponse {
  id: string;
  name: string | null;
  price: number;
}

export interface DealResponse {
  id: string;
  name: string;
  dealType: DealEnum;
  percentOff: number | null;
  fixedAmount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  startDate: string | null;
  validUntil: string | null;
  isActive: boolean;
  locationId: string;
  location: DynamicsLocationResponse | null;
  products: DealProductResponse[];
  // BuyXGetYFree only; empty for the other types. Optional so an older API
  // build that omits it reads as "none".
  rewardItems?: DealRewardItemResponse[];
  // Optional so an older API build that omits it reads as "no minimums".
  qualifyingQuantities?: DealQualifyingQuantityResponse[];
}

export interface DealRequest {
  name: string;
  dealType: DealEnum;
  percentOff?: number | null;
  fixedAmount?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  startDate?: string | null;
  validUntil?: string | null;
  locationId: string;
  isActive?: boolean | null;
  productIds: string[];
  rewards?: DealRewardItemRequest[] | null;
  qualifyingQuantities?: DealQualifyingQuantity[] | null;
}

export interface EditDealRequest {
  name?: string | null;
  dealType?: DealEnum | null;
  percentOff?: number | null;
  fixedAmount?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  startDate?: string | null;
  validUntil?: string | null;
  locationId?: string | null;
  isActive?: boolean | null;
  productIds?: string[] | null;
  // Replaces the free items when sent; null/omitted leaves them unchanged.
  rewards?: DealRewardItemRequest[] | null;
  // Replaces the minimums when sent; [] clears them; null/omitted keeps them.
  qualifyingQuantities?: DealQualifyingQuantity[] | null;
}

// ---- Credit reservations ----
// What SuperApp holds against each customer's D365 available credit
// (ADMIN.API CreditController). All amounts in naira.

// GET Credit/ReservationReport — one row per customer with uninvoiced credit
// orders. Database only; makes no D365 calls.
export interface CreditReservationReportRow {
  dynamicsId: string;
  companyName: string | null;
  /** TDNG sales orders not yet recorded as invoiced. Checkout asks D365 about these. */
  awaitingInvoiceOrders: number;
  awaitingInvoiceAmount: number;
  /** Unposted orders still in flight (awaiting acceptance or recent). Reserved. */
  inFlightOrders: number;
  inFlightAmount: number;
  /** Unposted post-cutover orders past the in-flight window. Not reserved; a Lead must post or cancel. */
  needsReviewOrders: number;
  needsReviewAmount: number;
  /** Pre-cutover or legacy-ERP orders. Never reserved. */
  legacyOrders: number;
  legacyAmount: number;
}

export type CreditReservationKind = "AwaitingInvoice" | "InFlight" | "NeedsReview";

export interface CreditReservationResponse {
  orderId: string;
  orderReference: string | null;
  userId: string | null;
  dateCreated: string;
  orderStatus: string | null;
  isDynamicsPosted: boolean;
  kind: CreditReservationKind | string;
  salesIds: string[];
  /** Naira value that counts against credit (0 for NeedsReview). */
  amount: number;
}

// GET Credit/Position/{userId} — one partner's live position. Asks D365 which
// TDNG sales orders are invoiced (lookup only; nothing is posted).
export interface CreditPositionResponse {
  dynamicsId: string;
  /** Gross limit: d365Available + accountBalance. */
  creditLimit: number;
  /** Positive = the customer owes; negative = in credit. */
  accountBalance: number;
  /** D365's own available credit, already net of accountBalance. */
  d365Available: number;
  /** SuperApp credit orders D365 hasn't invoiced yet. */
  reserved: number;
  /** What a new credit order may use when enforcement is on: d365Available - reserved. */
  available: number;
  /** Whether checkout currently refuses credit orders above `available`. */
  isEnforced: boolean;
  /** False when the D365 invoice check failed: every uninvoiced TDNG order then counts. */
  invoiceStatusVerified: boolean;
  needsReviewAmount: number;
  needsReviewCount: number;
  reservations: CreditReservationResponse[];
}

// ---- Debt collection ----
// Mirror of TDSuperApp.DTOs.Response.AlmostDueOrderResponse
export interface AlmostDueOrderResponse {
  orderId: string;
  orderReference: string;
  userName: string | null;
  userEmail: string | null;
  companyName: string | null;
  amountDue: number;
  amountPaid: number;
  totalAmount: number;
  dueDate: string | null;
  daysUntilDue: number;
  isDue: boolean;
  reminderCount: number;
  orderStatus: string;
  paymentMethod: string;
  orderDate: string;
}

// Mirror of TDSuperApp.DTOs.Response.DebtCollectionSummaryResponse
export interface DebtCollectionSummaryResponse {
  orders: AlmostDueOrderResponse[];
  totalOrders: number;
  totalAmountDue: number;
  ordersDueThisWeek: number;
  ordersDueNextWeek: number;
  overdueOrders: number;
}

// Mirror of TDSuperApp.DTOs.Response.SettlementDiscrepancy — an order D365 reports
// as fully settled, but for an amount that disagrees with SuperApp's expected charge.
// The sweep never closes these.
export interface SettlementDiscrepancy {
  orderId: string;
  orderReference: string | null;
  companyName: string | null;
  dynamicsId: string | null;
  detail: string | null;
}

// Mirror of TDSuperApp.DTOs.Response.OrderSettlementSweepResult
export interface OrderSettlementSweepResult {
  dryRun: boolean;
  ordersExamined: number;
  salesOrdersQueried: number;
  batchesFailed: number;
  ordersClosed: number;
  ordersStillOutstanding: number;
  ordersUnmatched: number;
  ordersSkipped: number;
  discrepancies: SettlementDiscrepancy[] | null;
}

// ---- Abandoned cart ----
export interface CartProductDTO {
  productId: string;
  quantity: number;
  locationId: string;
  dateAdded: string;
}

export interface AbandonedCartUserDTO {
  userId: string;
  email: string;
  cartId: string;
  lastUpdated: string;
  cartProducts: CartProductDTO[];
}

// ---- Audit trail ----
// Mirror of TDSuperApp.DTOs.Response.AdminAuditLogResponse — the platform-wide
// audit trail (AuditLog/Query, AuditLog/GetById). One row per admin mutation on
// any entity; the snapshots and diff are free-form jsonb, so they arrive as
// opaque objects rather than a typed shape.
//
// Casing note: beforeData/afterData/changes are raw JsonElements the backend
// stores verbatim, serialized with no naming policy — their *inner* keys are
// PascalCase ("Name", "Before", "After") even though the envelope around them is
// camelCase. Read them through the helpers in @/lib/auditTrail, which accept both.
export interface AuditChange {
  Before?: unknown;
  After?: unknown;
  before?: unknown;
  after?: unknown;
}

export interface AdminAuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  adminId: string | null;
  adminName: string | null;
  adminEmail: string | null;
  roleName: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  changes: Record<string, AuditChange> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ---- Order support DTOs ----
export interface OrderStatusReturnDTO {
  id: string;
  status: string;
}

export interface PaymentMethodReturnDTO {
  id: string;
  method: string;
  description: string | null;
}

export interface DeliveryMethodReturnDTO {
  id: string;
  method: string;
}

export interface UserReturnDto {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}

export interface TransactionResponseDTO {
  id: string;
  dateCreated: string;
  dateModified: string | null;
  amountPaid: number;
}

export interface OrderProductReturnDto {
  product: BaseProductReturnDto;
  quantity: number;
  dateOrdered: string;
  voucherID: string | null;
  invoiceID: string | null;
  salesID: string | null;
  warehouse: LocationReturnDTO | null;
  amountInNaira: number;
  amountInDollar: number;
  invoiceCreationDate: string | null;
  amountPaid: number;
  isPaymentPosted: boolean;
  isFullyPosted: boolean;
  isSettled: boolean;
  isFullySettled: boolean;
}

// ---- Order ----
export interface OrderReturnDto {
  id: string;
  orderedProducts: OrderProductReturnDto[];
  orderStatus: OrderStatusReturnDTO;
  user: UserReturnDto | null;
  paymentMethod: PaymentMethodReturnDTO;
  deliveryMethod: DeliveryMethodReturnDTO;
  deliveryAddress: string | null;
  dropOffAddress: string | null;
  location: LocationReturnDTO;
  dynamicsId: string | null;
  dateCreated: string;
  isPDCCollected: boolean;
  isPoaTransaction: boolean;
  name: string | null;
  companyName: string | null;
  phoneNumber: string | null;
  isFullyPaid: boolean;
  estimatedDeliveryDate: string | null;
  carrierName: string | null;
  carrierPhone: string | null;
  dueDate: string | null;
  isInvoiced: boolean;
  amountPaid: number;
  amountDueInNaira: number;
  amountDueInDollar: number;
  amountSettledInNaira: number;
  amountSettledInDollar: number;
  transactions: TransactionResponseDTO[] | null;
  /** The referral ID sent to D365 as the sales taker. The API serializes it PascalCase. */
  SalesTaker: string | null;
  /** Both null when the partner placed the order themselves. */
  placedByStaffId: string | null;
  placedByStaffName: string | null;
}

export interface AdminDashboardResponse {
  totalAmountForAllTransactions: number;
  totalAmountForCashTransactions: number;
  totalAmountForCreditTransactions: number;
  totalAmountForPoaTransactions: number;
  totalNumberOfOrders: number;
  totalNumberOfCashTransactions: number;
  totalNumberOfCreditTransactions: number;
  totalNumberOfPoaTransactions: number;
  totalNumberOfPendingOrders: number;
  totalNumberOfInProgressOrders: number;
  totalNumberOfAbandonedCarts: number;
  totalNumberOfProducts: number;
  totalNumberOfTickets: number;
  totalNumberOfPendingTickets: number;
  totalNumberOfClosedTickets: number;
  totalNumberOfInActiveProducts: number;
  totalNumberOfOutOfStockProducts: number;
  totalNumberOfFailedOrders: number;
  totalNumberOfCompletedOrders: number;
  totalNumberOfCancelledOrders: number;
  totalNumberOfUnpaidOrders: number;
  totalNumberOfAvailableProducts: number;
  totalNumberOfCustomers: number;
  totalNumberOfOpenTickets: number;
  topFiveSellingProducts: TopRankingProductResponse[];
  lastFiveOrders: TopRankingOrderResponse[];
}

// ── Worker / sales personnel (TDSuperApp Worker controller) ───────────────────
// Mirror of WorkerSalesStats — per-employee converted-order sales stats.
export interface WorkerSalesStats {
  referralId: string | null;
  personnelNumber: string | null;
  fullName: string | null;
  isActive: boolean;
  orderCount: number;
  totalAmount: number;
  lastConvertedUtc: string | null;
}

// Mirror of WorkerSalesOverview — aggregate KPIs plus the per-worker breakdown.
export interface WorkerSalesOverview {
  generatedUtc: string;
  totalWorkers: number;
  activeWorkers: number;
  workersWithSales: number;
  totalConvertedOrders: number;
  totalConvertedAmount: number;
  unattributedOrders: number;
  unattributedAmount: number;
  workers: WorkerSalesStats[] | null;
}

// ── Customer wallet (Wallet/GetUserWalletTransactions) ───────────────────────
// Mirror of WalletTransactionResponseDTO. `type` and `status` are free-form
// strings on the wire (not enums), so treat them case-insensitively.
export interface WalletTransactionResponse {
  amount: number;
  type: string | null;
  reference: string | null;
  description: string | null;
  status: string | null;
  transactionDate: string;
  balanceAfter: number;
}

// ── Virtual account provisioning (POST /api/VirtualAccount/provision) ────────
// Mirror of VirtualAccountController.ProvisionVaRequest. An empty/omitted
// `userIds` makes the endpoint sweep EVERY user missing a virtual account, so
// always send an explicit list from the admin UI.
export interface ProvisionVaRequest {
  userIds: string[];
}

// Mirror of VirtualAccountController.ProvisionVaResultItem. The envelope's
// `status` is always true (the endpoint returns 200 even when every user
// failed) — the per-user outcome is `success`/`message` on these items.
export interface ProvisionVaResultItem {
  userId: string;
  email: string | null;
  success: boolean;
  message: string;
}

// ── Brand restrictions / partner authorization (Brand controller) ─────────────
// A brand with `requiresPartnerAuthorization` is "restricted": only partners
// explicitly granted access can see or buy it. Unrestricted brands are open to
// everyone, and `authorizedPartnerCount` is then informational only — the grants
// are retained so flipping the brand back on doesn't lose them.
// Mirror of BrandRestrictionSummaryDto.
export interface BrandRestrictionSummaryDto {
  brandId: string;
  name: string | null;
  brandImageUrl: string | null;
  dynamicsId: string | null;
  isActive: boolean;
  requiresPartnerAuthorization: boolean;
  authorizedPartnerCount: number;
  productCount: number;
}

// Mirror of BrandPartnerDto. Returned both for partners already authorized on a
// brand (GetBrandPartners — `authorizedOn`/`authorizedBy` populated) and for
// candidates that could be granted access (GetEligibleBrandPartners — those
// fields null).
export interface BrandPartnerDto {
  userId: string | null;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  dynamicsId: string | null;
  isActive: boolean;
  subUserCount: number;
  authorizedOn: string | null;
  authorizedBy: string | null;
  notes: string | null;
}

// Mirror of PartnerBrandAccessDto — the partner-side view of the same grants.
// `inheritedFromMainAccount` marks access a sub-user gets via its parent company
// rather than a grant of its own, so it can't be revoked on the sub-user.
export interface PartnerBrandAccessDto {
  brandId: string;
  brandName: string | null;
  brandImageUrl: string | null;
  authorizedOn: string;
  authorizedBy: string | null;
  notes: string | null;
  inheritedFromMainAccount: boolean;
}

// Mirror of BrandAuthorizationGrantRequest — body for both the grant and the
// revoke endpoints. `userIds` must hold at least one id; `notes` caps at 500.
export interface BrandAuthorizationGrantRequest {
  brandId: string;
  userIds: string[];
  notes?: string | null;
}

// Mirror of BrandAuthorizationChangeItem. `resolvedUserId` is the account the
// grant actually landed on — it differs from `userId` when a sub-user id is
// submitted and the backend rolls it up to the main account.
export interface BrandAuthorizationChangeItem {
  userId: string | null;
  resolvedUserId: string | null;
  companyName: string | null;
  succeeded: boolean;
  message: string | null;
}

// Mirror of BrandAuthorizationChangeResultDto. The envelope's `status` is true
// whenever the request was processed at all, so per-user outcomes must be read
// off `results` — a 200 can still carry failures.
export interface BrandAuthorizationChangeResultDto {
  results: BrandAuthorizationChangeItem[] | null;
  succeededCount: number;
  failedCount: number;
  /** How long the storefront may serve cached access before the change shows. */
  propagationDelaySeconds: number;
}

// ── Partner allocations (Brand controller) ───────────────────────────────────
// A per-product unit cap for one authorized partner on one brand. Allocations
// hang off the same authorization row as the brand grant, so a partner must be
// authorized on the brand before they can be capped, and sub-user ids roll up to
// their main account. An empty list means "authorized but uncapped" — not
// "blocked". Mirror of PartnerAllocationDto.
export interface PartnerAllocationDto {
  allocationId: string;
  productId: string;
  productName: string;
  productDynamicsId: string | null;
  brandId: string;
  brandName: string;
  /** Ceiling in units for the current window. */
  allocatedQuantity: number;
  /** Units ordered since the window opened, derived live from order lines. */
  consumedQuantity: number;
  /** Clamped at zero — read `isOverAllocated` for the overshoot case. */
  remainingQuantity: number;
  /** Consumption already exceeds the cap, normally after an admin lowered it. */
  isOverAllocated: boolean;
  /** False lifts the cap without discarding the configured number. */
  isActive: boolean;
  /**
   * Start of the current counting window; null counts from the beginning. Shared
   * across every product of this brand for this partner, so it belongs in the
   * header rather than on a row.
   */
  allocationResetAt: string | null;
  allocatedBy: string | null;
  notes: string | null;
  lastUpdated: string | null;
}

// Mirror of PartnerAllocationItem.
export interface PartnerAllocationItem {
  productId: string;
  /** Units. Zero blocks the product while leaving the rest of the brand open. */
  allocatedQuantity: number;
  isActive: boolean;
}

// Mirror of SetPartnerAllocationsRequest. This is a REPLACE, not a merge: any
// product left out of `allocations` has its cap removed and becomes uncapped, so
// the client must always send the full grid. `notes` caps at 500.
export interface SetPartnerAllocationsRequest {
  brandId: string;
  userId: string;
  allocations: PartnerAllocationItem[];
  notes?: string | null;
}

// Mirror of ResetPartnerAllocationRequest. Opens a fresh window so every product
// under this authorization returns to zero consumed; the caps are unchanged.
// `resetAt` defaults to now and is rejected if in the future.
export interface ResetPartnerAllocationRequest {
  brandId: string;
  userId: string;
  resetAt?: string | null;
}

// ── Platform settings (Component/Get|SavePlatformSettings) ────────────────────
// Mirror of PlatformSettingDto. Every field is nullable: null means "not
// configured", and the backend falls back to its own default.
export interface PlatformSettingDto {
  /** Share of an order that may be paid up front, 0–100. */
  splitTenderPercent: number | null;
}

// VAT switches (api/v1/vat). Product VAT drives every price: cart, checkout,
// D365 and invoices. Rates are percents (7.5 = 7.5%).
export type VatStatus = "On" | "Off" | "Partial";

export interface VatProductDto {
  productId: string;
  productName: string;
  brandName: string | null;
  isVATApplicable: boolean;
  vatRate: number;
}

export interface VatSummaryDto {
  products: number;
  productsWithVat: number;
  brandsWithVat: number;
  /** Only the first 500, ordered by name. */
  vatProducts: VatProductDto[];
}

/** One row per brand name; changes apply to every Brand row sharing it. */
export interface VatBrandDto {
  brandId: string;
  name: string;
  vatStatus: VatStatus;
  productCount: number;
  productsWithVat: number;
}

export interface VatChangeDto {
  enabled: boolean;
  rate: number | null;
  brandsUpdated: number;
  productsUpdated: number;
}

// ── Exchange rates (ExchangeRate controller) ──────────────────────────────────
// Rates are naira-per-dollar and versioned rather than overwritten: setting a new
// rate closes the current row (`effectiveTo`) and opens a new one. A brand row
// overrides the platform base for that brand only; with no override the brand
// inherits the base.

// Mirror of ExchangeRateResponse — one row in the rate ledger. `brandId` is null
// on base-rate rows; `effectiveTo` is null on the row currently in force.
export interface ExchangeRateResponse {
  id: string;
  brandId: string | null;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  reason: string | null;
}

// Mirror of ExchangeRateSummaryDto — the rate in force for one brand right now.
// `isOverride` distinguishes a brand-specific rate from an inherited base rate,
// which is what decides whether the override can be removed.
export interface ExchangeRateSummaryDto {
  brandId: string;
  brandName: string | null;
  isDollarPurchasable: boolean;
  effectiveRate: number;
  isOverride: boolean;
  effectiveFrom: string;
}

// Mirror of SetBrandDollarPurchasableRequest — the body for
// PATCH Brand/SetBrandDollarPurchasable/{brandId}/dollar-purchasable.
//
// This is the master switch: false makes every product under the brand
// non-dollar-purchasable regardless of its own flag, and true only enables the
// brand — each product still opts in individually via its own
// `isDollarPurchasable`. Requires the CanEditBrands permission.
export interface SetBrandDollarPurchasableRequest {
  isDollarPurchasable: boolean;
}

// Mirror of SetExchangeRateRequest. Serves both SetBaseRate and SetBrandRate —
// the brand is a path segment, not a body field.
export interface SetExchangeRateRequest {
  rate: number;
  reason?: string | null;
}

// ---- Staff portal access (ADMIN.API StaffController) ----
// Mirrors TDSuperApp.Data.Models.StaffStatus / StaffRole (serialized as strings).
export const StaffStatusValues = ["Pending", "Active", "Rejected", "Deactivated"] as const;
export type StaffStatus = (typeof StaffStatusValues)[number];

export const StaffRoleValues = ["Staff", "Lead"] as const;
export type StaffRole = (typeof StaffRoleValues)[number];

export interface StaffAdminResponse {
  id: string;
  entraObjectId: string;
  email: string | null;
  displayName: string | null;
  status: StaffStatus;
  role: StaffRole;
  statusChangedAt: string | null;
  /** Email of the admin who last approved/rejected/deactivated/reactivated. */
  statusChangedBy: string | null;
  lastLoginAt: string | null;
  /** For a Pending row this is when access was requested (first sign-in). */
  dateCreated: string;
  /**
   * The D365 worker this staff member is linked to; all three are null when
   * unlinked. Unlinked staff can still place orders, but D365 won't record
   * them as the sales taker. Approve/Reactivate auto-link on a unique email match.
   */
  referralId: string | null;
  salesTakerName: string | null;
  salesTakerPersonnelNumber: string | null;
}

// GET Staff/Workers?search= — up to 25 active D365 workers, for the link dialog.
export interface StaffWorkerResponse {
  referralId: string;
  personnelNumber: string | null;
  fullName: string | null;
  /** Usually null: most D365 workers have no email on file. */
  email: string | null;
  /** Set when another staff account already holds this worker. */
  linkedStaffEmail: string | null;
}

// GET Staff/GetAssignments/{id}; every assign/unassign endpoint returns the
// refreshed set in this shape too.
export interface StaffAssignmentsResponse {
  staffId: string;
  partners: StaffPartnerAssignmentResponse[];
  brands: StaffBrandAssignmentResponse[];
}

export interface StaffPartnerAssignmentResponse {
  /** Partner main-account user ID. Sub-users are covered through it. */
  userId: string;
  companyName: string | null;
  email: string | null;
  dynamicsId: string | null;
  assignedBy: string | null;
  assignedAt: string;
}

export interface StaffBrandAssignmentResponse {
  brandId: string;
  name: string | null;
  assignedBy: string | null;
  assignedAt: string;
}
