import type { Permission } from "./permissions";

// Human-friendly grouping for the 69 PermissionEnum values.
// Used on the Roles edit form to turn a flat list into a matrix.
// NOTE: PermissionMatrix only renders permissions that appear in a group here, so any
// permission the backend adds must be slotted in or it is invisible in the role editor.
export interface PermissionGroupDef {
  key: string;
  label: string;
  permissions: Permission[];
}

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    permissions: ["CanViewDashboard"],
  },
  { 
    key: "analytics", 
    label: "Analytics",
    permissions: [
      "CanViewAnalytics",
      "CanExportAnalytics"
    ]
  },
  {
    key: "products",
    label: "Products",
    permissions: [
      "CanViewProducts",
      "CanEditProducts",
      "CanViewFeaturedProducts",
      "CanEditFeaturedProducts",
    ],
  },
  {
    key: "product-groups",
    label: "Product groups",
    permissions: [
      "CanViewProductGroup",
      "CanCreateProductGroup",
      "CanEditProductGroup",
      "CanDeleteProductGroup",
    ],
  },
  {
    key: "brands",
    label: "Brands",
    permissions: ["CanViewBrands", "CanEditBrands"],
  },
  {
    key: "warehouses",
    label: "Warehouses",
    permissions: ["CanViewWarehouses", "CanEditWarehouses"],
  },
  {
    key: "promos",
    label: "Promos",
    permissions: [
      "CanViewPromos",
      "CanCreatePromos",
      "CanEditPromos",
      "CanDeletePromos",
    ],
  },
  {
    key: "coupons",
    label: "Coupons",
    permissions: ["CanManageCoupons"],
  },
  {
    key: "deals",
    label: "Deals",
    permissions: ["CanManageDeals"],
  },
  {
    key: "orders",
    label: "Orders & carts",
    permissions: [
      "CanPlaceOrder",
      "CanViewOrders",
      "CanEditOrders",
      "CanApproveOrder",
      "CanDecideApproval",
      "CanViewCarts",
      "CanAddToCart",
      "CanEditCart",
      "CanClearCart",
    ],
  },
  {
    key: "fulfillment",
    label: "Fulfillment & logistics",
    permissions: [
      "CanViewFulfillment",
      "CanAssignFulfillment",
      "CanUpdateFulfillmentStatus",
      "CanUpdateShippingInfo",
      "CanManageLogisticsPartners",
      "CanUpdateOrderLogisticsStatus",
    ],
  },
  {
    key: "payments",
    label: "Payments",
    permissions: [
      "CanViewPaymentMethods",
      "CanEditPaymentMethods",
      "CanViewTransactions",
    ],
  },
  {
    key: "debt-collection",
    label: "Debt collection",
    permissions: ["CanViewDebtCollection"],
  },
  {
    key: "delivery",
    label: "Delivery",
    permissions: ["CanViewDeliveryMethod", "CanEditDeliveryMethod"],
  },
  {
    key: "customers",
    label: "Customers",
    permissions: [
      "CanViewUser",
      "CanCreateUser",
      "CanEditUser",
      "CanDeleteUser",
    ],
  },
  {
    key: "admin-users",
    label: "Admin users",
    permissions: [
      "CanViewSubUser",
      "CanCreateSubUser",
      "CanEditSubUser",
      "CanDeleteSubUser",
    ],
  },
  {
    key: "roles",
    label: "Roles & permissions",
    permissions: [
      "CanViewRoles",
      "CanCreateRoles",
      "CanEditRoles",
      "CanAssignPermissions",
    ],
  },
  {
    key: "tickets",
    label: "Tickets",
    permissions: [
      "CanViewTicket",
      "CanCreateTicket",
      "CanEditTicket",
      "CanDeleteTicket",
      "CanEscalateTicket",
    ],
  },
  {
    key: "email-requests",
    label: "Email change requests",
    permissions: [
      "CanSubmitEmailChangeRequest",
      "CanViewEmailChangeRequests",
      "CanEditEmailChangeRequests",
      "CanDeleteEmailChangeRequests",
    ],
  },
  {
    key: "email-templates",
    label: "Email templates",
    permissions: ["CanViewEmailTemplates", "CanEditEmailTemplates"],
  },
  {
    key: "ratings",
    label: "Ratings",
    permissions: ["CanViewRatings"],
  },
  {
    key: "appeals",
    label: "Request appeals",
    permissions: ["CanViewRequestAppeals", "CanEditRequestAppeals"],
  },
  {
    key: "audit",
    label: "Audit trail",
    permissions: ["CanViewAuditTrail"],
  },
  {
    key: "settings",
    label: "Settings",
    permissions: ["CanChangeSettings", "ManageExchangeRate"],
  },
];

// Human-readable label for each permission (strips the "Can" prefix and adds spaces).
export function humanPermissionName(permission: string): string {
  return permission
    .replace(/^Can/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}
