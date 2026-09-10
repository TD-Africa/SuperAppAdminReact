import type { OrderReturnDto } from "@/lib/types";

/**
 * Mirror of TDSuperApp.Data.Models.OrderStatus. These are the seeded row IDs, so
 * they are stable across environments and safe to compare against.
 *
 * "Partially Paid" was added by migration 20260830025659_OrderStatusAddition. It
 * sits between Unpaid and Completed: money has arrived, a balance remains.
 */
export const OrderStatusId = {
  Pending: "7cd0a3c2-6a49-4532-a07e-ce6377fe3e23",
  Completed: "473ff36e-372a-4db7-801b-f374c27fa230",
  Unpaid: "f6f3bcc3-cf4d-4842-9913-578c52a131a3",
  Failed: "0396eb37-905c-4e9a-8497-948e3d1132d9",
  Cancelled: "1fdb4deb-6728-4c10-9b4f-d52e2c29e1fd",
  InProgress: "e2bc8b16-a3f0-4a03-ac7e-312e401aa966",
  Shipped: "a3f5e6d7-8b9c-4d0e-9f1a-2b3c4d5e6f7f",
  Approved: "b4c5d6e7-f8a9-40ab-9c3d-4e5f6a7b8c9d",
  PartiallyPaid: "c9e1a4b6-7d38-4f52-a0c7-8e2b5d1f6a93",
} as const;

const STATUS_COLORS: Record<string, string> = {
  [OrderStatusId.Completed]: "success",
  [OrderStatusId.Approved]: "success",
  [OrderStatusId.PartiallyPaid]: "orange",
  [OrderStatusId.Unpaid]: "error",
  [OrderStatusId.Failed]: "error",
  [OrderStatusId.InProgress]: "processing",
  [OrderStatusId.Shipped]: "blue",
  [OrderStatusId.Pending]: "default",
  [OrderStatusId.Cancelled]: "default",
};

/** Tag colour for an order status row. Unknown/new statuses fall back to grey. */
export function orderStatusColor(statusId: string | null | undefined) {
  if (!statusId) return "default";
  return STATUS_COLORS[statusId.toLowerCase()] ?? "default";
}

export type PaymentState = "paid" | "partial" | "unpaid";

/**
 * Three-way payment state for an order.
 *
 * `isFullyPaid` is the only payment boolean the API exposes — the backend's
 * `Order.IsPaid` ("any money at all") is not on OrderReturnDto — so partial is
 * detected from the status row, with amountPaid as a backstop. The backstop
 * matters: the webhook only promotes Unpaid -> PartiallyPaid, deliberately
 * leaving an admin-set status alone, so a part-paid order can sit on some other
 * status with money already received against it.
 */
export function paymentState(order: OrderReturnDto): PaymentState {
  if (order.isFullyPaid) return "paid";
  const isPartialStatus =
    order.orderStatus?.id?.toLowerCase() === OrderStatusId.PartiallyPaid;
  if (isPartialStatus || order.amountPaid > 0) return "partial";
  return "unpaid";
}

/**
 * What the order was charged, per currency, in that currency's own units.
 *
 * settled + due is the backend's own `Σ LineTotal*` (see
 * OrderService.ApplySettlementTotals), which multiplies by PaidQuantity. Prefer
 * it over `amountInNaira × quantity`: that formula bills BOGO free units and is
 * the exact mismatch OrderTotals was extracted to stop.
 *
 * Caveat: this is the gross invoiced figure. Order-level CAC and general
 * discounts are not exposed on the DTO, so a discounted order reads high here.
 */
export function chargedTotal(order: OrderReturnDto, currency: "NGN" | "USD") {
  return currency === "NGN"
    ? order.amountSettledInNaira + order.amountDueInNaira
    : order.amountSettledInDollar + order.amountDueInDollar;
}

/** Backend OrderTotals.Tolerance — two amounts within half a kobo are equal. */
export const MONEY_TOLERANCE = 0.005;

export interface PaymentSummary {
  state: PaymentState;
  /** Order-level receipts, in naira. */
  received: number;
  /** Gross invoiced total, in naira. */
  charged: number;
  /**
   * Share received, as a percentage. Null when there is no charged total to
   * divide by — a dollar-priced order carries its total on the USD side while
   * receipts are always naira, so no meaningful ratio exists.
   *
   * NOT clamped to 100: an overpayment is real and should be visible rather
   * than rounded away into looking settled.
   */
  percent: number | null;
}

/**
 * The order's payment position as money rather than a label.
 *
 * Deliberately avoids the OrderStatus vocabulary. The status column already
 * carries Unpaid / Partially Paid / Approved / Completed, so restating payment
 * as a word there put two near-identical orange tags side by side. Amount and
 * proportion are what the status row structurally cannot express.
 */
export function paymentSummary(order: OrderReturnDto): PaymentSummary {
  const charged = chargedTotal(order, "NGN");
  const received = order.amountPaid;
  return {
    state: paymentState(order),
    received,
    charged,
    percent: charged > MONEY_TOLERANCE ? (received / charged) * 100 : null,
  };
}

/** Rounds for display without letting a real payment read as 0%. */
export function formatPercent(percent: number) {
  if (percent > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}

/**
 * Whether the per-invoice settlement split contradicts the order-level flags.
 *
 * OrderService.ApplySettlementTotals reads `group.First().AmountPaid` as the
 * payment for a whole group, per the convention that TdDynamicsService writes
 * the group total onto every line of the group. An order whose lines instead
 * carry their own per-line amount breaks that read: the first line's payment
 * becomes "settled" and every other line's payment is reported as outstanding.
 *
 * Symptom is a fully-paid order showing a large balance due. The order-level
 * `isFullyPaid` / `amountPaid` pair is the trustworthy one, so callers should
 * defer to it and flag the disagreement rather than print the false balance.
 *
 * Note `chargedTotal` is immune — settled + due telescopes back to the line
 * total whichever way the split landed.
 */
export function hasSettlementDiscrepancy(order: OrderReturnDto) {
  if (!order.isFullyPaid) return false;
  return (
    order.amountDueInNaira > MONEY_TOLERANCE ||
    order.amountDueInDollar > MONEY_TOLERANCE
  );
}
