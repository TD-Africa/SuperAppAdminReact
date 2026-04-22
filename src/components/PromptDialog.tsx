import { useEffect, useState } from "react";
import { Modal, Input, Form } from "antd";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  required?: boolean;
  initialValue?: string;
  onConfirm: (value: string) => void | Promise<void>;
}

export function PromptDialog({
  open,
  onOpenChange,
  title = "Enter a value",
  description,
  label = "Value",
  placeholder,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  required = true,
  initialValue = "",
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  async function handleConfirm() {
    if (required && !value.trim()) return;
    try {
      setLoading(true);
      await onConfirm(value.trim());
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onOk={handleConfirm}
      onCancel={() => onOpenChange(false)}
      confirmLoading={loading}
      okText={confirmLabel}
      cancelText={cancelLabel}
      okButtonProps={{
        danger: destructive,
        disabled: required && !value.trim(),
      }}
      destroyOnClose
    >
      {description && (
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      )}
      <Form layout="vertical">
        <Form.Item label={label} className="!mb-0">
          <Input.TextArea
            rows={3}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
