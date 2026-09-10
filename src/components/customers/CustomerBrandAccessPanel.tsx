import { useQuery } from "@tanstack/react-query";
import { Avatar, Tag, Tooltip, Typography, Skeleton, Alert } from "antd";
import { ShopOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { PartnerBrandAccessDto } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface Props {
  userId: string | null;
  /** Skip the request until the containing modal is actually open. */
  enabled: boolean;
}

/**
 * Brands this customer is authorized on. Only restricted brands (those with
 * partner authorization turned on) gate access, so an empty list does not mean
 * the customer can't buy anything — it means they hold no explicit grants.
 */
export function CustomerBrandAccessPanel({ userId, enabled }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["partner-brand-access", userId],
    queryFn: async () => {
      const res = await apiGet<PartnerBrandAccessDto[]>(
        `Brand/GetPartnerBrandAccess/partners/${userId}/authorizations`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load brand access");
      return res.data ?? [];
    },
    enabled: enabled && !!userId,
  });

  if (isLoading) {
    return <Skeleton active title={false} paragraph={{ rows: 2 }} />;
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Could not load brand access"
        description={(error as Error)?.message}
      />
    );
  }

  const rows = data ?? [];

  if (!rows.length) {
    return (
      <Typography.Text type="secondary" className="text-sm">
        No restricted-brand access granted.
      </Typography.Text>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {rows.map((b) => (
        <div key={b.brandId} className="flex items-center gap-3 p-3">
          <Avatar
            src={b.brandImageUrl ?? undefined}
            icon={!b.brandImageUrl ? <ShopOutlined /> : undefined}
            shape="square"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium">
                {b.brandName ?? "—"}
              </span>
              {b.inheritedFromMainAccount && (
                <Tooltip title="Granted to the main account; this sub-user inherits it and it can't be revoked here.">
                  <Tag color="blue">Inherited</Tag>
                </Tooltip>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {formatDateTime(b.authorizedOn)}
              {b.authorizedBy ? ` · by ${b.authorizedBy}` : ""}
            </div>
            {b.notes && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {b.notes}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
