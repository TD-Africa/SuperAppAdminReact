import { useEffect, useState } from "react";
import { Alert, App as AntdApp, Checkbox, Input, Modal, Space, Typography } from "antd";
import { apiPost } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

// Body of Order/CancelOrder (AdminCancelOrderRequest).
interface AdminCancelOrderRequest {
  reason: string;
  notifyCustomer: boolean;
  cancelledInD365: boolean;
  cardRefundHandled: boolean;
}

// What Order/CancelOrder did (AdminCancelOrderResponse).
export interface AdminCancelOrderResponse {
  orderId: string;
  orderReference: string | null;
  previousStatus: string | null;
  lines: number;
  units: number;
  /** False: the stock syncs weren't holding the units, so the next sync returns them. */
  stockReturnedNow: boolean;
  walletPaid: number;
  cardPaid: number;
  /** Null when nothing was paid from the wallet. */
  walletBalanceAfter: number | null;
  walletNote: string | null;
  couponReleased: boolean;
  customerNotified: boolean;
}

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The order has a D365 sales order; the server refuses without cancelledInD365. */
  postedToDynamics: boolean;
  salesIds: string[];
  /** Money received on the order. The DTO doesn't say wallet vs card, so this only decides whether to ask. */
  amountPaid: number;
  onCancelled: (result: AdminCancelOrderResponse) => void;
}

export function CancelOrderModal({
  orderId,
  open,
  onOpenChange,
  postedToDynamics,
  salesIds,
  amountPaid,
  onCancelled,
}: Props) {
  const { message } = AntdApp.useApp();
  const [reason, setReason] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [cancelledInD365, setCancelledInD365] = useState(false);
  const [cardRefundHandled, setCardRefundHandled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNotifyCustomer(true);
    setCancelledInD365(false);
    setCardRefundHandled(false);
    setError(null);
  }, [open]);

  const hasPayments = amountPaid > 0;
  const canSubmit =
    reason.trim().length > 0 && (!postedToDynamics || cancelledInD365);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: AdminCancelOrderRequest = {
        reason: reason.trim(),
        notifyCustomer,
        cancelledInD365,
        cardRefundHandled,
      };
      const res = await apiPost<AdminCancelOrderResponse>(
        `Order/CancelOrder/${orderId}`,
        body,
      );
      if (!res.status || !res.data) {
        // The server's refusals (card paid, in D365, in fulfilment) say what to
        // do next, so keep them on screen rather than in a fleeting toast.
        setError(res.message ?? "Cancelling the order failed");
        return;
      }
      message.success(res.message ?? "Order cancelled");
      onCancelled(res.data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Cancel this order?"
      onCancel={() => onOpenChange(false)}
      onOk={handleSubmit}
      okText="Cancel order"
      cancelText="Keep order"
      okButtonProps={{ danger: true, disabled: !canSubmit }}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Space direction="vertical" size={12} className="w-full">
        <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
          Every line is cancelled and the coupon, if any, is released. Wallet
          money goes back to the customer's wallet; stock goes back now if it
          was being held, otherwise at the next stock sync.
        </Typography.Paragraph>

        <div>
          <Typography.Text strong>Reason</Typography.Text>
          <Input.TextArea
            className="!mt-1"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Kept on the audit log"
          />
        </div>

        {postedToDynamics && (
          <Alert
            type="warning"
            showIcon
            message={`This order is in D365 (${salesIds.join(", ") || "posted"})`}
            description={
              <Checkbox
                checked={cancelledInD365}
                onChange={(e) => setCancelledInD365(e.target.checked)}
              >
                I've cancelled its sales order in D365
              </Checkbox>
            }
          />
        )}

        {hasPayments && (
          <Alert
            type="info"
            showIcon
            message={`${formatCurrency(amountPaid, "NGN")} has been received on this order`}
            description={
              <Checkbox
                checked={cardRefundHandled}
                onChange={(e) => setCardRefundHandled(e.target.checked)}
              >
                Any card payment has been refunded in Paystack (wallet money
                needs no refund)
              </Checkbox>
            }
          />
        )}

        <Checkbox
          checked={notifyCustomer}
          onChange={(e) => setNotifyCustomer(e.target.checked)}
        >
          Email the customer
        </Checkbox>

        {error && <Alert type="error" showIcon message={error} />}
      </Space>
    </Modal>
  );
}
