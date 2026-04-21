import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiGet, apiPost } from "@/lib/api";
import type { TicketResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseTicket: (ticketId: string) => Promise<void>;
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketDetailModal({
  ticketId,
  open,
  onOpenChange,
  onCloseTicket,
}: Props) {
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const res = await apiGet<TicketResponse>(`Ticket/GetTicket/${ticketId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load ticket");
      return res.data;
    },
    enabled: !!ticketId && open,
  });

  useEffect(() => {
    if (!open) {
      setMessage("");
    }
  }, [open]);

  async function addComment() {
    if (!data) return;
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Comment cannot be empty");
      return;
    }
    setPosting(true);
    const res = await apiPost<boolean>(`Ticket/AddComment/${data.id}`, {
      comment: trimmed,
    });
    setPosting(false);
    if (!res.status) {
      toast.error(res.message ?? "Failed to post comment");
      return;
    }
    setMessage("");
    refetch();
  }

  async function handleConfirmClose() {
    if (!data) return;
    await onCloseTicket(data.id);
    onOpenChange(false);
  }

  const statusVariant: Record<string, "success" | "warning" | "secondary"> = {
    Opened: "success",
    Pending: "warning",
    Closed: "secondary",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{data?.topic ?? "Ticket"}</DialogTitle>
            <DialogDescription>
              {data ? `#${data.id.slice(0, 8)}` : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant[data.status] ?? "default"}>
                  {data.status}
                </Badge>
                <Badge variant="outline">{data.category}</Badge>
                {data.isEscalated && <Badge variant="destructive">Escalated</Badge>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Company" value={data.user?.companyName ?? "—"} />
                <Field
                  label="Customer"
                  value={
                    [data.user?.firstName, data.user?.lastName]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }
                />
                <Field label="Opened" value={formatDateTime(data.dateOpened)} />
                <Field label="Closed" value={formatDateTime(data.dateClosed)} />
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Description
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {data.description}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Conversation ({data.comments?.length ?? 0})
                </h4>
                {!data.comments || data.comments.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No comments yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.comments.map((c) => (
                      <Card
                        key={c.id}
                        className={cn(
                          "border",
                          c.isAdmin && "border-primary/40 bg-primary/5",
                        )}
                      >
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {c.isAdmin ? (
                              <ShieldCheck className="h-4 w-4 text-primary" />
                            ) : null}
                            {c.isAdmin
                              ? "Admin"
                              : (data.user?.companyName ?? "Customer")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(c.dateCreated)}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="whitespace-pre-wrap text-sm">
                            {c.comment}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {data.status !== "Closed" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Add a new comment</div>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      maxLength={600}
                      placeholder="Type your response…"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{message.length} / 600</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={addComment} disabled={posting}>
                        {posting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquarePlus className="h-4 w-4" />
                        )}
                        Post comment
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setConfirmOpen(true)}
                      >
                        Close ticket
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Close this ticket?"
        description="The customer won't be able to add further comments."
        confirmLabel="Close ticket"
        destructive
        onConfirm={handleConfirmClose}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
