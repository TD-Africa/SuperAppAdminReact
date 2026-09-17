import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import type { PaginationResponse, RoleResponse } from "@/lib/types";

/** Roles to hydrate individually when the list omits their permissions. */
const HYDRATE_LIMIT = 25;

/**
 * Roles to match an audit row's permission claim against — see the role
 * attribution notes in @/lib/auditTrail for why the matching exists at all.
 *
 * Two quirks of the API shape this:
 *
 * - GetRoles is gated on CanViewRoles, which an auditor need not hold, so the
 *   request is skipped without it. The signed-in admin's own role still comes
 *   from the auth store, which alone names most rows — most of what an admin
 *   reads in the audit trail is their own work. The rest degrade to a
 *   permission count rather than an error.
 * - GetRolesAsync doesn't `Include` Permissions (GetRoleAsync does), so list
 *   rows can arrive with none. Those are re-read one by one; without their
 *   permissions they are useless as match candidates.
 */
export function useAuditRoleCandidates(enabled = true): RoleResponse[] {
  const canViewRoles = useAuthStore((s) =>
    s.hasPermission(Permission.CanViewRoles),
  );
  const ownRole = useAuthStore((s) => s.user?.userDTO.role ?? null);

  const { data } = useQuery({
    queryKey: ["audit-role-candidates"],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RoleResponse>>(
        "Authentication/GetRoles?PageNumber=1&PageSize=200",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load roles");
      const roles = res.data?.data ?? [];

      const bare = roles
        .filter((r) => !r.permissions || r.permissions.length === 0)
        .slice(0, HYDRATE_LIMIT);

      if (bare.length === 0) return roles;

      const hydrated = new Map<string, RoleResponse>();
      await Promise.all(
        bare.map(async (role) => {
          const one = await apiGet<RoleResponse>(
            `Authentication/GetRole/${role.id}`,
          );
          if (one.status && one.data) hydrated.set(role.id, one.data);
        }),
      );

      return roles.map((r) => hydrated.get(r.id) ?? r);
    },
    enabled: enabled && canViewRoles,
    staleTime: 30 * 60_000,
    retry: false,
  });

  return useMemo(() => {
    const byId = new Map<string, RoleResponse>();
    if (ownRole?.id) byId.set(ownRole.id, ownRole);
    for (const role of data ?? []) byId.set(role.id, role);
    // A role with no permissions can only match an empty claim, and would
    // otherwise crowd the similarity scoring.
    return Array.from(byId.values()).filter((r) => r.permissions?.length);
  }, [data, ownRole]);
}
