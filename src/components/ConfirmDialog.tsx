import { useState } from "react";
import { Modal } from "antd";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    try {
      setLoading(true);
      await onConfirm();
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
      okButtonProps={destructive ? { danger: true } : undefined}
      destroyOnClose
    >
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </Modal>
  );
}
