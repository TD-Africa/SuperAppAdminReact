import { useEffect, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Form,
  Input,
  InputNumber,
  Modal,
  Typography,
} from "antd";
import { apiPut } from "@/lib/api";
import type { ExchangeRateResponse, SetExchangeRateRequest } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

// A null `brandId` targets the platform base rate; a brand id targets that
// brand's override. Both hit the same request shape, so one modal serves both.
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string | null;
  brandName?: string | null;
  /** Rate currently in force for this target, shown for reference. */
  currentRate?: number | null;
  onSaved?: () => void;
}

interface FormValues {
  rate: number;
  reason?: string;
}

export function SetRateModal({
  open,
  onOpenChange,
  brandId,
  brandName,
  currentRate,
  onSaved,
}: Props) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  const isBase = brandId === null;

  // Reset first so validation errors from a previous open don't carry over, then
  // seed the rate in force as the starting point.
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ rate: currentRate ?? undefined, reason: "" });
    }
  }, [open, currentRate, form]);

  async function submit() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const body: SetExchangeRateRequest = {
      rate: values.rate,
      reason: values.reason?.trim() ? values.reason.trim() : null,
    };

    setSaving(true);
    const res = await apiPut<ExchangeRateResponse>(
      isBase
        ? "ExchangeRate/SetBaseRate/base"
        : `ExchangeRate/SetBrandRate/brand/${brandId}`,
      body,
    );
    setSaving(false);

    if (!res.status) {
      message.error(res.message ?? "Failed to save rate");
      return;
    }
    message.success(
      res.message ?? (isBase ? "Base rate updated" : "Brand rate updated"),
    );
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      title={isBase ? "Update base exchange rate" : `Set rate for ${brandName ?? "brand"}`}
      okText="Save rate"
      onOk={submit}
      onCancel={() => onOpenChange(false)}
      confirmLoading={saving}
      destroyOnClose
    >
      <div className="space-y-4 pt-2">
        <Alert
          type="info"
          showIcon
          message={
            isBase
              ? "Applies to every brand without its own override."
              : "Overrides the base rate for this brand only."
          }
          description={
            currentRate != null
              ? `Current rate in force: ₦${formatNumber(currentRate)} per $1.`
              : undefined
          }
        />

        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="rate"
            label="Rate (naira per $1)"
            rules={[
              { required: true, message: "Enter a rate" },
              {
                type: "number",
                min: 0.000001,
                message: "Rate must be greater than zero",
              },
            ]}
          >
            <InputNumber
              className="w-full"
              min={0}
              step={1}
              precision={2}
              prefix="₦"
              placeholder="e.g. 1650.00"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Reason"
            extra="Recorded on the rate history entry so the change can be traced later."
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Why is the rate changing?"
            />
          </Form.Item>
        </Form>

        <Typography.Text type="secondary" className="text-xs">
          Saving closes the rate currently in force and opens a new one from now.
        </Typography.Text>
      </div>
    </Modal>
  );
}
