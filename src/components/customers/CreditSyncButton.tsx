import { useState } from "react";
import { App as AntdApp, Button, Tooltip } from "antd";
import type { ButtonProps } from "antd";
import { CloudSyncOutlined } from "@ant-design/icons";
import { apiPost, API_ORIGIN } from "@/lib/api";
import type { CreditSyncResult } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { formatCurrency } from "@/lib/utils";

// CreditSyncController is mounted at the unversioned /api root, unlike the
// /api/v1 controllers behind API_BASE_URL.
const CREDIT_SYNC_URL = `${API_ORIGIN}/api/CreditSync`;

interface CreditSyncButtonProps {
  userId: string;
  /** The sync pulls from D365, so an unlinked customer has nothing to pull. */
  dynamicsId: string | null | undefined;
  /** Called after a successful sync so the caller can refetch the stale row. */
  onSynced?: (result: CreditSyncResult | null) => void;
  label?: string;
  size?: ButtonProps["size"];
  /** Renders icon-only, for the Customers table's action column. */
  iconOnly?: boolean;
}

/**
 * Re-syncs one customer's credit limit/balance from D365 immediately. Unlike the
 * bulk trigger on the Customers page this takes no cycle lock, so it is safe to
 * run while a scheduled bulk refresh is in flight.
 */
export function CreditSyncButton({
  userId,
  dynamicsId,
  onSynced,
  label = "Sync credit",
  size,
  iconOnly = false,
}: CreditSyncButtonProps) {
  const { message } = AntdApp.useApp();
  // Same permission as the bulk trigger — this writes balances onto the user.
  const canSync = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));
  const [syncing, setSyncing] = useState(false);

  if (!canSync) return null;

  const linked = !!dynamicsId;

  async function run() {
    setSyncing(true);
    try {
      const res = await apiPost<CreditSyncResult>(
        `${CREDIT_SYNC_URL}/${encodeURIComponent(userId)}`,
      );
      if (!res.status) {
        message.error(res.message ?? "Credit sync failed");
        return;
      }
      const r = res.data;
      // Report the movement rather than a bare "done" — the whole point of a
      // manual sync is seeing whether the balance actually changed.
      message.success(
        r
          ? `Credit balance ${formatCurrency(r.previousCreditBalance, "NGN")} → ${formatCurrency(
              r.newCreditBalance,
              "NGN",
            )}`
          : (res.message ?? "Credit synced"),
      );
      onSynced?.(r ?? null);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Tooltip
      title={
        linked
          ? "Pull this customer's credit limit and balance from Dynamics now"
          : "Cannot sync — customer is not linked to Dynamics"
      }
    >
      {/* A disabled antd Button swallows pointer events, so the "not linked"
          tooltip needs a wrapper to hang off. */}
      <span className="inline-flex">
        <Button
          size={size}
          // Pulling from a remote system, rather than the plain SyncOutlined the
          // page's bulk trigger uses — keeps the two visually distinct.
          icon={<CloudSyncOutlined />}
          loading={syncing}
          disabled={!linked}
          onClick={run}
        >
          {iconOnly ? null : label}
        </Button>
      </span>
    </Tooltip>
  );
}
