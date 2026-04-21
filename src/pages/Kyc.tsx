import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, FileText } from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  CustomerResponse,
  PaginationResponse,
  UserStatus,
} from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { KycReviewModal } from "@/components/kyc/KycReviewModal";
import { DynamicsAccountModal } from "@/components/kyc/DynamicsAccountModal";

const ALL = "__all__";
// KYC page hides the Suspended status (Blazor filters it out of the dropdown).
const KYC_STATUSES: UserStatus[] = ["Pending", "Active", "Rejected", "Incomplete"];

export default function KycPage() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [status, setStatus] = useState<string>("Pending");
  const [joinedStart, setJoinedStart] = useState("");
  const [joinedEnd, setJoinedEnd] = useState("");
  const [orderStart, setOrderStart] = useState("");
  const [orderEnd, setOrderEnd] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [imageTarget, setImageTarget] = useState<{
    title: string;
    url: string;
    company: string;
  } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<CustomerResponse | null>(null);
  const [dynamicsTarget, setDynamicsTarget] = useState<CustomerResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (status !== ALL) params.set("status", status);
    if (joinedStart) params.set("joinedStartDate", joinedStart);
    if (joinedEnd) params.set("joinedEndDate", joinedEnd);
    if (orderStart) params.set("orderStartDate", orderStart);
    if (orderEnd) params.set("orderEndDate", orderEnd);
    return params;
  }, [pageSize, page, debouncedKeyword, status, joinedStart, joinedEnd, orderStart, orderEnd]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["kyc-customers", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<CustomerResponse>>(
        `User/GetUsers?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load KYC queue");
      return res.data;
    },
  });

  async function rejectCac(customer: CustomerResponse, reason: string) {
    const res = await apiPut<boolean>(`User/RejectKyc/${customer.id}`, {
      comment: reason,
    });
    if (!res.status) {
      throw new Error(res.message ?? "Rejection failed");
    }
    toast.success(res.message ?? "CAC file rejected");
    setReviewTarget(null);
    refetch();
  }

  async function rejectUtility(customer: CustomerResponse, reason: string) {
    const res = await apiPost<boolean>(
      `User/RejectUtilityBill/${customer.id}/reject-utility-bill`,
      { comment: reason },
    );
    if (!res.status) {
      throw new Error(res.message ?? "Rejection failed");
    }
    toast.success(res.message ?? "Utility bill rejected");
    setReviewTarget(null);
    refetch();
  }

  function handleApprove(customer: CustomerResponse) {
    setDynamicsTarget(customer);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const statusVariant: Record<
    string,
    "success" | "warning" | "destructive" | "secondary"
  > = {
    Active: "success",
    Pending: "warning",
    Rejected: "destructive",
    Incomplete: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC</h1>
        <p className="text-sm text-muted-foreground">
          Review customer CAC files and utility bills; approve to provision on Dynamics.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-12">
          <Input
            className="md:col-span-8"
            placeholder="Search by company, email, phone, Dynamics ID…"
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
          >
            <SelectTrigger className="md:col-span-4">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {KYC_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Joined date range</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={joinedStart}
                onChange={(e) => {
                  setPage(1);
                  setJoinedStart(e.target.value);
                }}
              />
              <Input
                type="date"
                value={joinedEnd}
                onChange={(e) => {
                  setPage(1);
                  setJoinedEnd(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Order date range</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={orderStart}
                onChange={(e) => {
                  setPage(1);
                  setOrderStart(e.target.value);
                }}
              />
              <Input
                type="date"
                value={orderEnd}
                onChange={(e) => {
                  setPage(1);
                  setOrderEnd(e.target.value);
                }}
              />
            </div>
          </div>
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
                <TableHead>Company</TableHead>
                <TableHead>Dynamics ID</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>CAC</TableHead>
                <TableHead>Utility</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No KYC submissions match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.companyName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.dynamicsId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(c.dateCreated)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastOrderDate ? formatDate(c.lastOrderDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!c.cac_FileName}
                        onClick={() =>
                          c.cac_FileName &&
                          setImageTarget({
                            title: "CAC file",
                            url: c.cac_FileName,
                            company: c.companyName ?? "",
                          })
                        }
                      >
                        <FileText className="h-4 w-4" />
                        {c.cac_FileName ? "View" : "—"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!c.utility_FileName}
                        onClick={() =>
                          c.utility_FileName &&
                          setImageTarget({
                            title: "Utility bill",
                            url: c.utility_FileName,
                            company: c.companyName ?? "",
                          })
                        }
                      >
                        <FileText className="h-4 w-4" />
                        {c.utility_FileName ? "View" : "—"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.userStatus] ?? "default"}>
                        {c.userStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setReviewTarget(c)}
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

      <ImageViewerModal
        open={!!imageTarget}
        onOpenChange={(v) => !v && setImageTarget(null)}
        title={imageTarget?.title ?? ""}
        subtitle={imageTarget?.company}
        url={imageTarget?.url}
      />

      <KycReviewModal
        customer={reviewTarget}
        open={!!reviewTarget}
        onOpenChange={(v) => !v && setReviewTarget(null)}
        onApprove={handleApprove}
        onRejectCac={rejectCac}
        onRejectUtility={rejectUtility}
      />

      <DynamicsAccountModal
        customer={dynamicsTarget}
        open={!!dynamicsTarget}
        onOpenChange={(v) => !v && setDynamicsTarget(null)}
        onApproved={() => {
          setReviewTarget(null);
          refetch();
        }}
      />
    </div>
  );
}
