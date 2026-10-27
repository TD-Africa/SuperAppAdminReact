import { Typography } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { storefrontUrlFor } from "@/lib/storefrontUrl";

export function StorefrontUrl({ companyName }: { companyName: string | null | undefined }) {
  const url = storefrontUrlFor(companyName);
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
