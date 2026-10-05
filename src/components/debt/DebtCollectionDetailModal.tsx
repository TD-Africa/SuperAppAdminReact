import { useState, type ReactNode } from "react";
import {
  Modal,
  Button,
  Tag,
  Progress,
  Tooltip,
  Typography,
  theme,
  App as AntdApp,
} from "antd";
import {
  BellOutlined,
  FileSearchOutlined,
  MailOutlined,
  NumberOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { apiPost } from "@/lib/api";
import type { AlmostDueOrderResponse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

interface Props {
  order: AlmostDueOrderResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: () => void;
}

type Urgency = "overdue" | "soon" | "upcoming";

function urgencyOf(daysUntilDue: number): Urgency {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= 3) return "soon";
  return "upcoming";
}

function dueLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const n = Math.abs(daysUntilDue);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (daysUntilDue === 0) return "Due today";
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="break-words text-sm">{children}</div>
      </div>
    </div>
  );
}

// Both actions debit the customer's wallet. Trigger is the scheduled job run on
// demand: the server only collects when the order is flagged due and still
// outstanding, and otherwise answers status=true, data=false having done nothing.
// Force skips that due check (it still refuses fully-paid orders).
export function DebtCollectionDetailModal({
  order,
  open,
  onOpenChange,
  onActionComplete,
}: Props) {
  const { message } = AntdApp.useApp();
  const { token } = theme.useToken();
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [confirmForceOpen, setConfirmForceOpen] = useState(false);
  const [fullOrderOpen, setFullOrderOpen] = useState(false);

  async function triggerCollection() {
    if (!order) return;
    setTriggerLoading(true);
    const res = await apiPost<boolean>(
      `DebtCollection/TriggerDebtCollection/${order.orderId}`,
      {},
    );
    setTriggerLoading(false);
    if (!res.status) {
      message.error(res.message ?? "Failed to collect payment");
      return;
    }
    if (res.data === false) {
      message.info(
        "Nothing collected — this order isn't eligible yet. Use Force collection to collect before it's due.",
      );
      return;
    }
    message.success(res.message ?? "Collection run complete");
    onActionComplete?.();
    onOpenChange(false);
  }

  async function forceCollection() {
    if (!order) return;
    const res = await apiPost<boolean>(
      `DebtCollection/ForceDebtCollection/${order.orderId}/force`,
      {},
    );
    if (res.status) {
      message.success(res.message ?? "Forced collection complete");
      onActionComplete?.();
      onOpenChange(false);
    } else {
      message.error(res.message ?? "Failed to force collection");
    }
  }

  const urgency = order ? urgencyOf(order.daysUntilDue) : "upcoming";
  const urgencyStyle = {
    overdue: {
      background: token.colorErrorBg,
      borderColor: token.colorErrorBorder,
      accent: token.colorError,
    },
    soon: {
      background: token.colorWarningBg,
      borderColor: token.colorWarningBorder,
      accent: token.colorWarning,
    },
    upcoming: {
      background: token.colorFillQuaternary,
      borderColor: token.colorBorderSecondary,
      accent: token.colorTextSecondary,
    },
  }[urgency];

  const paidPercent =
    order && order.totalAmount > 0
      ? Math.min(100, Math.round((order.amountPaid / order.totalAmount) * 100))
      : 0;

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        width={720}
        destroyOnClose
        title={
          order && (
            <div className="pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">
                  {order.orderReference}
                </span>
                <Tag className="!m-0">{order.orderStatus}</Tag>
                <Tag className="!m-0" color="default">
                  {order.paymentMethod}
                </Tag>
              </div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {order.companyName ?? "Unknown company"} · ordered{" "}
                {formatDate(order.orderDate)}
              </div>
            </div>
          )
        }
        footer={
          order && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="text"
                icon={<FileSearchOutlined />}
                onClick={() => setFullOrderOpen(true)}
              >
                View full order
              </Button>
              <div className="flex flex-wrap gap-2">
                <Tooltip title="Debits the wallet now, even if the order isn't due yet.">
                  <Button
                    danger
                    icon={<ThunderboltOutlined />}
                    onClick={() => setConfirmForceOpen(true)}
                  >
                    Force collection
                  </Button>
                </Tooltip>
                <Tooltip
                  title={
                    order.isDue
                      ? "Runs the scheduled collection for this order now."
                      : "This order isn't flagged as due, so collecting now won't take any money. Use Force collection instead."
                  }
                >
                  <Button
                    type="primary"
                    icon={<WalletOutlined />}
                    loading={triggerLoading}
                    onClick={triggerCollection}
                  >
                    Collect from wallet
                  </Button>
                </Tooltip>
              </div>
            </div>
          )
        }
      >
        {order && (
          <div className="space-y-5 pt-2">
            {/* Balance + due status */}
            <div
              className="rounded-lg border p-4"
              style={{
                background: urgencyStyle.background,
                borderColor: urgencyStyle.borderColor,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Outstanding
                  </div>
                  <div
                    className="text-3xl font-semibold tabular-nums"
                    style={{ color: token.colorPrimary }}
                  >
                    {formatCurrency(order.amountDue, "NGN")}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-base font-semibold"
                    style={{ color: urgencyStyle.accent }}
                  >
                    {dueLabel(order.daysUntilDue)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.dueDate ? formatDate(order.dueDate) : "No due date"}
                  </div>
                  {order.isDue && (
                    <Tag color="error" className="!m-0 !mt-1">
                      Flagged for collection
                    </Tag>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Progress
                  percent={paidPercent}
                  showInfo={false}
                  strokeColor={token.colorSuccess}
                  size="small"
                />
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground tabular-nums">
                      {formatCurrency(order.amountPaid, "NGN")}
                    </span>{" "}
                    paid ({paidPercent}%)
                  </span>
                  <span>
                    of{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatCurrency(order.totalAmount, "NGN")}
                    </span>{" "}
                    total
                  </span>
                </div>
              </div>
            </div>

            {/* Customer + collection history */}
            <div className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <Typography.Text strong>Customer</Typography.Text>
                <div className="divide-y divide-border">
                  <DetailRow icon={<UserOutlined />} label="Name">
                    {order.userName ?? "—"}
                  </DetailRow>
                  <DetailRow icon={<MailOutlined />} label="Email">
                    {order.userEmail ? (
                      <a href={`mailto:${order.userEmail}`}>{order.userEmail}</a>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <Typography.Text strong>Collection</Typography.Text>
                <div className="divide-y divide-border">
                  <DetailRow icon={<BellOutlined />} label="Reminders sent">
                    {order.reminderCount}
                  </DetailRow>
                  <DetailRow icon={<NumberOutlined />} label="Order ID">
                    <Typography.Text
                      copyable
                      className="font-mono !text-xs"
                    >
                      {order.orderId}
                    </Typography.Text>
                  </DetailRow>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmForceOpen}
        onOpenChange={setConfirmForceOpen}
        title="Force collection?"
        description={
          order
            ? `This debits up to ${formatCurrency(order.amountDue, "NGN")} from ${order.companyName ?? "the customer"}'s wallet now, without waiting for the due date.`
            : undefined
        }
        confirmLabel="Force collection"
        destructive
        onConfirm={forceCollection}
      />

      <OrderDetailModal
        orderId={order?.orderId ?? null}
        open={fullOrderOpen}
        onOpenChange={setFullOrderOpen}
        onUpdated={onActionComplete}
      />
    </>
  );
}
