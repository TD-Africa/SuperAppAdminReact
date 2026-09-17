import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { collectEntityIds } from "@/lib/auditTrail";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import type {
  AdminAuditLogItem,
  CustomerResponse,
  ProductReturnDto,
} from "@/lib/types";

/** What a GUID in a snapshot actually refers to. */
export interface AuditEntityName {
  /** Short enough for a table cell. */
  label: string;
  /** The rest of the identity, for the hover. */
  detail?: string;
}

export type AuditEntityNames = Record<string, AuditEntityName>;

/**
 * Names for the product and customer ids an audit entry mentions, keyed by id.
 *
 * One request per id — the admin API has no batch read — cached per id for the
 * session, so an id costs one request no matter how many entries mention it.
 * The ids themselves are capped by collectEntityIds.
 *
 * Each read is gated on its own permission (CanViewProducts / CanViewUser),
 * which an auditor need not hold; without it, or when the record has since been
 * deleted, callers fall back to the raw id.
 */
export function useAuditEntityNames(
  entry: AdminAuditLogItem | null | undefined,
): AuditEntityNames {
  const canViewProducts = useAuthStore((s) =>
    s.hasPermission(Permission.CanViewProducts),
  );
  const canViewUsers = useAuthStore((s) =>
    s.hasPermission(Permission.CanViewUser),
  );

  // Read off both snapshots, not the rendered rows: an id can appear on one
  // side only, and a lookup missing there would leave half a diff showing a GUID.
  const { products, customers } = useMemo(
    () => collectEntityIds(entry?.beforeData, entry?.afterData),
    [entry],
  );

  const results = useQueries({
    queries: [
      ...products.map((id) => ({
        queryKey: ["audit-name", "product", id],
        queryFn: async (): Promise<AuditEntityName | null> => {
          const res = await apiGet<ProductReturnDto>(`Product/GetProduct/${id}`);
          if (!res.status || !res.data) return null;
          const { productName, dynamicsId } = res.data;
          return {
            label: productName,
            detail: dynamicsId ? `${dynamicsId} · ${id}` : id,
          };
        },
        enabled: canViewProducts,
        staleTime: Infinity,
        retry: false,
      })),
      ...customers.map((id) => ({
        queryKey: ["audit-name", "customer", id],
        queryFn: async (): Promise<AuditEntityName | null> => {
          const res = await apiGet<CustomerResponse>(`User/GetUser/${id}`);
          if (!res.status || !res.data) return null;
          const c = res.data;
          const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
          const label =
            c.companyName?.trim() || person || c.email || c.userName || id;
          const detail = [c.email, id].filter(Boolean).join(" · ");
          return { label, detail };
        },
        enabled: canViewUsers,
        staleTime: Infinity,
        retry: false,
      })),
    ],
  });

  const ids = useMemo(
    () => [...products, ...customers],
    [products, customers],
  );
  const resolved = results.map((r) => r.data ?? null);

  return useMemo(() => {
    const map: AuditEntityNames = {};
    ids.forEach((id, i) => {
      const name = resolved[i];
      if (name) map[id] = name;
    });
    return map;
    // `resolved` is a fresh array each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, resolved.map((n) => n?.label ?? "").join("|")]);
}
