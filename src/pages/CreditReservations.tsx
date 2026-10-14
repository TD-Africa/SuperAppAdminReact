import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Input,
  Modal,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type {
  CreditReservationReportRow,
  CustomerResponse,
  PaginationResponse,
} from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { CreditPositionPanel } from "@/components/credit/CreditPositionPanel";

/** "₦1,200,000 · 3 orders", or a dash when there are none. */
function amountCell(amount: number, orders: number) {
  if (!orders) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="text-right">
      <div className="tabular-nums">{formatCurrency(amount, "NGN")}</div>
      <div className="text-xs text-muted-foreground">
        {formatNumber(orders)} order{orders === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function columnTitle(title: string, hint: string) {
  return (
    <Tooltip title={hint}>
      <span className="cursor-help underline decoration-dotted">{title}</span>
    </Tooltip>
  );
}

export default function CreditReservationsPage() {
  const { message } = AntdApp.useApp();
  const [keyword, setKeyword] = useState("");
  const [position, setPosition] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["credit-reservation-report"],
    queryFn: async () => {
      const res = await apiGet<CreditReservationReportRow[]>("Credit/ReservationReport");
      if (!res.status) throw new Error(res.message ?? "Failed to load report");
      return res.data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const all = data ?? [];
    if (!q) return all;
    return all.filter(
      (r) =>
        r.dynamicsId?.toLowerCase().includes(q) ||
        r.companyName?.toLowerCase().includes(q),
    );
  }, [data, keyword]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          awaiting: t.awaiting + r.awaitingInvoiceAmount,
          inFlight: t.inFlight + r.inFlightAmount,
          review: t.review + r.needsReviewAmount,
          reviewOrders: t.reviewOrders + r.needsReviewOrders,
          legacy: t.legacy + r.legacyAmount,
        }),
        { awaiting: 0, inFlight: 0, review: 0, reviewOrders: 0, legacy: 0 },
      ),
    [rows],
  );

  // The report is keyed by D365 customer, the position endpoint by user. The
  // user search matches on Dynamics ID, and any user on the account resolves to
  // the same D365 position, so the first exact match is enough.
  async function openPosition(row: CreditReservationReportRow) {
    setResolving(row.dynamicsId);
    try {
      const params = new URLSearchParams({
        SearchString: row.dynamicsId,
        PageSize: "20",
        PageNumber: "1",
      });
      const res = await apiGet<PaginationResponse<CustomerResponse>>(
        `User/GetUsers?${params.toString()}`,
      );
      const match = (res.data?.data ?? []).find(
        (u) => u.dynamicsId?.toLowerCase() === row.dynamicsId.toLowerCase(),
      );
      if (!match) {
        message.warning(`No SuperApp customer is linked to ${row.dynamicsId}`);
        return;
      }
      setPosition({ userId: match.id, name: row.companyName || row.dynamicsId });
    } finally {
      setResolving(null);
    }
  }

  const columns: TableColumnsType<CreditReservationReportRow> = [
    {
      title: "Customer",
      key: "customer",
      fixed: "left",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.companyName || "—"}</div>
          <div className="text-xs text-muted-foreground">{r.dynamicsId}</div>
        </div>
      ),
    },
    {
      title: columnTitle(
        "Awaiting invoice",
        "TDNG sales orders SuperApp hasn't recorded as invoiced. Checkout asks D365 about these. Reserved.",
      ),
      key: "awaiting",
      align: "right",
      sorter: (a, b) => a.awaitingInvoiceAmount - b.awaitingInvoiceAmount,
      render: (_, r) => amountCell(r.awaitingInvoiceAmount, r.awaitingInvoiceOrders),
    },
    {
      title: columnTitle(
        "In flight",
        "Unposted orders still awaiting acceptance or recently placed. Reserved.",
      ),
      key: "inFlight",
      align: "right",
      sorter: (a, b) => a.inFlightAmount - b.inFlightAmount,
      render: (_, r) => amountCell(r.inFlightAmount, r.inFlightOrders),
    },
    {
      title: columnTitle(
        "Needs review",
        "Unposted orders past the in-flight window. NOT reserved — a Lead should post or cancel each one.",
      ),
      key: "review",
      align: "right",
      defaultSortOrder: "descend",
      sorter: (a, b) => a.needsReviewAmount - b.needsReviewAmount,
      render: (_, r) => (
        <span className={r.needsReviewOrders ? "text-red-600" : undefined}>
          {amountCell(r.needsReviewAmount, r.needsReviewOrders)}
        </span>
      ),
    },
    {
      title: columnTitle("Legacy", "Pre-cutover or legacy-ERP orders. Never reserved."),
      key: "legacy",
      align: "right",
      sorter: (a, b) => a.legacyAmount - b.legacyAmount,
      render: (_, r) => amountCell(r.legacyAmount, r.legacyOrders),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Tooltip title="Live position (asks D365)">
          <Button
            size="small"
            icon={<EyeOutlined />}
            loading={resolving === r.dynamicsId}
            onClick={() => openPosition(r)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Credit Reservations
          </Typography.Title>
          <Typography.Text type="secondary">
            What SuperApp holds against each customer's D365 credit — check these
            before switching on credit enforcement. Built from the database only.
          </Typography.Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" showIcon message={(error as Error).message} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card size="small">
          <div className="text-xs text-muted-foreground">Awaiting invoice</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCurrency(totals.awaiting, "NGN")}
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-muted-foreground">In flight</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCurrency(totals.inFlight, "NGN")}
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-muted-foreground">
            Needs review ({formatNumber(totals.reviewOrders)})
          </div>
          <div
            className={`text-lg font-semibold tabular-nums ${
              totals.reviewOrders ? "text-red-600" : ""
            }`}
          >
            {formatCurrency(totals.review, "NGN")}
          </div>
        </Card>
        <Card size="small">
          <div className="text-xs text-muted-foreground">Legacy (not reserved)</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCurrency(totals.legacy, "NGN")}
          </div>
        </Card>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          placeholder="Filter by company or Dynamics ID…"
          value={keyword}
          allowClear
          onChange={(e) => setKeyword(e.target.value)}
          className="max-w-md"
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CreditReservationReportRow>
          rowKey="dynamicsId"
          dataSource={rows}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: 900 }}
          locale={{ emptyText: "No customer has uninvoiced credit orders." }}
        />
      </Card>

      <Modal
        open={!!position}
        onCancel={() => setPosition(null)}
        title={position ? `Credit position · ${position.name}` : "Credit position"}
        width={860}
        footer={null}
        destroyOnClose
      >
        {position && <CreditPositionPanel userId={position.userId} autoLoad />}
      </Modal>
    </div>
  );
}
