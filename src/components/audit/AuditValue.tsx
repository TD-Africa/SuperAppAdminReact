import { Tooltip } from "antd";
import {
  currencyOfField,
  formatValue,
  humanFieldName,
  isGuid,
} from "@/lib/auditTrail";
import { formatCurrency } from "@/lib/utils";
import type { AuditEntityNames } from "@/hooks/useAuditEntityNames";

interface AuditValueProps {
  /** Anything a snapshot can hold: primitive, object, or list of either. */
  value: unknown;
  /** The field this value sits under. Drives currency and id formatting. */
  fieldKey?: string;
  /** Product/customer id → name, from useAuditEntityNames. */
  names?: AuditEntityNames;
}

/**
 * A snapshot value, rendered for someone who does not read JSON.
 *
 * Audit payloads are the entity's own serialised shape, so a single field can be
 * a raw object (`{"ProductId":"4fa060c2-…","OverridePriceInDollar":768}`) or a
 * list of them. Those get broken out into labelled lines, ids traded for the
 * product or customer they point at, and money printed as money. Primitives fall
 * through to formatValue.
 */
export function AuditValue({ value, fieldKey, names }: AuditValueProps) {
  if (value == null) return <>—</>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <>—</>;

    // A list of plain values reads fine as a list of plain values.
    if (!value.some((v) => v && typeof v === "object"))
      return <Leaf value={value} fieldKey={fieldKey} names={names} />;

    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div
            key={i}
            className={i > 0 ? "border-t border-black/10 pt-2" : undefined}
          >
            {value.length > 1 && (
              <div className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                {i + 1}.
              </div>
            )}
            <AuditValue value={item} fieldKey={fieldKey} names={names} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <>—</>;

    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs text-muted-foreground">
              {fieldLabel(k, v, names)}:
            </span>
            <span className="min-w-0 break-words">
              <AuditValue value={v} fieldKey={k} names={names} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <Leaf value={value} fieldKey={fieldKey} names={names} />;
}

/**
 * "Product Id" reads wrong above a product's name, so the suffix goes whenever
 * the id was traded for the thing it points at.
 */
function fieldLabel(
  key: string,
  value: unknown,
  names?: AuditEntityNames,
): string {
  const named = isGuid(value) && !!names?.[value];
  return humanFieldName(named ? key.replace(/_?id$/i, "") : key);
}

/** A primitive (or list of primitives) with the field's own formatting applied. */
function Leaf({ value, fieldKey, names }: AuditValueProps) {
  if (Array.isArray(value))
    return (
      <>
        {value.map((v, i) => (
          <span key={i}>
            {i > 0 && ", "}
            <Leaf value={v} fieldKey={fieldKey} names={names} />
          </span>
        ))}
      </>
    );

  const named = isGuid(value) ? names?.[value] : undefined;
  if (named)
    return (
      <Tooltip title={named.detail ?? (value as string)}>
        <span className="cursor-help">{named.label}</span>
      </Tooltip>
    );

  const currency = fieldKey ? currencyOfField(fieldKey) : null;
  if (currency && typeof value === "number")
    return <>{formatCurrency(value, currency)}</>;

  return <>{formatValue(value)}</>;
}
