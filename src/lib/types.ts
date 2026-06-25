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
  warehouse: LocationWithQuantityResponse[] | null;
  exchangeRate: number;
  isFeaturedProduct: boolean;
  isVisible: boolean;
  hasProductGroup: boolean;
}

export interface ProductReturnDto extends BaseProductReturnDto {
  productGroup: ProductGroupResponse | null;
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
}

// ---- CAC Registration ----
export interface CacPersonResponse {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  occupation: string;
}

export interface CacRegistrationResponse {
  id: string;
  firstPreferredBusinessName: string | null;
  secondPreferredBusinessName: string | null;
  businessDescription: string | null;
  transactionReference: string | null;
  dateCreated: string;
  directors: CacPersonResponse[];
  secretaries: CacPersonResponse[];
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

export interface EditProductGroupRequest {
  name: string;
  productIds: string[];
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

// ---- Deal ----
export type DealEnum = "PercentageDiscount" | "FixedDiscount" | "BuyOneGetOneFree";

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

// ---- Audit logs ----
export interface PaginatedApiResponse<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface AuditLogItem {
  id: string;
  action: string;
  adminId: string;
  roleName: string | null;
  adminName: string;
  adminEmail: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  updatedData: { changes?: Record<string, unknown> } | null;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface PromoAuditLogItem extends AuditLogItem {
  promoId: string;
}

export interface DealAuditLogItem extends AuditLogItem {
  dealId: string;
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
  referralId: string | null;
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
