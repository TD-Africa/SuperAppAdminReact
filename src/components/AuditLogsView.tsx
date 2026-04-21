import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { AuditLogItem, PaginatedApiResponse } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AuditLogsViewProps<T extends AuditLogItem> {
  title: string;
  description: string;
  /** Relative URL (without leading slash) for the list endpoint. */
  listUrl: string;
  /** Relative URL prefix for by-id lookup; the id is appended. */
  byIdUrl: string;
  /** Field on each item that identifies the entity (e.g. "promoId" or "dealId"). */
  entityIdField: keyof T & string;
  /** Display name for the entity id column. */
  entityIdLabel: string;
}

export function AuditLogsView<T extends AuditLogItem>({
  title,
  description,
  listUrl,
  byIdUrl,
  entityIdField,
  entityIdLabel,
}: AuditLogsViewProps<T>) {
  const [idSearch, setIdSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [singleResult, setSingleResult] = useState<T | null>(null);
  const [selected, setSelected] = useState<T | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("pageNumber", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortOrder", sortOrder);
    return params;
  }, [page, pageSize, sortOrder]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", listUrl, queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginatedApiResponse<T>>(
        `${listUrl}?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load logs");
      return res.data;
    },
    enabled: !singleResult,
  });

  async function searchById() {
    const trimmed = idSearch.trim();
    if (!trimmed) {
      toast.error("Please enter a log ID");
      return;
    }
    const res = await apiGet<T>(`${byIdUrl}${trimmed}`);
    if (!res.status || !res.data) {
      toast.error(res.message ?? "Log not found");
      return;
    }
    setSingleResult(res.data);
  }

  const rows: T[] = singleResult ? [singleResult] : (data?.data as T[]) ?? [];
  const totalItems = singleResult ? 1 : Number(data?.totalRecords ?? 0);
  const pageCount = singleResult
    ? 1
    : Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <div className="relative md:col-span-7">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Lookup by log ID (GUID)…"
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchById();
              }}
            />
          </div>
          <Button
            variant="outline"
            className="md:col-span-2"
            onClick={searchById}
          >
            Search
          </Button>
          <Select
            value={sortOrder}
            onValueChange={(v) => {
              setSortOrder(v as "desc" | "asc");
              setPage(1);
              setSingleResult(null);
            }}
          >
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          {singleResult && (
            <Button
              variant="ghost"
              className="md:col-span-1"
              onClick={() => {
                setSingleResult(null);
                setIdSearch("");
              }}
            >
              Reset
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {isFetching && !isLoading ? "Refreshing…" : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>{entityIdLabel}</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !singleResult ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No audit logs recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {String(r[entityIdField] ?? "—").slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{r.adminEmail}</div>
                      {r.roleName && (
                        <div className="text-xs text-muted-foreground">
                          {r.roleName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.ipAddress}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(r)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!singleResult && (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <span className="text-muted-foreground">
                {totalItems === 0
                  ? "No results"
                  : `Page ${page} of ${pageCount}`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AuditLogDetailDialog
        item={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}

// --- Detail dialog with before/after diff ---
interface Row {
  fieldName: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

function humanFieldName(key: string): string {
  // camelCase → Title Case with spaces
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(v: unknown): string {
  if (v == null) return "null";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // ISO date detection
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return s;
}

function AuditLogDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: AuditLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { allFields, changedFields } = useMemo(() => {
    if (!item) return { allFields: [], changedFields: [] };
    const before = (item.beforeData ?? {}) as Record<string, unknown>;
    const after = (item.afterData ?? {}) as Record<string, unknown>;
    const changes = (item.updatedData?.changes ?? {}) as Record<string, unknown>;
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    ).sort();
    const rows: Row[] = keys.map((k) => ({
      fieldName: humanFieldName(k),
      before: before[k],
      after: after[k],
      changed: k in changes,
    }));
    return {
      allFields: rows,
      changedFields: rows.filter((r) => r.changed),
    };
  }, [item]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit log details</DialogTitle>
          <DialogDescription>
            {item ? (
              <>
                <Badge variant="outline" className="mr-2">
                  {item.action}
                </Badge>
                by {item.adminEmail} on {new Date(item.createdAt).toLocaleString()}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-6">
            {changedFields.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Summary of changes ({changedFields.length})
                </h4>
                <DiffTable rows={changedFields} onlyChanged />
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-medium">Full before / after</h4>
              <DiffTable rows={allFields} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffTable({ rows, onlyChanged }: { rows: Row[]; onlyChanged?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        {onlyChanged ? "No fields changed." : "No data recorded."}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Field</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.fieldName}>
              <TableCell className="align-top font-medium">
                {row.fieldName}
              </TableCell>
              <TableCell
                className={cn(
                  "align-top text-sm",
                  row.changed && "bg-amber-500/10",
                )}
              >
                <span className="whitespace-pre-wrap break-words">
                  {formatValue(row.before)}
                </span>
              </TableCell>
              <TableCell
                className={cn(
                  "align-top text-sm",
                  row.changed && "bg-emerald-500/10",
                )}
              >
                <span className="whitespace-pre-wrap break-words">
                  {formatValue(row.after)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
