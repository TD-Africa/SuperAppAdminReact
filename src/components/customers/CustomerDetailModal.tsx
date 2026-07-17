import { useState } from "react";
import type { ReactNode } from "react";
import { Modal, Tag, Button, Typography } from "antd";
import { FileTextOutlined, ShopOutlined } from "@ant-design/icons";
import type { CustomerResponse, UserStatus } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";
import { ImageViewerModal } from "@/components/ImageViewerModal";

interface CustomerDetailModalProps {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColor: Record<UserStatus, "success" | "warning" | "error" | "default"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "error",
  Rejected: "error",
  Incomplete: "default",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

function formatAmount(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function BalanceTile({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const hasValue = value != null && !Number.isNaN(value);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40 p-3">
      <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
        {hasValue && (
          <span className="text-[11px] font-medium text-muted-foreground">
            NGN
          </span>
        )}
        <span className="text-base font-semibold leading-tight tabular-nums text-foreground">
          {formatAmount(value)}
        </span>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function yesNo(v: boolean | null | undefined) {
  return v ? <Tag color="success">Yes</Tag> : <Tag>No</Tag>;
}

export function CustomerDetailModal({
  customer,
  open,
  onOpenChange,
}: CustomerDetailModalProps) {
  const [doc, setDoc] = useState<{ title: string; url: string } | null>(null);

  const c = customer;
  const fullName = c
    ? [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"
    : "—";
  const displayName = c?.companyName || fullName;
  const address =
    c &&
    [c.addressLine, c.street, c.city, c.state, c.country]
      .filter(Boolean)
      .join(", ");

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        width={780}
        destroyOnClose
        title={null}
        styles={{ body: { paddingTop: 8 } }}
        footer={[
          <Button key="close" type="primary" onClick={() => onOpenChange(false)}>
            Close
          </Button>,
        ]}
      >
        {c && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold leading-tight">
                  {displayName}
                </div>
                {c.email && (
                  <div className="truncate text-sm text-muted-foreground">
                    {c.email}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Tag color={statusColor[c.userStatus] ?? "default"}>
                    {c.userStatus}
                  </Tag>
                  {c.userType && <Tag>{c.userType}</Tag>}
                  {c.isSuspended && <Tag color="error">Suspended</Tag>}
                </div>
              </div>
            </div>

            {/* Balances */}
            <div>
              <SectionLabel>Balances</SectionLabel>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <BalanceTile label="Wallet" value={c.walletBalance} />
                <BalanceTile label="Credit balance" value={c.creditBalance} />
                <BalanceTile label="Credit limit" value={c.creditLimit} />
                <BalanceTile label="Customer balance" value={c.customerBalance} />
              </div>
            </div>

            {/* Contact */}
            <div>
              <SectionLabel>Contact</SectionLabel>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Full name" value={fullName} />
                <Field label="Username" value={c.userName} />
                <Field label="Phone" value={c.phoneNumber} />
                <Field
                  label="Dynamics ID"
                  value={
                    c.dynamicsId ?? <Tag color="warning">Not linked</Tag>
                  }
                />
                <div className="sm:col-span-2">
                  <Field label="Address" value={address || "—"} />
                </div>
              </div>
            </div>

            {/* Account */}
            <div>
              <SectionLabel>Account &amp; credit</SectionLabel>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Field label="Credit days" value={c.creditDays} />
                <Field
                  label="Credit transactions"
                  value={yesNo(c.isCreditTransactionEnabled)}
                />
                <Field
                  label="Existing partner"
                  value={yesNo(c.isExistingPartner)}
                />
              </div>
            </div>

            {/* Orders */}
            <div>
              <SectionLabel>Orders</SectionLabel>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  label="Total orders"
                  value={formatNumber(c.numberOfOrders ?? c.totalOrders ?? 0)}
                />
                <StatTile
                  label="Pending"
                  value={formatNumber(c.pendingOrders ?? 0)}
                />
                <StatTile
                  label="Joined"
                  value={
                    <span className="text-sm font-medium">
                      {c.dateCreated ? formatDate(c.dateCreated) : "—"}
                    </span>
                  }
                />
                <StatTile
                  label="Last order"
                  value={
                    <span className="text-sm font-medium">
                      {c.lastOrderDate ? formatDate(c.lastOrderDate) : "—"}
                    </span>
                  }
                />
              </div>
            </div>

            {/* Warehouses */}
            <div>
              <SectionLabel>Warehouses</SectionLabel>
              {c.userWarehouses && c.userWarehouses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.userWarehouses.map((w) => (
                    <Tag key={w.id} icon={<ShopOutlined />}>
                      {w.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary" className="text-sm">
                  No warehouses assigned.
                </Typography.Text>
              )}
            </div>

            {/* Documents */}
            <div>
              <SectionLabel>Documents</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <Button
                  icon={<FileTextOutlined />}
                  disabled={!c.cac_FileName}
                  onClick={() =>
                    c.cac_FileName &&
                    setDoc({ title: "CAC document", url: c.cac_FileName })
                  }
                >
                  {c.cac_FileName ? "View CAC document" : "No CAC document"}
                </Button>
                <Button
                  icon={<FileTextOutlined />}
                  disabled={!c.utility_FileName}
                  onClick={() =>
                    c.utility_FileName &&
                    setDoc({ title: "Utility bill", url: c.utility_FileName })
                  }
                >
                  {c.utility_FileName ? "View utility bill" : "No utility bill"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ImageViewerModal
        open={!!doc}
        onOpenChange={(v) => !v && setDoc(null)}
        title={doc?.title ?? ""}
        subtitle={c?.companyName ?? undefined}
        url={doc?.url}
      />
    </>
  );
}
