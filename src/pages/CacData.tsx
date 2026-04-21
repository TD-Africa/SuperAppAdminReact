import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { CacRegistrationResponse } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/DataTablePagination";
import { CacDataDetailModal } from "@/components/cac/CacDataDetailModal";

export default function CacDataPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 250);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Endpoint returns the full list — filter and paginate client-side
  // (mirrors the Blazor CacData.razor which does the same).
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["cac-registrations"],
    queryFn: async () => {
      const res = await apiGet<CacRegistrationResponse[]>(
        "CacRegistration/GetAllCacRegistrations",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load CAC data");
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = debouncedKeyword.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [
        r.firstPreferredBusinessName,
        r.secondPreferredBusinessName,
        r.businessDescription,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [data, debouncedKeyword]);

  const totalItems = filtered.length;
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CAC Data</h1>
        <p className="text-sm text-muted-foreground">
          Corporate Affairs Commission registrations submitted during onboarding.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by business name or description…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
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
                <TableHead>First preferred business name</TableHead>
                <TableHead>Second preferred</TableHead>
                <TableHead>Business description</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Directors</TableHead>
                <TableHead className="text-right">Secretaries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No CAC records match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.firstPreferredBusinessName ?? "—"}
                    </TableCell>
                    <TableCell>{r.secondPreferredBusinessName ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {r.businessDescription ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.dateCreated)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.directors?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.secretaries?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDetail(r.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <CacDataDetailModal
        cacId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
      />
    </div>
  );
}
