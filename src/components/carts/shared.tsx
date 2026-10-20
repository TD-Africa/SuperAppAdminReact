import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Checkbox, Input, Modal, Tooltip, Typography } from "antd";
import { apiGet } from "@/lib/api";
import type { LocationReturnDTO } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/** Same cache key as the Deals/Promos pages, so the list is fetched once. */
export function useLocations() {
  return useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load locations");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function StatTile({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "danger" | "warning";
  onClick?: () => void;
}) {
  const color =
    tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "";
  const body = (
    <Card
      size="small"
      hoverable={!!onClick}
      onClick={onClick}
      className={onClick ? "cursor-pointer" : undefined}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </Card>
  );
  return hint ? <Tooltip title={hint}>{body}</Tooltip> : body;
}

/** Product name with SKU and the variant's colour/config underneath. */
export function VariantCell({
  productName,
  sku,
  colorId,
  configId,
}: {
  productName: string | null;
  sku: string | null;
  colorId: string | null;
  configId: string | null;
}) {
  const variant = [colorId, configId].filter(Boolean).join(" · ");
  return (
    <div>
      <div className="font-medium">{productName || "—"}</div>
      <div className="text-xs text-muted-foreground">
        {sku || "—"}
        {variant && ` · ${variant}`}
      </div>
    </div>
  );
}

export function CustomerCell({
  companyName,
  customerName,
  email,
  customerId,
}: {
  companyName: string | null;
  customerName?: string | null;
  email: string | null;
  customerId?: string | null;
}) {
  return (
    <div>
      <div className="font-medium">{companyName || customerName || email || "—"}</div>
      <div className="text-xs text-muted-foreground">
        {[email, customerId].filter(Boolean).join(" · ") || "—"}
      </div>
    </div>
  );
}

/** "3d ago" / "5h ago", with the full timestamp on hover. */
export function Age({ at }: { at: string | null | undefined }) {
  if (!at) return <span className="text-muted-foreground">—</span>;
  const ms = Date.now() - new Date(at).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const label =
    hours < 1 ? "just now" : hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  return (
    <Tooltip title={formatDateTime(at)}>
      <span className="whitespace-nowrap">{label}</span>
    </Tooltip>
  );
}

export interface ReleaseDialogValues {
  reason: string;
  notifyCustomer: boolean;
}

/**
 * Confirms a release and collects the audit-log reason. `notifyOption` adds the
 * order-hold "email the customer" switch.
 */
export function ReleaseDialog({
  open,
  title,
  description,
  confirmLabel = "Release",
  notifyOption = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  notifyOption?: boolean;
  onCancel: () => void;
  onConfirm: (values: ReleaseDialogValues) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setNotifyCustomer(true);
    }
  }, [open]);

  async function handleOk() {
    setLoading(true);
    try {
      await onConfirm({ reason: reason.trim(), notifyCustomer });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onOk={handleOk}
      onCancel={onCancel}
      okText={confirmLabel}
      okButtonProps={{ danger: true, disabled: !reason.trim() }}
      confirmLoading={loading}
      destroyOnHidden
    >
      <div className="space-y-4">
        <Typography.Paragraph className="!mb-0">{description}</Typography.Paragraph>
        <div>
          <div className="mb-1 text-sm font-medium">Reason (kept on the audit log)</div>
          <Input.TextArea
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Stock needed for a confirmed order"
          />
        </div>
        {notifyOption && (
          <Checkbox
            checked={notifyCustomer}
            onChange={(e) => setNotifyCustomer(e.target.checked)}
          >
            Email the customer that their order was cancelled
          </Checkbox>
        )}
      </div>
    </Modal>
  );
}
