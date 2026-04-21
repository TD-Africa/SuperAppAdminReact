import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import type {
  ActionStatus,
  PaginationResponse,
  RequestAppealResponseWithUser,
} from "@/lib/types";
import { ActionStatusValues } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
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
import { DataTablePagination } from "@/components/DataTablePagination";

const ALL = "__all__";

function statusFor(row: { isActedOn: boolean; isAccepted: boolean }): ActionStatus {
  if (!row.isActedOn) return "PENDING";
  return row.isAccepted ? "APPROVED" : "DECLINED";
}

export default function RequestAppealsPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditRequestAppeals),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [action, setAction] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (action !== ALL) params.set("action", action);
    return params;
  }, [pageSize, page, debouncedKeyword, action]);

  const queryKey = ["request-appeals", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RequestAppealResponseWithUser>>(
        `Component/GetRequestAppeals?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load appeals");
      return res.data;
    },
  });

  async function decide(row: RequestAppealResponseWithUser, approve: boolean) {
    const prev =
      queryClient.getQueryData<PaginationResponse<RequestAppealResponseWithUser>>(
        queryKey,
      );
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<RequestAppealResponseWithUser>>(
        queryKey,
        {
          ...prev,
          data: prev.data.map((x) =>
            x.id === row.id
              ? { ...x, isActedOn: true, isAccepted: approve }
              : x,
          ),
        },
      );
    }
    const res = await apiPut<boolean>(`Component/UpdateRequestAppeal/${row.id}`, {
      isApproved: approve,
    });
    if (!res.status) {
      toast.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      toast.success(res.message ?? (approve ? "Approved" : "Declined"));
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const statusVariant: Record<ActionStatus, "warning" | "success" | "destructive"> = {
    PENDING: "warning",
    APPROVED: "success",
    DECLINED: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request Appeals</h1>
        <p className="text-sm text-muted-foreground">
          Review partner appeal submissions.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search by name, company, or phone…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            value={action}
            onValueChange={(v) => {
              setPage(1);
              setAction(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {ActionStatusValues.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
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
                    No appeals to review.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const s = statusFor(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name ?? "—"}</TableCell>
                      <TableCell>{r.company ?? r.companyName ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(r.dateCreated)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[s]}>{s}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!r.isActedOn ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-emerald-600"
                              disabled={!canEdit}
                              onClick={() => decide(r, true)}
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              disabled={!canEdit}
                              onClick={() => decide(r, false)}
                              title="Decline"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
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
