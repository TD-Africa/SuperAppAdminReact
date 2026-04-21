import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import {
  TicketCategoryValues,
  TicketStatusValues,
  type PaginationResponse,
  type TicketResponse,
  type TicketStatus,
} from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
import { TicketDetailModal } from "@/components/tickets/TicketDetailModal";

const ALL = "__all__";

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketsPage() {
  const [searchParams] = useSearchParams();
  const isOpenParam = searchParams.get("IsOpen");

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [ticketStatus, setTicketStatus] = useState<string>(ALL);
  const [ticketCategory, setTicketCategory] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Mirror the Blazor IsOpen query-param behaviour: ?IsOpen=true forces status=Opened.
  useEffect(() => {
    if (isOpenParam === "true") setTicketStatus("Opened");
    else if (isOpenParam === "false") setTicketStatus("Closed");
  }, [isOpenParam]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (ticketStatus !== ALL) params.set("ticketStatus", ticketStatus);
    if (ticketCategory !== ALL) params.set("ticketCategory", ticketCategory);
    return params;
  }, [pageSize, page, debouncedKeyword, ticketStatus, ticketCategory]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["tickets", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<TicketResponse>>(
        `Ticket/GetTickets?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load tickets");
      return res.data;
    },
  });

  async function handleCloseTicket(ticketId: string) {
    const res = await apiPut<boolean>(`Ticket/CloseTicket/${ticketId}`);
    if (res.status) {
      toast.success(res.message ?? "Ticket closed");
      refetch();
    } else {
      toast.error(res.message ?? "Failed to close ticket");
    }
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const statusVariant: Record<TicketStatus, "success" | "warning" | "secondary"> = {
    Opened: "success",
    Pending: "warning",
    Closed: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Review and respond to customer support tickets.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search by topic, description, company…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            value={ticketStatus}
            onValueChange={(v) => {
              setPage(1);
              setTicketStatus(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {TicketStatusValues.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ticketCategory}
            onValueChange={(v) => {
              setPage(1);
              setTicketCategory(v);
            }}
          >
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {TicketCategoryValues.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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
                <TableHead>Topic</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Status</TableHead>
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
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No tickets match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{t.topic}</span>
                        {t.hasUnreadComment && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{t.user?.companyName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(t.dateOpened)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(t.dateClosed)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={t.hasUnreadComment ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDetail(t.id)}
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

      <TicketDetailModal
        ticketId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
        onCloseTicket={handleCloseTicket}
      />
    </div>
  );
}
