import { Typography } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { storefrontUrlFor } from "@/lib/storefrontUrl";

export function StorefrontUrl({ userName }: { userName: string | null | undefined }) {
  const url = storefrontUrlFor(userName);
  if (!url) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <Typography.Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      copyable={{ text: url }}
    >
      <LinkOutlined /> {url.replace(/^https?:\/\//, "")}
    </Typography.Link>
  );
}
