import { useState } from "react";
import { App as AntdApp, Button, Space, Upload } from "antd";
import { DeleteOutlined, LoadingOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadStorefrontImage } from "@/lib/storefrontApi";

type Props = {
  value?: string | null;
  onChange?: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  maxBytes?: number;
  variant?: "logo" | "hero";
  hint?: string;
};

export default function ImageUploadField({
  value,
  onChange,
  onUploadingChange,
  disabled,
  maxBytes = 1.5 * 1024 * 1024,
  variant = "logo",
  hint,
}: Props) {
  const { message } = AntdApp.useApp();
  const [uploading, setUploading] = useState(false);

  const setBusy = (busy: boolean) => {
    setUploading(busy);
    onUploadingChange?.(busy);
  };

  const beforeUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      message.error("Only image files are allowed.");
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxBytes) {
      message.error(
        `Image is too large. Maximum size is ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`,
      );
      return Upload.LIST_IGNORE;
    }
    setBusy(true);
    try {
      const res = await uploadStorefrontImage(file);
      if (!res.status || !res.data?.imageUrl) {
        message.error(res.message ?? "Image upload failed");
        return Upload.LIST_IGNORE;
      }
      onChange?.(res.data.imageUrl);
    } finally {
      setBusy(false);
    }
    return false;
  };

  const previewClass =
    variant === "hero" ? "max-h-72 w-full object-cover" : "h-24 w-24 object-contain";

  if (!value) {
    return (
      <Upload.Dragger
        accept="image/*"
        showUploadList={false}
        disabled={disabled || uploading}
        beforeUpload={beforeUpload}
      >
        <p className="ant-upload-drag-icon">
          {uploading ? <LoadingOutlined /> : <UploadOutlined />}
        </p>
        <p className="ant-upload-text">
          {uploading ? "Uploading…" : "Click or drag an image here to upload"}
        </p>
        {hint ? <p className="ant-upload-hint">{hint}</p> : null}
      </Upload.Dragger>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`overflow-hidden rounded-md border ${variant === "logo" ? "inline-block p-1" : ""}`}>
        <img src={value} alt="" className={previewClass} />
      </div>
      <Space>
        <Upload
          accept="image/*"
          showUploadList={false}
          disabled={disabled || uploading}
          beforeUpload={beforeUpload}
        >
          <Button icon={<UploadOutlined />} loading={uploading} disabled={disabled}>
            Replace image
          </Button>
        </Upload>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={disabled || uploading}
          onClick={() => onChange?.(null)}
        >
          Remove
        </Button>
      </Space>
    </div>
  );
}
