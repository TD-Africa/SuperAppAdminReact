import { Tag } from "antd";
import type { WalletTransactionResponse } from "@/lib/types";

// The API returns `type` and `status` as free-form strings rather than enums, so
// classify by keyword and fall back to a neutral tag for anything unrecognized.

const CREDIT_WORDS = /credit|fund|top ?-?up|deposit|refund|reversal|inflow/i;
const DEBIT_WORDS = /debit|withdraw|purchase|payment|charge|outflow|transfer/i;

export type Direction = "credit" | "debit" | "unknown";

export function directionOf(txn: WalletTransactionResponse): Direction {
  const type = txn.type ?? "";
  if (CREDIT_WORDS.test(type)) return "credit";
  if (DEBIT_WORDS.test(type)) return "debit";
  // No usable type string: infer from the sign of the amount.
  if (txn.amount > 0) return "credit";
  if (txn.amount < 0) return "debit";
  return "unknown";
}

export function TypeTag({ txn }: { txn: WalletTransactionResponse }) {
  const dir = directionOf(txn);
  const label = txn.type?.trim() || (dir === "unknown" ? "—" : dir);
  const color = dir === "credit" ? "success" : dir === "debit" ? "error" : "default";
  return <Tag color={color}>{label}</Tag>;
}

export function StatusTag({ status }: { status: string | null }) {
  const s = status?.trim();
  if (!s) return <Tag>—</Tag>;
  let color: string | undefined;
  if (/success|complete|settled|approved|paid/i.test(s)) color = "success";
  else if (/pending|processing|initiated|awaiting/i.test(s)) color = "warning";
  else if (/fail|declin|revers|cancel|error/i.test(s)) color = "error";
  return <Tag color={color}>{s}</Tag>;
}
