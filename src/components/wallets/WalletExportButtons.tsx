import { useState } from "react";
import { App as AntdApp, Button, Dropdown, Tooltip } from "antd";
import type { ButtonProps } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import {
  downloadWalletBalances,
  downloadWalletTransactions,
} from "@/lib/walletExports";

// Both exports are gated on CanViewOrders server-side. The buttons check the
// same permission themselves so a user who cannot use them never sees them —
// the Wallets page and the customer detail modal open on other permissions.
function useCanExportWallets() {
  return useAuthStore((s) => s.hasPermission(Permission.CanViewOrders));
}

/** Whole-system wallet balance export, with the endpoint's one filter as a menu. */
export function WalletBalancesDownload({ size }: Pick<ButtonProps, "size">) {
  const { message } = AntdApp.useApp();
  const canExport = useCanExportWallets();
  const [downloading, setDownloading] = useState(false);

  if (!canExport) return null;

  async function run(onlyWithBalance: boolean) {
    setDownloading(true);
    try {
      const err = await downloadWalletBalances(onlyWithBalance);
      if (err) message.error(err);
      else message.success("Wallet balances downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: [
          {
            key: "scope",
            type: "group",
            // The endpoint takes no search/status parameters, so the workbook is
            // not scoped to whatever the calling page has filtered to.
            label: "Server export — page filters not applied",
            children: [
              {
                key: "funded",
                label: "Funded wallets only",
                onClick: () => run(true),
              },
              {
                key: "all",
                label: "All wallets (including zero balance)",
                onClick: () => run(false),
              },
            ],
          },
        ],
      }}
    >
      <Button size={size} icon={<DownloadOutlined />} loading={downloading}>
        Download balances
      </Button>
    </Dropdown>
  );
}

/** Full wallet ledger for one customer. */
export function WalletTransactionsDownload({
  userId,
  label = "Download",
  size,
}: {
  userId: string | null | undefined;
  label?: string;
  size?: ButtonProps["size"];
}) {
  const { message } = AntdApp.useApp();
  const canExport = useCanExportWallets();
  const [downloading, setDownloading] = useState(false);

  if (!canExport) return null;

  async function run() {
    if (!userId) return;
    setDownloading(true);
    try {
      const err = await downloadWalletTransactions(userId);
      if (err) message.error(err);
      else message.success("Wallet transactions downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Tooltip title="Exports this customer's full wallet ledger as Excel.">
      <Button
        size={size}
        icon={<DownloadOutlined />}
        loading={downloading}
        disabled={!userId}
        onClick={run}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
