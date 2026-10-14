import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Skeleton, Table, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { CreditPositionResponse, CreditReservationResponse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const KIND_TAGS: Record<string, { color: string; label: string; hint: string }> = {
  AwaitingInvoice: {
    color: "blue",
    label: "Awaiting invoice",
    hint: "In D365 as a TDNG sales order, not invoiced yet. Reserved.",
  },
  InFlight: {
    color: "gold",
    label: "In flight",
    hint: "Not in D365 yet (awaiting acceptance or recent). Reserved.",
  },
  NeedsReview: {
    color: "red",
    label: "Needs review",
    hint: "Never reached D365 and past the in-flight window. Not reserved — a Lead should post or cancel it.",
  },
};

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "danger";
}) {
  const body = (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-base font-semibold tabular-nums ${
          tone === "danger" ? "text-red-600" : "text-foreground"
        }`}
      >
        {formatCurrency(value, "NGN")}
      </div>
    </div>
  );
  return hint ? <Tooltip title={hint}>{body}</Tooltip> : body;
}

/**
 * One partner's credit position: D365 balance and available credit, what
 * SuperApp has reserved against it and why, and what checkout would allow.
 *
 * Loads on demand. Each load asks D365 which TDNG sales orders are invoiced,
 * so it is not fetched just because a customer record was opened.
 */
export function CreditPositionPanel({
  userId,
  autoLoad = false,
}: {
  userId: string;
  /** Load immediately instead of waiting for the button. */
  autoLoad?: boolean;
}) {
  const { data, error, isFetching, isFetched, refetch } = useQuery({
    queryKey: ["credit-position", userId],
    queryFn: async () => {
      const res = await apiGet<CreditPositionResponse>(`Credit/Position/${userId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load credit position");
      return res.data;
    },
    enabled: autoLoad && !!userId,
    retry: false,
    staleTime: 60_000,
  });

  if (!isFetched && !isFetching) {
    return (
      <Button onClick={() => refetch()}>Load credit position from D365</Button>
    );
  }
  if (isFetching && !data) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={(error as Error).message}
        action={
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!data) return null;

  const columns: TableColumnsType<CreditReservationResponse> = [
    {
      title: "Order",
      dataIndex: "orderReference",
      render: (v: string | null, r) => (
        <div>
          <div className="font-medium">{v ?? r.orderId}</div>
          <div className="text-xs text-muted-foreground">{formatDate(r.dateCreated)}</div>
        </div>
      ),
    },
    {
      title: "Kind",
      dataIndex: "kind",
      render: (v: string) => {
        const k = KIND_TAGS[v];
        return k ? (
          <Tooltip title={k.hint}>
            <Tag color={k.color}>{k.label}</Tag>
          </Tooltip>
        ) : (
          <Tag>{v}</Tag>
        );
      },
    },
    { title: "Status", dataIndex: "orderStatus", render: (v) => v ?? "—" },
    {
      title: "Sales orders",
      dataIndex: "salesIds",
      render: (v: string[]) =>
        v?.length ? <span className="text-xs">{v.join(", ")}</span> : "—",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v: number) => formatCurrency(v, "NGN"),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tag color={data.isEnforced ? "red" : "default"}>
          {data.isEnforced ? "Credit limit enforced at checkout" : "Enforcement off"}
        </Tag>
        <span className="text-xs text-muted-foreground">D365 {data.dynamicsId}</span>
        <Button
          size="small"
          type="text"
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Refresh
        </Button>
      </div>

      {!data.invoiceStatusVerified && (
        <Alert
          type="warning"
          showIcon
          message="D365 didn't confirm which sales orders are invoiced, so every uninvoiced TDNG order is counted as reserved. Available credit may read low."
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Credit limit" value={data.creditLimit} hint="D365 available + account balance" />
        <Tile
          label="Account balance"
          value={data.accountBalance}
          hint="D365 posted balance. Positive = owes; negative = in credit."
        />
        <Tile label="D365 available" value={data.d365Available} />
        <Tile
          label="Reserved"
          value={data.reserved}
          hint="SuperApp credit orders D365 hasn't invoiced yet"
        />
        <Tile
          label="Available to checkout"
          value={data.available}
          hint="D365 available − reserved"
          tone={data.available < 0 ? "danger" : undefined}
        />
        <Tile
          label={`Needs review (${data.needsReviewCount})`}
          value={data.needsReviewAmount}
          hint="Not reserved. A Lead should post or cancel these orders."
          tone={data.needsReviewCount > 0 ? "danger" : undefined}
        />
      </div>

      <Table<CreditReservationResponse>
        rowKey="orderId"
        size="small"
        columns={columns}
        dataSource={data.reservations ?? []}
        pagination={data.reservations.length > 10 ? { pageSize: 10 } : false}
        locale={{ emptyText: "Nothing reserved against this customer." }}
        scroll={{ x: 640 }}
      />
    </div>
  );
}
