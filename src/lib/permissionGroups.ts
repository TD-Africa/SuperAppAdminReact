import type { Permission } from "./permissions";

// Human-friendly grouping for the 57 PermissionEnum values.
// Used on the Roles edit form to turn a flat list into a matrix.
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
    key: "orders",
    label: "Orders & carts",
    permissions: [
      "CanPlaceOrder",
      "CanViewOrders",
      "CanEditOrders",
      "CanViewCarts",
      "CanAddToCart",
      "CanEditCart",
      "CanClearCart",
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
    key: "settings",
    label: "Settings",
    permissions: ["CanChangeSettings"],
  },
];

// Human-readable label for each permission (strips the "Can" prefix and adds spaces).
export function humanPermissionName(permission: string): string {
  return permission
    .replace(/^Can/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}
