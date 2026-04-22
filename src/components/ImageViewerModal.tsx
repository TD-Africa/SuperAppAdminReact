import { Modal, Button, Empty } from "antd";
import { ExportOutlined } from "@ant-design/icons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  url: string | null | undefined;
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

function isImage(url: string | null | undefined) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return IMAGE_EXTS.some((ext) => clean.endsWith(ext));
}

export function ImageViewerModal({
  open,
  onOpenChange,
  title,
  subtitle,
  url,
}: Props) {
  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={
        <div>
          <div>{title}</div>
          {subtitle && (
            <div className="text-xs font-normal text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
      }
      width={960}
      footer={[
        url && (
          <Button key="open" icon={<ExportOutlined />}>
            <a href={url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          </Button>
        ),
        <Button key="close" type="primary" onClick={() => onOpenChange(false)}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="min-h-[400px] overflow-hidden rounded-md bg-muted">
        {!url ? (
          <div className="flex h-[500px] items-center justify-center">
            <Empty description="No document on file" />
          </div>
        ) : isImage(url) ? (
          <img
            src={url}
            alt={title}
            className="mx-auto max-h-[70vh] w-auto object-contain"
          />
        ) : (
          <iframe src={url} title={title} className="h-[70vh] w-full border-0" />
        )}
      </div>
    </Modal>
  );
}
