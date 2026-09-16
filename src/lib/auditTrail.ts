import type { AdminAuditLogItem, AuditChange } from "@/lib/types";

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
