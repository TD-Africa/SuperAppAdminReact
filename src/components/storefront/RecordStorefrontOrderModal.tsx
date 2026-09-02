import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  App as AntdApp,
} from "antd";
import { apiGet } from "@/lib/api";
import type { DeliveryMethodReturnDTO } from "@/lib/types";
import {
  createStorefrontOrder,
  createStorefrontSettlementOrder,
} from "@/lib/storefrontApi";
import type { StorefrontPaidOrderRequest } from "@/lib/storefrontTypes";

interface Props {
  open: boolean;
  ownerId: string;
  mode: "order" | "settlement";
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RecordStorefrontOrderModal({
  open,
  ownerId,
  mode,
  onOpenChange,
  onSuccess,
}: Props) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<StorefrontPaidOrderRequest>();

  const { data: deliveryMethods } = useQuery({
    queryKey: ["delivery-methods"],
    queryFn: async () => {
      const res = await apiGet<DeliveryMethodReturnDTO[]>(
        "Component/GetDeliveryMethods",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load delivery methods");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        storefrontOwnerId: ownerId,
        currency: "NGN",
        fees: 0,
      });
    }
  }, [open, ownerId, form]);

  async function handleOk() {
    try {
      const values = await form.validateFields();
      const fn =
        mode === "settlement"
          ? createStorefrontSettlementOrder
          : createStorefrontOrder;
      const res = await fn(values);
      if (!res.status) {
        message.error(res.message ?? "Failed to record order");
        return;
      }
      message.success(
        mode === "settlement"
          ? "Settlement order recorded"
          : "Storefront order recorded",
      );
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // validation
    }
  }

  return (
    <Modal
      open={open}
      title={mode === "settlement" ? "Record settlement order" : "Record storefront order"}
      onCancel={() => onOpenChange(false)}
      onOk={handleOk}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item name="storefrontOwnerId" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name="externalOrderId"
          label="External order ID"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="paymentReference"
          label="Payment reference"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
          <Form.Item name="amountPaid" label="Amount paid">
            <InputNumber className="!w-full" min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="fees" label="Fees">
            <InputNumber className="!w-full" min={0} precision={2} />
          </Form.Item>
        </div>
        <Form.Item
          name="currency"
          label="Currency"
          rules={[{ required: true, len: 3 }]}
        >
          <Input maxLength={3} />
        </Form.Item>
        <Form.Item
          name="deliveryMethodId"
          label="Delivery method"
          rules={[{ required: true, message: "Select a delivery method" }]}
        >
          <Select
            placeholder="Select delivery method"
            options={(deliveryMethods ?? []).map((m) => ({
              value: m.id,
              label: m.method ?? m.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="name" label="Customer name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="phoneNumber"
          label="Phone"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email">
          <Input type="email" />
        </Form.Item>
        <Form.Item name="deliveryAddress" label="Delivery address">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
