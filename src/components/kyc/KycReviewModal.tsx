import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, ImageOff, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PromptDialog } from "@/components/PromptDialog";
import type { CustomerResponse } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";

interface Props {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (customer: CustomerResponse) => void;
  onRejectCac: (customer: CustomerResponse, reason: string) => Promise<void>;
  onRejectUtility: (customer: CustomerResponse, reason: string) => Promise<void>;
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

function isImage(url: string | null | undefined) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return IMAGE_EXTS.some((ext) => clean.endsWith(ext));
}

export function KycReviewModal({
  customer,
  open,
  onOpenChange,
  onApprove,
  onRejectCac,
  onRejectUtility,
}: Props) {
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));
  const [rejectCacOpen, setRejectCacOpen] = useState(false);
  const [rejectUtilityOpen, setRejectUtilityOpen] = useState(false);

  const canShowActions =
    customer?.userStatus === "Pending" || customer?.userStatus === "Active";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC documents</DialogTitle>
            <DialogDescription>
              {customer?.companyName ?? ""}
              {customer && (
                <Badge variant="outline" className="ml-2">
                  {customer.userStatus}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {customer && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DocumentPane
                  title="CAC file"
                  url={customer.cac_FileName}
                  showReject={canShowActions && canEdit}
                  rejectLabel="Reject CAC file"
                  onReject={() => setRejectCacOpen(true)}
                />
                <DocumentPane
                  title="Utility bill"
                  url={customer.utility_FileName}
                  showReject={canShowActions && canEdit}
                  rejectLabel="Reject utility bill"
                  onReject={() => setRejectUtilityOpen(true)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Company" value={customer.companyName ?? "—"} />
                <Field label="Email" value={customer.email ?? "—"} />
                <Field label="Phone" value={customer.phoneNumber ?? "—"} />
                <Field
                  label="Address"
                  value={
                    [
                      customer.addressLine,
                      customer.street,
                      customer.city,
                      customer.state,
                      customer.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {customer?.userStatus === "Pending" && canEdit && (
              <Button onClick={() => onApprove(customer)}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromptDialog
        open={rejectCacOpen}
        onOpenChange={setRejectCacOpen}
        title="Reject CAC file"
        description="Give the customer a reason so they can re-upload."
        label="Reason for rejection"
        placeholder="e.g. Document is blurry, expired…"
        confirmLabel="Reject"
        destructive
        onConfirm={async (reason) => {
          if (!customer) return;
          try {
            await onRejectCac(customer, reason);
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />

      <PromptDialog
        open={rejectUtilityOpen}
        onOpenChange={setRejectUtilityOpen}
        title="Reject utility bill"
        description="The customer will be prompted to upload a new bill."
        label="Reason for rejection"
        placeholder="e.g. Too old, wrong address…"
        confirmLabel="Reject"
        destructive
        onConfirm={async (reason) => {
          if (!customer) return;
          try {
            await onRejectUtility(customer, reason);
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
    </>
  );
}

function DocumentPane({
  title,
  url,
  showReject,
  rejectLabel,
  onReject,
}: {
  title: string;
  url: string | null;
  showReject: boolean;
  rejectLabel: string;
  onReject: () => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="font-medium">{title}</div>
        <div className="flex items-center gap-1">
          {url && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={url} target="_blank" rel="noreferrer" title="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {showReject && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={onReject}
            >
              <X className="h-4 w-4" /> {rejectLabel}
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-[400px] bg-muted">
        {!url ? (
          <div className="flex h-[500px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <span className="text-sm">No document on file</span>
          </div>
        ) : isImage(url) ? (
          <img
            src={url}
            alt={title}
            className="mx-auto max-h-[500px] w-auto object-contain"
          />
        ) : (
          <iframe src={url} title={title} className="h-[500px] w-full border-0" />
        )}
      </div>
    </div>
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
