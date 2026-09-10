import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Modal, Table, Tag, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { apiGet } from "@/lib/api";
import type { ExchangeRateResponse } from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";

// `brandId` null means the platform base-rate ledger; a brand id scopes the
// history to that brand's overrides.
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string | null;
  brandName?: string | null;
}

export function RateHistoryModal({ open, onOpenChange, brandId, brandName }: Props) {
  const isBase = brandId === null;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["exchange-rate-history", brandId ?? "base"],
    // Only fetch once opened, so closed rows don't each hold a request.
    enabled: open,
    queryFn: async () => {
      const query = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
      const res = await apiGet<ExchangeRateResponse[]>(
        `ExchangeRate/GetRateHistory/history${query}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load rate history");
      // Sort client-side rather than trusting the server's order — the row in
      // force should always lead the ledger.
      return [...(res.data ?? [])].sort(
        (a, b) =>
          new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
      );
    },
  });

  const rows = data ?? [];

  const columns: TableColumnsType<ExchangeRateResponse> = [
    {
      title: "Rate",
      dataIndex: "rate",
      width: 130,
      render: (v: number) => (
        <span className="font-medium">₦{formatNumber(v)}</span>
      ),
    },
    {
      title: "Effective from",
      dataIndex: "effectiveFrom",
      render: (v: string) => formatDateTime(v),
    },
    {
      title: "Effective to",
      dataIndex: "effectiveTo",
      render: (v: string | null) =>
        v ? (
          formatDateTime(v)
        ) : (
          <Tag color="green" className="!m-0">
            In force
          </Tag>
        ),
    },
    {
      title: "Set by",
      dataIndex: "createdBy",
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span className="line-clamp-2 text-xs">{v}</span>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <Modal
      open={open}
      title={isBase ? "Base rate history" : `Rate history — ${brandName ?? "brand"}`}
      onCancel={() => onOpenChange(false)}
      footer={<Button onClick={() => onOpenChange(false)}>Close</Button>}
      width={880}
      destroyOnClose
    >
      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Could not load rate history"
          description={(error as Error).message}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <Typography.Text type="secondary">
            Every rate change is kept as its own row — newest first.
          </Typography.Text>
          <Table<ExchangeRateResponse>
            className="mt-3"
            rowKey="id"
            size="small"
            dataSource={rows}
            columns={columns}
            loading={isLoading}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{ emptyText: "No rate changes recorded yet" }}
          />
        </>
      )}
    </Modal>
  );
}
