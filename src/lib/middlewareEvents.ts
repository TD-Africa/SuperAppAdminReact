// Mirrors of TDSuperApp.DTOs.Response.MiddlewareEvents / Request.MiddlewareEventFilterDto.
// Backs the MiddlewareEvents controller: the Middleware webhook inbox monitor.

/** Mirror of MiddlewareEventStatus. Serialised by name. */
export const MiddlewareEventStatus = {
  Pending: "Pending",
  Retrying: "Retrying",
  GaveUp: "GaveUp",
  Applied: "Applied",
  Skipped: "Skipped",
  Superseded: "Superseded",
} as const;

export type MiddlewareEventStatus =
  (typeof MiddlewareEventStatus)[keyof typeof MiddlewareEventStatus];

export type MiddlewareEventHealth = "Healthy" | "Degraded" | "Stalled";

/** Mirror of MiddlewareEventTypes — the literal strings the Query filter matches with `==`. */
export const MiddlewareEventType = {
  PriceChange: "product.price-change",
  QuantityChange: "product.quantity-change",
  NewProduct: "product.new-product",
  ProductDetailsChange: "product.product-details-change",
} as const;

export interface MiddlewareEventRow {
  id: string;
  eventType: string;
  dynamicsId: string;
  /** "color/config/size/style/version"; all blank for a plain product or a product-level event. */
  variantSignature: string;
  status: MiddlewareEventStatus;
  attemptCount: number;
  lastError: string | null;
  receivedAt: string;
  lastAttemptAt: string | null;
  processedAt: string | null;
  nextAttemptAt: string | null;
  latencySeconds: number | null;
}

export interface MiddlewareEventDetail {
  event: MiddlewareEventRow;
  rawPayload: unknown;
  skuHistory: MiddlewareEventRow[];
}

// Dictionary<MiddlewareEventStatus,int> keys come through as the enum names
// (no DictionaryKeyPolicy on the admin API), so these stay PascalCase.
export type StatusCounts = Partial<Record<MiddlewareEventStatus, number>>;

export interface MiddlewareEventErrorGroup {
  error: string;
  eventType: string;
  count: number;
  lastSeenAt: string;
  exampleDynamicsId: string;
}

export interface MiddlewareEventSummary {
  generatedAt: string;
  windowHours: number;
  health: MiddlewareEventHealth;
  healthReasons: string[];
  /** Open statuses count every open row; closed statuses count rows processed in the window. */
  byStatus: StatusCounts;
  byEventType: { eventType: string; byStatus: StatusCounts }[];
  receivedInWindow: number;
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
  oldestPendingAt: string | null;
  oldestPendingAgeSeconds: number | null;
  averageLatencySeconds: number | null;
  topErrors: MiddlewareEventErrorGroup[];
}

export interface MiddlewareEventReplayResult {
  requeued: number;
  /** Not requeued because an identical event is already waiting; that one will apply instead. */
  alreadyQueued: number;
  notEligible: number;
}

export interface MiddlewareEventFilter {
  status?: MiddlewareEventStatus;
  eventType?: string;
  dynamicsId?: string;
  from?: string;
  to?: string;
  errorContains?: string;
}

/** ReplayMany only accepts these; Pending/Retrying are already queued and Applied would re-apply stale values. */
export const BULK_REPLAYABLE: MiddlewareEventStatus[] = [
  MiddlewareEventStatus.GaveUp,
  MiddlewareEventStatus.Skipped,
];

/** Server-side ceiling on one ReplayMany call. */
export const MAX_BULK_REPLAY = 500;

/** Open statuses first — they are the ones that need attention. */
export const STATUS_ORDER: MiddlewareEventStatus[] = [
  MiddlewareEventStatus.Pending,
  MiddlewareEventStatus.Retrying,
  MiddlewareEventStatus.GaveUp,
  MiddlewareEventStatus.Applied,
  MiddlewareEventStatus.Skipped,
  MiddlewareEventStatus.Superseded,
];

const STATUS_META: Record<
  MiddlewareEventStatus,
  { label: string; color: string; hint: string }
> = {
  Pending: {
    label: "Pending",
    color: "processing",
    hint: "Received, not attempted yet. Should only ever be seconds old.",
  },
  Retrying: {
    label: "Retrying",
    color: "warning",
    hint: "Failed at least once; will be retried at the next attempt time.",
  },
  GaveUp: {
    label: "Gave up",
    color: "error",
    hint: "Hit the attempt ceiling. Will not be retried unless replayed.",
  },
  Applied: { label: "Applied", color: "success", hint: "Applied to the product." },
  Skipped: {
    label: "Skipped",
    color: "default",
    hint: "Deliberately not applied (0/0 price, unknown warehouse…). Reason in the error.",
  },
  Superseded: {
    label: "Superseded",
    color: "default",
    hint: "Closed unapplied because a newer event for the same variant exists.",
  },
};

export function statusLabel(s: string): string {
  return STATUS_META[s as MiddlewareEventStatus]?.label ?? s;
}

export function statusColor(s: string): string {
  return STATUS_META[s as MiddlewareEventStatus]?.color ?? "default";
}

export function statusHint(s: string): string {
  return STATUS_META[s as MiddlewareEventStatus]?.hint ?? "";
}

export const STATUS_OPTIONS = STATUS_ORDER.map((value) => ({
  value,
  label: statusLabel(value),
}));

export function healthColor(h: MiddlewareEventHealth): "success" | "warning" | "error" {
  if (h === "Stalled") return "error";
  if (h === "Degraded") return "warning";
  return "success";
}

/** "product.price-change" -> "Price change". Unknown types still read sensibly. */
export function eventTypeLabel(t: string | null | undefined): string {
  if (!t) return "—";
  const tail = t.split(".").pop() ?? t;
  const words = tail.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : t;
}

export const EVENT_TYPE_OPTIONS = Object.values(MiddlewareEventType).map(
  (value) => ({ value, label: eventTypeLabel(value) }),
);

/** The variant signature without its empty slots; "—" for a plain product. */
export function variantLabel(signature: string | null | undefined): string {
  const parts = (signature ?? "").split("/").filter((p) => p.trim());
  return parts.length ? parts.join(" / ") : "—";
}

/** Seconds to a compact duration: 42s, 3m 10s, 2.4h, 3.1d. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, seconds);
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = Math.round(s % 60);
    return rem ? `${m}m ${rem}s` : `${m}m`;
  }
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

/** "3m ago" / "in 40s" relative to now. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  return diff >= 0
    ? `${formatDuration(diff)} ago`
    : `in ${formatDuration(-diff)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const STATUS_BY_LOWER = new Map(
  STATUS_ORDER.map((s) => [s.toLowerCase(), s] as const),
);

/**
 * byStatus keys are expected as the enum names ("GaveUp"), but nothing on the
 * admin API pins that — a DictionaryKeyPolicy added later would camelCase them
 * and zero every card. Match keys case-insensitively and drop unknown ones.
 */
export function normalizeStatusCounts(raw: unknown): StatusCounts {
  const out: StatusCounts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    const status = STATUS_BY_LOWER.get(key.toLowerCase());
    if (status && typeof value === "number") out[status] = value;
  }
  return out;
}

export function normalizeSummary(s: MiddlewareEventSummary): MiddlewareEventSummary {
  return {
    ...s,
    byStatus: normalizeStatusCounts(s.byStatus),
    byEventType: (s.byEventType ?? []).map((t) => ({
      ...t,
      byStatus: normalizeStatusCounts(t.byStatus),
    })),
  };
}

/** Filter -> the PascalCase query/body keys the controller binds. */
export function filterToParams(filter: MiddlewareEventFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.status) params.set("Status", filter.status);
  if (filter.eventType) params.set("EventType", filter.eventType);
  if (filter.dynamicsId?.trim()) params.set("DynamicsId", filter.dynamicsId.trim());
  if (filter.from) params.set("From", filter.from);
  if (filter.to) params.set("To", filter.to);
  if (filter.errorContains?.trim())
    params.set("ErrorContains", filter.errorContains.trim());
  return params;
}
