import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PaginationResponse, RatingResponseWithUser } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

function StarRow({ score }: { score: number }) {
  const full = Math.round(score);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < full
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/40",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-medium">{score.toFixed(1)}</span>
    </div>
  );
}

export default function RatingsPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ratings", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RatingResponseWithUser>>(
        `Component/GetRatings?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load ratings");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ratings</h1>
        <p className="text-sm text-muted-foreground">
          Customer ratings and comments across the platform.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by comment or company…"
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
                <TableHead>Score</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Customer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No ratings yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <StarRow score={r.score} />
                    </TableCell>
                    <TableCell className="max-w-[640px]">
                      <p className="whitespace-pre-wrap text-sm">
                        {r.comment ?? (
                          <span className="text-muted-foreground">No comment</span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.companyName ?? "—"}
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
    </div>
  );
}
