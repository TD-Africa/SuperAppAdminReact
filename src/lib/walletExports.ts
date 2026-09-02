// Excel exports served by the admin WalletController. Both routes are guarded
// server-side by CanViewOrders — which is not the permission that opens the
// Wallets page — so callers should render the buttons in walletExports' sibling
// components rather than linking these URLs directly.
//
// NOTE: like the rest of the Wallet controller, these are only deployed on the
// production admin API. A 404 means VITE_API_BASE_URL points at test.
import { API_BASE_URL, downloadFile } from "./api";

/**
 * Every wallet in the system, newest balance first. `onlyWithBalance` is the
 * endpoint's sole filter — there is no search/status parameter, so the workbook
 * is never scoped to what a page is currently showing.
 */
export function downloadWalletBalances(onlyWithBalance: boolean) {
  return downloadFile(
    `${API_BASE_URL}Wallet/DownloadAllWalletBalances?onlyWithBalance=${onlyWithBalance}`,
    onlyWithBalance ? "WalletBalances-Funded.xlsx" : "WalletBalances.xlsx",
  );
}

/** One customer's full ledger — the endpoint takes no paging or search args. */
export function downloadWalletTransactions(userId: string) {
  return downloadFile(
    `${API_BASE_URL}Wallet/DownloadWalletTransactions?userId=${encodeURIComponent(userId)}`,
    "WalletTransactions.xlsx",
  );
}
