import { useEffect } from "react";
import { Modal, Form, Input, InputNumber, App as AntdApp } from "antd";

export interface WalletAdjustmentValues {
  amount: number;
  reference: string;
  description: string;
}

interface Props {
  open: boolean;
  mode: "credit" | "debit";
  title?: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WalletAdjustmentValues) => Promise<boolean>;
}

export function WalletAdjustmentModal({
  open,
  mode,
  title,
  loading,
  onOpenChange,
  onSubmit,
}: Props) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<WalletAdjustmentValues>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  async function handleOk() {
    try {
      const values = await form.validateFields();
      const ok = await onSubmit(values);
      if (ok) {
        message.success(
          mode === "credit" ? "Wallet credited" : "Wallet debited",
        );
        onOpenChange(false);
      }
    } catch {
      // validation
    }
  }

  return (
    <Modal
      open={open}
      title={title ?? (mode === "credit" ? "Credit wallet" : "Debit wallet")}
      okText={mode === "credit" ? "Credit" : "Debit"}
      okButtonProps={{ danger: mode === "debit" }}
      confirmLoading={loading}
      onCancel={() => onOpenChange(false)}
      onOk={handleOk}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="amount"
          label="Amount"
          rules={[
            { required: true, message: "Amount is required" },
            { type: "number", min: 0.01, message: "Minimum amount is 0.01" },
          ]}
        >
          <InputNumber className="!w-full" min={0.01} precision={2} />
        </Form.Item>
        <Form.Item
          name="reference"
          label="Reference"
          rules={[
            { required: true, message: "Reference is required" },
            { min: 3, message: "At least 3 characters" },
          ]}
        >
          <Input placeholder="Unique reference" maxLength={250} />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
          rules={[
            { required: true, message: "Description is required" },
            { min: 3, message: "At least 3 characters" },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} placeholder="Reason for adjustment" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
