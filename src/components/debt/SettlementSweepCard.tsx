import { useState } from "react";
import {
  Card,
  Typography,
  Table,
  Button,
  Row,
  Col,
  Statistic,
  Alert,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  EyeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { apiPost } from "@/lib/api";
import type {
  OrderSettlementSweepResult,
  SettlementDiscrepancy,
} from "@/lib/types";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";

const SWEEP_URL = "DebtCollection/RunSettlementSweep/settlement-sweep";

interface Props {
  // Called after a live run or an edit from the order detail modal, so the due
  // list reflects orders that were closed or marked paid.
  onOrdersChanged?: () => void;
}

// Reconciles outstanding orders against D365. A live run marks every fully-settled,
// amount-matching order Completed in one go and can't be undone from here, so it
// always sits behind a confirmation that quotes the last preview when there is one.
// The server gates both modes on CanViewDebtCollection — this confirmation is the
// only guard.
export function SettlementSweepCard({ onOrdersChanged }: Props) {
  const { message, modal } = AntdApp.useApp();
  const [result, setResult] = useState<OrderSettlementSweepResult | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [running, setRunning] = useState<"preview" | "live" | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  async function runSweep(dryRun: boolean) {
    setRunning(dryRun ? "preview" : "live");
    const res = await apiPost<OrderSettlementSweepResult>(
      `${SWEEP_URL}?dryRun=${dryRun}`,
    );
    setRunning(null);
    if (!res.status || !res.data) {
      message.error(res.message ?? "Settlement sweep failed");
      return;
    }
    setResult(res.data);
    setRanAt(new Date());
    if (!dryRun) {
      message.success(
        `${res.data.ordersClosed} order${res.data.ordersClosed === 1 ? "" : "s"} closed`,
      );
      onOrdersChanged?.();
    }
  }

  // previewCount is null when there's no dry-run result on screen to quote.
  function confirmLiveRun(previewCount: number | null) {
    modal.confirm({
      title: "Close settled orders?",
      content: (
        <div className="space-y-2">
          {previewCount === null ? (
            <p>
              You haven't previewed this run. It will mark{" "}
              <strong>every</strong> order D365 shows as fully settled for the
              expected amount Completed and fully paid, and take them off the due
              list and debt collection. Running a preview first shows how many
              that is.
            </p>
          ) : previewCount === 0 ? (
            <p>
              The last preview found no orders to close, so this will most likely
              change nothing. Any order that has settled in D365 since then will
              be marked Completed and fully paid.
            </p>
          ) : (
            <p>
              The preview found <strong>{previewCount}</strong> order
              {previewCount === 1 ? "" : "s"} fully settled in D365. Running the
              sweep marks them Completed and fully paid, and takes them off the
              due list and debt collection.
            </p>
          )}
          <p>
            The server re-checks every order when it runs, so the final count
            may differ from any preview. This can't be undone from the admin.
          </p>
        </div>
      ),
      okText: "Close orders",
      okButtonProps: { danger: true },
      onOk: () => runSweep(false),
    });
  }

  const discrepancies = result?.discrepancies ?? [];
  const isPreview = result?.dryRun ?? true;
  // Only a dry run on screen says what a live run would close; after a live run
  // the numbers describe what already happened.
  const previewCount = result?.dryRun ? result.ordersClosed : null;

  const discrepancyColumns: TableColumnsType<SettlementDiscrepancy> = [
    {
      title: "Order ref",
      dataIndex: "orderReference",
      render: (v: string | null) =>
        v ? (
          // Stop the copy click from also opening the order.
          <span onClick={(e) => e.stopPropagation()}>
            <Typography.Text copyable className="font-medium">
              {v}
            </Typography.Text>
          </span>
        ) : (
          "—"
        ),
    },
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v) => v ?? "—",
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="font-mono text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Detail",
      dataIndex: "detail",
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          aria-label="View order"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrderId(r.orderId);
          }}
        />
      ),
    },
  ];

  return (
    <Card
      title="Settlement sweep"
      extra={
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<SearchOutlined />}
            loading={running === "preview"}
            disabled={running !== null}
            onClick={() => runSweep(true)}
          >
            {result ? "Preview again" : "Preview sweep"}
          </Button>
          <Button
            danger
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={running === "live"}
            disabled={running !== null}
            onClick={() => confirmLiveRun(previewCount)}
          >
            {previewCount
              ? `Close ${previewCount} order${previewCount === 1 ? "" : "s"}`
              : "Run sweep"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Typography.Text type="secondary">
          Checks every outstanding order against D365. Orders whose sales orders
          are all settled for the expected amount can be closed; settled orders
          with a mismatched amount are listed for investigation and never closed.
          A preview changes nothing.
        </Typography.Text>

        {running && (
          <Alert
            type="info"
            showIcon
            message={
              running === "preview"
                ? "Running preview…"
                : "Closing settled orders…"
            }
            description="This checks every outstanding order against D365 and can take a minute or two. Keep this page open."
          />
        )}

        {result && !running && (
          <>
            <Alert
              type={isPreview ? "info" : "success"}
              showIcon
              message={
                isPreview
                  ? "Preview — nothing has been changed"
                  : `Live run complete — ${result.ordersClosed} order${result.ordersClosed === 1 ? "" : "s"} closed`
              }
              description={`${result.salesOrdersQueried} sales order${result.salesOrdersQueried === 1 ? "" : "s"} checked in D365${ranAt ? ` at ${ranAt.toLocaleTimeString()}` : ""}.`}
            />

            {result.batchesFailed > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`${result.batchesFailed} D365 lookup batch${result.batchesFailed === 1 ? "" : "es"} failed`}
                description="Orders in the failed batches couldn't be checked and are counted as unmatched. Run the sweep again to pick them up."
              />
            )}

            <Row gutter={[16, 16]}>
              <Col xs={12} md={8} xl={4}>
                <Statistic title="Examined" value={result.ordersExamined} />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Statistic
                  title={isPreview ? "Would close" : "Closed"}
                  value={result.ordersClosed}
                  valueStyle={{ color: "#16a34a" }}
                />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Statistic
                  title="Still outstanding"
                  value={result.ordersStillOutstanding}
                />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Statistic
                  title="Unmatched in D365"
                  value={result.ordersUnmatched}
                />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Statistic
                  title="Amount discrepancies"
                  value={discrepancies.length}
                  valueStyle={{
                    color: discrepancies.length > 0 ? "#dc2626" : undefined,
                  }}
                />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <Statistic
                  title="Not posted to D365"
                  value={result.ordersSkipped}
                />
              </Col>
            </Row>

            {discrepancies.length > 0 && (
              <div className="space-y-2">
                <Typography.Text strong>
                  Amount discrepancies — need investigation
                </Typography.Text>
                <Table<SettlementDiscrepancy>
                  rowKey="orderId"
                  size="small"
                  dataSource={discrepancies}
                  columns={discrepancyColumns}
                  pagination={
                    discrepancies.length > 10 ? { pageSize: 10 } : false
                  }
                  scroll={{ x: 800 }}
                  onRow={(r) => ({
                    onClick: () => setSelectedOrderId(r.orderId),
                    className: "cursor-pointer",
                  })}
                />
              </div>
            )}
          </>
        )}
      </div>

      <OrderDetailModal
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(v) => !v && setSelectedOrderId(null)}
        onUpdated={() => onOrdersChanged?.()}
      />
    </Card>
  );
}
