import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Drawer,
  Dropdown,
  Skeleton,
  Table,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { AnalyticsError } from "./AnalyticsError";
import { CappedPagination } from "./CappedPagination";
import { MoneyValue } from "./MoneyValue";
import {
  ANALYTICS_PAGE_SIZE,
  ANALYTICS_STALE_TIME,
  analyticsError,
  downloadAnalytics,
  getAnalytics,
} from "@/lib/analytics";
import type {
  AnalyticsCreditMix,
  AnalyticsCreditOrder,
  AnalyticsExportFormat,
  AnalyticsPage,
  AnalyticsParams,
  AnalyticsReport,
} from "@/lib/analytics";
import { count, watTimestamp } from "@/lib/analyticsFormat";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";

interface Props {
  method: AnalyticsCreditMix;
  params: AnalyticsParams;
  asOfUtc: string;
  scope: string;
  onClose: () => void;
}

export function CreditPaymentOrdersDrawer({
  method,
  params,
  asOfUtc,
  scope,
  onClose,
}: Props) {
  const { message } = App.useApp();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canViewOrder = hasPermission(Permission.CanViewOrders);
  const canExport =
    hasPermission(Permission.CanViewAnalytics) &&
    hasPermission(Permission.CanViewDebtCollection) &&
    hasPermission(Permission.CanExportAnalytics);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportAbort = useRef<AbortController>();

  // The parent remounts this drawer when its payment method or report scope changes.
  useEffect(() => () => exportAbort.current?.abort(), []);

  const filters: AnalyticsParams = {
    from: params.from,
    to: params.to,
    bucket: params.bucket,
    brandId: params.brandId,
    categoryId: params.categoryId,
    partnerId: params.partnerId,
    paymentMethodId: method.paymentMethodId,
    asOfUtc,
  };

  const orders = useQuery({
    queryKey: ["analytics", scope, "credit-payments/orders", filters, page],
    queryFn: ({ signal }) =>
      getAnalytics<AnalyticsReport<AnalyticsPage<AnalyticsCreditOrder>>>(
        "credit-payments/orders",
        { ...filters, page, pageSize: ANALYTICS_PAGE_SIZE },
        signal,
      ),
    staleTime: ANALYTICS_STALE_TIME,
    retry: false,
  });

  async function exportOrders(format: AnalyticsExportFormat) {
    exportAbort.current?.abort();
    const controller = new AbortController();
    exportAbort.current = controller;
    setExporting(true);

    try {
      await downloadAnalytics(
        "credit-payments/orders",
        format,
        filters,
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted) void message.error(analyticsError(error));
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  const columns: TableColumnsType<AnalyticsCreditOrder> = [
    {
      title: "Order reference",
      dataIndex: "orderReference",
      width: 175,
      render: (reference: string, order) =>
        canViewOrder ? (
          <Button
            type="link"
            className="!h-auto !whitespace-normal !p-0 !text-left"
            onClick={() => setSelectedOrder(order.orderId)}
          >
            {reference || order.orderId}
          </Button>
        ) : (
          reference || order.orderId
        ),
    },
    { title: "Partner", dataIndex: "companyName", width: 210 },
    {
      title: "Placed at (WAT)",
      dataIndex: "placedAtUtc",
      width: 180,
      render: watTimestamp,
    },
    { title: "Order status", dataIndex: "orderStatus", width: 130 },
    {
      title: "Recorded payment status",
      dataIndex: "paymentStatus",
      width: 185,
    },
    {
      title: "Net order value",
      key: "value",
      align: "right",
      width: 180,
      render: (_, order) => (
        <MoneyValue naira={order.revenueNaira} usd={order.revenueUsd} />
      ),
    },
  ];

  const total = orders.data?.data.totalCount;

  return (
    <Drawer
      open
      size={1150}
      styles={{ wrapper: { maxWidth: "100vw" } }}
      title={`${method.name} · orders`}
      onClose={onClose}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Typography.Text strong>
          {total == null
            ? "Loading orders…"
            : `${count(total)} matching orders`}
        </Typography.Text>
        {canExport && (
          <Dropdown
            menu={{
              items: [
                { key: "csv", label: "CSV" },
                { key: "xlsx", label: "Excel" },
              ],
              onClick: ({ key }) =>
                void exportOrders(key as AnalyticsExportFormat),
            }}
            disabled={exporting || orders.isPending || orders.isError || !total}
          >
            <Button icon={<DownloadOutlined />} loading={exporting}>
              Export matching orders
            </Button>
          </Dropdown>
        )}
      </div>

      <Typography.Paragraph type="secondary">
        {params.from} to {params.to} · Placement cutoff {watTimestamp(asOfUtc)}{" "}
        WAT. Includes pending and cancelled orders. Brand/category filters
        select matching orders and their matching line values; ineligible
        statuses contribute no net order value. Payment status uses saved order
        flags and amounts, not a reconciled ledger balance.
      </Typography.Paragraph>
      {canExport && (
        <Typography.Paragraph type="secondary">
          Exports include all matching pages, up to 5,000 orders. Narrow the
          report filters for larger results.
        </Typography.Paragraph>
      )}

      {orders.isError ? (
        <AnalyticsError
          error={orders.error}
          retry={() => void orders.refetch()}
        />
      ) : orders.isPending ? (
        <Skeleton active />
      ) : (
        <>
          <Table
            rowKey="orderId"
            columns={columns}
            dataSource={orders.data.data.items}
            tableLayout="fixed"
            pagination={false}
            scroll={{ x: 1060 }}
            locale={{
              emptyText:
                "No orders match this payment method and these filters.",
            }}
          />
          <CappedPagination
            noun="orders"
            current={page}
            total={orders.data.data.totalCount}
            onChange={setPage}
          />
        </>
      )}

      {canViewOrder && selectedOrder && (
        <OrderDetailModal
          orderId={selectedOrder}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedOrder(null);
          }}
          readOnly
        />
      )}
    </Drawer>
  );
}
