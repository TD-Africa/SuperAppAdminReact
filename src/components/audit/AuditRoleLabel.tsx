import { Tooltip } from "antd";
import { resolveRoleName } from "@/lib/auditTrail";
import type { RoleResponse } from "@/lib/types";

/** Permissions listed in the hover before it collapses to a count. */
const TOOLTIP_LIMIT = 12;

interface AuditRoleLabelProps {
  /** The row's raw `roleName` — usually a serialised permission list. */
  value: string | null | undefined;
  /** Candidates from useAuditRoleCandidates. */
  roles: RoleResponse[];
  className?: string;
}

/**
 * The Role cell for an audit row: the role's name where it can be established,
 * never the permission list itself. The permissions stay reachable on hover
 * because they are what was actually recorded.
 */
export function AuditRoleLabel({ value, roles, className }: AuditRoleLabelProps) {
  const resolved = resolveRoleName(value, roles);
  if (!resolved) return <span className={className}>—</span>;

  const { label, kind, permissions } = resolved;

  if (!permissions || permissions.length === 0)
    return <span className={className}>{label}</span>;

  const shown = permissions.slice(0, TOOLTIP_LIMIT);
  const rest = permissions.length - shown.length;

  return (
    <Tooltip
      title={
        <div className="text-xs">
          <div className="mb-1 font-medium">
            {kind === "unknown"
              ? "No role matches these permissions"
              : kind === "closest"
                ? "Closest match — the role has been edited since"
                : label}
          </div>
          <div>
            {shown.join(", ")}
            {rest > 0 && `, +${rest} more`}
          </div>
        </div>
      }
    >
      <span className={"cursor-help " + (className ?? "")}>
        {label}
        {kind === "closest" && (
          <span className="ml-1 text-muted-foreground">(closest match)</span>
        )}
      </span>
    </Tooltip>
  );
}
