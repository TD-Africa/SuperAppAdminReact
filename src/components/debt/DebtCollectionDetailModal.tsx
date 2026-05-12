import { useState } from "react";
import {
  Modal,
  Button,
  Descriptions,
  Tag,
  App as AntdApp,
} from "antd";
import { apiPost } from "@/lib/api";
import type { AlmostDueOrderResponse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Props {
  order: AlmostDueOrderResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: () => void;
}

export function DebtCollectionDetailModal({
  order,
  open,
  onOpenChange,
  onActionComplete,
}: Props) {
  const { message } = AntdApp.useApp();
  const [forceLoading, setForceLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);

  async function forceCollection() {
    if (!order) return;
    setForceLoading(true);
    const res = await apiPost<boolean>(
      `DebtCollection/ForceDebtCollection/${order.orderId}/force`,
      {},
    );
    setForceLoading(false);
    if (res.status) {
      message.success(res.message ?? "Force debt collection initiated");
      onActionComplete?.();
      onOpenChange(false);
    } else {
      message.error(res.message ?? "Failed to force debt collection");
    }
  }

  async function triggerCollection() {
    if (!order) return;
    setTriggerLoading(true);
    const res = await apiPost<boolean>(
      `DebtCollection/TriggerDebtCollection/${order.orderId}`,
      {},
    );
    setTriggerLoading(false);
    if (res.status) {
      message.success(res.message ?? "Trigger debt collection initiated");
      onActionComplete?.();
      onOpenChange(false);
    } else {
      message.error(res.message ?? "Failed to trigger debt collection");
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={`Debt Collection — ${order?.orderReference ?? "Order"}`}
      width={760}
      footer={[
        <Button
          key="force"
          danger
          loading={forceLoading}
          onClick={forceCollection}
        >
          Force debt collection
        </Button>,
        <Button
          key="trigger"
          type="default"
          loading={triggerLoading}
          onClick={triggerCollection}
        >
          Trigger debt collection
        </Button>,
        <Button key="close" type="primary" onClick={() => onOpenChange(false)}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      {order && (
        <Descriptions
          column={{ xs: 1, sm: 2 }}
          size="small"
          colon={false}
          bordered
        >
          <Descriptions.Item label="Order ID" span={2}>
            <span className="font-mono text-xs">{order.orderId}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Order reference">
            {order.orderReference}
          </Descriptions.Item>
          <Descriptions.Item label="Order status">
            <Tag>{order.orderStatus}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="User name">
            {order.userName ?? "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="User email">
            {order.userEmail ?? "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Company" span={2}>
            {order.companyName ?? "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Total amount (₦)">
            {formatCurrency(order.totalAmount, "NGN")}
          </Descriptions.Item>
          <Descriptions.Item label="Amount paid (₦)">
            {formatCurrency(order.amountPaid, "NGN")}
          </Descriptions.Item>
          <Descriptions.Item label="Amount due (₦)">
            <span className="font-semibold text-destructive">
              {formatCurrency(order.amountDue, "NGN")}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Payment method">
            {order.paymentMethod}
          </Descriptions.Item>
          <Descriptions.Item label="Order date">
            {formatDate(order.orderDate)}
          </Descriptions.Item>
          <Descriptions.Item label="Due date">
            {order.dueDate ? formatDate(order.dueDate) : "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Days until due">
            <Tag color={order.daysUntilDue < 0 ? "error" : "default"}>
              {order.daysUntilDue}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Is due">
            {order.isDue ? (
              <Tag color="error">Yes</Tag>
            ) : (
              <Tag color="success">No</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Reminder count" span={2}>
            {order.reminderCount}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
