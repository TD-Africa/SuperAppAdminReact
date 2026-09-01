// Presentation primitives shared by the customer detail and edit modals, so the
// two stay visually in step.
import type { ReactNode } from "react";
import type { UserStatus } from "@/lib/types";

export const statusColor: Record<
  UserStatus,
  "success" | "warning" | "error" | "default"
> = {
  Active: "success",
  Pending: "warning",
  Suspended: "error",
  Rejected: "error",
  Incomplete: "default",
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/** Avatar + name + handle, used as the identity header on both modals. */
export function CustomerIdentity({
  name,
  subtitle,
  size = "md",
}: {
  name: string;
  subtitle?: ReactNode;
  size?: "sm" | "md";
}) {
  const avatar =
    size === "sm" ? "h-12 w-12 text-base" : "h-14 w-14 text-lg";
  const title = size === "sm" ? "text-base" : "text-lg";
  return (
    <div className={`flex items-start ${size === "sm" ? "gap-3" : "gap-4"}`}>
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${avatar}`}
      >
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-semibold leading-tight ${title}`}>
          {name}
        </div>
        {subtitle}
      </div>
    </div>
  );
}

/** Compact label/value row for the edit modal's narrow summary rail. */
export function StatRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
