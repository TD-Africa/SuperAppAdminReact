import type { AdminAuditLogItem, AuditChange, RoleResponse } from "@/lib/types";

/**
 * Mirror of TDSuperApp.Data.Models.AuditEntityType. These are the literal strings
 * the backend writes into AdminAuditLog.EntityType, and the Query filter matches
 * them with `==`, so they must stay exact.
 */
export const AuditEntityType = {
  Promo: "Promo",
  Deal: "Deal",
  Coupon: "Coupon",
  ExchangeRate: "ExchangeRate",
  Brand: "Brand",
  BrandRestriction: "BrandRestriction",
  BrandAuthorization: "BrandAuthorization",
  PartnerAllocation: "PartnerAllocation",
  Product: "Product",
  PlatformSetting: "PlatformSetting",
  DebtCollection: "DebtCollection",
  ApprovalRequest: "ApprovalRequest",
} as const;

export type AuditEntityType =
  (typeof AuditEntityType)[keyof typeof AuditEntityType];

/** Mirror of TDSuperApp.Data.Models.AuditAction. */
export const AuditAction = {
  Created: "Created",
  Updated: "Updated",
  Deleted: "Deleted",
  Granted: "Granted",
  Revoked: "Revoked",
  Reset: "Reset",
  Forced: "Forced",
  Submitted: "Submitted",
  Approved: "Approved",
  Rejected: "Rejected",
  Executed: "Executed",
  ExecutionFailed: "ExecutionFailed",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  [AuditEntityType.Promo]: "Promo",
  [AuditEntityType.Deal]: "Deal",
  [AuditEntityType.Coupon]: "Coupon",
  [AuditEntityType.ExchangeRate]: "Exchange rate",
  [AuditEntityType.Brand]: "Brand",
  [AuditEntityType.BrandRestriction]: "Brand restriction",
  [AuditEntityType.BrandAuthorization]: "Brand authorization",
  [AuditEntityType.PartnerAllocation]: "Partner allocation",
  [AuditEntityType.Product]: "Product",
  [AuditEntityType.PlatformSetting]: "Platform setting",
  [AuditEntityType.DebtCollection]: "Debt collection",
  [AuditEntityType.ApprovalRequest]: "Approval request",
};

const ACTION_COLORS: Record<string, string> = {
  [AuditAction.Created]: "success",
  [AuditAction.Granted]: "success",
  [AuditAction.Approved]: "success",
  [AuditAction.Executed]: "success",
  [AuditAction.Updated]: "processing",
  [AuditAction.Submitted]: "processing",
  [AuditAction.Deleted]: "error",
  [AuditAction.Revoked]: "error",
  [AuditAction.Rejected]: "error",
  [AuditAction.ExecutionFailed]: "error",
  [AuditAction.Reset]: "warning",
  [AuditAction.Forced]: "warning",
};

/**
 * Display name for an entity type. Unknown values are spaced out rather than
 * dropped — the backend can add a constant before this list is updated, and a
 * raw-but-readable label beats hiding the row's subject.
 */
export function entityTypeLabel(entityType: string | null | undefined): string {
  if (!entityType) return "—";
  return ENTITY_TYPE_LABELS[entityType] ?? humanFieldName(entityType);
}

/** Tag colour for an action. Unknown/new actions fall back to grey. */
export function auditActionColor(action: string | null | undefined): string {
  if (!action) return "default";
  return ACTION_COLORS[action] ?? "default";
}

/** Dropdown options for the entity-type filter, alphabetical by label. */
export const ENTITY_TYPE_OPTIONS = Object.values(AuditEntityType)
  .map((value) => ({ value, label: entityTypeLabel(value) }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Dropdown options for the action filter, in the backend's declaration order. */
export const ACTION_OPTIONS = Object.values(AuditAction).map((value) => ({
  value,
  label: humanFieldName(value),
}));

/** "ExecutionFailed" -> "Execution Failed". */
export function humanFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Render any snapshot value as a single readable string. */
export function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return s;
}

/**
 * Money fields are named by their currency on the backend
 * (OverridePriceInNaira / PriceInDollar / AmountInNaira…), which is the only
 * signal available for formatting a bare number in a snapshot.
 */
export function currencyOfField(key: string): "NGN" | "USD" | null {
  if (/naira$/i.test(key)) return "NGN";
  if (/dollar$/i.test(key)) return "USD";
  return null;
}

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGuid(value: unknown): value is string {
  return typeof value === "string" && GUID_RE.test(value);
}

/** Ceiling per kind on the ids one entry will look up, so a bulk payload can't fan out. */
const MAX_LOOKUPS = 25;

/** Keys whose GUID values name a product: ProductId, Products, product_id… */
const PRODUCT_KEY_RE = /^products?(_?id)?$/i;
/**
 * …and a customer. Bare "User"/"Users" is left out deliberately — it shows up
 * holding admin ids, which would 404 against the customer read.
 */
const CUSTOMER_KEY_RE = /^(customers?(_?id)?|users?_?id)$/i;

export interface AuditEntityIds {
  products: string[];
  customers: string[];
}

/**
 * Product and customer ids anywhere in a set of snapshots —
 * `{"ProductId":"4fa060c2-…"}` says nothing to a reader, so the modal trades
 * them for names.
 *
 * Keys are matched rather than values because a snapshot is arbitrary JSON and
 * the ids sit at different depths per entity: a coupon nests product ids under
 * Products[] and lists customer ids as bare GUIDs under Customers, while other
 * entities carry one at the top level. The key travels down through arrays so a
 * list of bare ids is still attributed to the field that holds it.
 */
export function collectEntityIds(...roots: unknown[]): AuditEntityIds {
  const products = new Set<string>();
  const customers = new Set<string>();

  const walk = (node: unknown, key?: string) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, k);
      return;
    }
    if (!key || !isGuid(node)) return;
    if (PRODUCT_KEY_RE.test(key) && products.size < MAX_LOOKUPS)
      products.add(node);
    else if (CUSTOMER_KEY_RE.test(key) && customers.size < MAX_LOOKUPS)
      customers.add(node);
  };

  for (const root of roots) walk(root);
  return { products: Array.from(products), customers: Array.from(customers) };
}

export type AuditMode = "created" | "deleted" | "updated";

/**
 * Whether a row should render as a diff or a single snapshot. Actions outside
 * the create/update/delete trio (Approved, Executed, Granted…) are logged via
 * LogActionAsync, which stores only a detail payload in afterData — so they
 * classify as "created" and render as one snapshot table, which is correct.
 */
export function classifyAction(item: AdminAuditLogItem): AuditMode {
  const a = item.action?.toLowerCase() ?? "";
  if (a.includes("delete") || a.includes("remove") || a.includes("revoke"))
    return "deleted";
  if (a.includes("update") || a.includes("edit") || a.includes("modif") || a.includes("change"))
    return "updated";
  if (a.includes("create") || a.includes("add") || a.includes("insert"))
    return "created";
  // Fall back to the data shape: empty before -> created, empty after -> deleted.
  const beforeEmpty = !item.beforeData || Object.keys(item.beforeData).length === 0;
  const afterEmpty = !item.afterData || Object.keys(item.afterData).length === 0;
  if (beforeEmpty && !afterEmpty) return "created";
  if (afterEmpty && !beforeEmpty) return "deleted";
  return "updated";
}

// ---- Role attribution ----
//
// AdminAuditLog.RoleName does not contain a role name. The admin JWT serialises
// the acting role's *permission list* into the role claim
// (AdminAuthenticationService.GetClaims, because PermissionFilter deserialises it
// back out), and CurrentAdminAccessor copies that claim straight into the audit
// row — so the stored value reads ["CanViewOrders","CanEditOrders",…].
//
// The name is recovered here by matching that permission set against the roles
// the API reports. Roles get edited, so a row written before an edit will not
// match its role exactly; a close-enough winner is reported as a closest match
// rather than as fact.

/** How close a permission set must be to a role's before we name it at all. */
const MIN_SIMILARITY = 0.85;
/** …and how far clear of the runner-up, so near-identical roles stay unnamed. */
const MIN_LEAD = 0.1;

export interface ResolvedRole {
  /** Text for the Role cell. */
  label: string;
  /** `name` — certain. `closest` — best match, role edited since. `unknown` — no match. */
  kind: "name" | "closest" | "unknown";
  /** Permissions recovered from the claim, for the hover detail. Null when the row stored a real name. */
  permissions: string[] | null;
}

/**
 * Permission names out of a stored RoleName, or null when the value is not a
 * serialised list (a plain role name, or empty).
 */
export function parsePermissionClaim(
  value: string | null | undefined,
): string[] | null {
  const text = value?.trim();
  if (!text || !text.startsWith("[")) return null;

  const unique = (names: string[]) => Array.from(new Set(names)).sort();

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return unique(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    // AdminAuditLog.RoleName is capped at 128 chars, so older rows can hold JSON
    // cut off mid-array. Salvage the names that are still intact.
    const names = text.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
    return names.length > 0 ? unique(names) : null;
  }
}

/** Overlap of two permission sets, 0 to 1. */
function similarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const other = new Set(b);
  const shared = a.filter((x) => other.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

/** Turns an audit row's `roleName` into something worth putting in a table cell. */
export function resolveRoleName(
  value: string | null | undefined,
  roles: RoleResponse[],
): ResolvedRole | null {
  const permissions = parsePermissionClaim(value);

  if (!permissions) {
    const name = value?.trim();
    return name ? { label: name, kind: "name", permissions: null } : null;
  }

  const scored = roles
    .map((role) => ({
      name: role.name,
      score: similarity(
        permissions,
        Array.from(new Set((role.permissions ?? []).map((p) => p.name as string))).sort(),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const [best, runnerUp] = scored;

  if (best?.score === 1)
    return { label: best.name, kind: "name", permissions };

  if (
    best &&
    best.score >= MIN_SIMILARITY &&
    best.score - (runnerUp?.score ?? 0) >= MIN_LEAD
  )
    return { label: best.name, kind: "closest", permissions };

  return {
    label: `${permissions.length} permission${permissions.length === 1 ? "" : "s"}`,
    kind: "unknown",
    permissions,
  };
}

// The backend writes the diff as { "Field": { "Before": x, "After": y } } with no
// naming policy, but the envelope it rides in is camelCased — accept either so a
// serializer change on the backend doesn't blank out the diff column.
export function changeBefore(change: AuditChange | undefined): unknown {
  if (!change) return undefined;
  return "Before" in change ? change.Before : change.before;
}

export function changeAfter(change: AuditChange | undefined): unknown {
  if (!change) return undefined;
  return "After" in change ? change.After : change.after;
}
