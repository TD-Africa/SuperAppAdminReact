import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ReloadOutlined, SyncOutlined } from "@ant-design/icons";
import {
  cancelSettlementRecoveryOrder,
  completeSettlementRecoveryRefund,
  getPendingSettlementRefunds,
  getSettlementRecoveryOrder,
  recoverFailedDynamicsSettlements,
} from "@/lib/storefrontApi";
import type { StorefrontSettlementRecoveryDto } from "@/lib/storefrontTypes";
import { formatCurrency, formatDate } from "@/lib/utils";

function statusTag(status: string | null) {
  if (!status) return <Tag>—</Tag>;
  const lower = status.toLowerCase();
  if (lower === "refundpending") return <Tag color="processing">Refund pending</Tag>;
  if (lower === "refunded") return <Tag color="success">Refunded</Tag>;
  if (lower === "failed") return <Tag color="error">Failed</Tag>;
  return <Tag>{status}</Tag>;
}

export default function SettlementRecoveryPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["settlement-recovery", "pending-refunds"],
    queryFn: async () => {
      const res = await getPendingSettlementRefunds(100);
      if (!res.status) throw new Error(res.message ?? "Failed to load pending refunds");
      return res.data ?? [];
    },
  });

  useEffect(() => {
    if (isError) {
      message.error(error instanceof Error ? error.message : "Unable to load refunds.");
    }
  }, [isError, error, message]);

  async function handleRecoverFailed() {
    setRecovering(true);
    try {
      const res = await recoverFailedDynamicsSettlements();
      if (!res.status) {
        message.error(res.message ?? "Recovery failed");
        return;
      }
      message.success(res.message ?? `Recovered ${res.data ?? 0} record(s)`);
      refetch();
    } finally {
      setRecovering(false);
    }
  }

  const columns: TableColumnsType<StorefrontSettlementRecoveryDto> = [
    {
      title: "Requested",
      dataIndex: "requestedAt",
      width: 150,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "External order",
      dataIndex: "externalOrderId",
      render: (v, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-medium text-[#800020] hover:underline"
          onClick={() => {
            setSelectedId(row.id);
            setDetailOpen(true);
          }}
        >
          {v?.trim() || row.paymentReference?.trim() || row.id.slice(0, 8)}
        </button>
      ),
    },
    {
      title: "Amount",
      dataIndex: "refundAmount",
      align: "right",
      render: (v, row) =>
        formatCurrency(v, row.currency === "USD" ? "USD" : "NGN"),
    },
    {
      title: "Attempts",
      dataIndex: "attemptCount",
      align: "right",
      width: 90,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      render: (v) => statusTag(v),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Settlement recovery
          </Typography.Title>
          <Typography.Text type="secondary">
            Monitor and retry storefront settlement refunds that failed to post to Dynamics.
          </Typography.Text>
        </div>
        <Button
          icon={<SyncOutlined />}
          loading={recovering}
          onClick={handleRecoverFailed}
        >
          Recover failed Dynamics
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          Refresh
        </Button>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontSettlementRecoveryDto>
          rowKey="id"
          columns={columns}
          dataSource={data ?? []}
          loading={isLoading || isFetching}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="No pending refunds" /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <SettlementRecoveryDetailModal
        recoveryId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
        onUpdated={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["settlement-recovery"] });
        }}
      />
    </div>
  );
}

function SettlementRecoveryDetailModal({
  recoveryId,
  open,
  onOpenChange,
  onUpdated,
}: {
  recoveryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundRef, setRefundRef] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["settlement-recovery-order", recoveryId],
    queryFn: async () => {
      if (!recoveryId) return null;
      const res = await getSettlementRecoveryOrder(recoveryId);
      if (!res.status) throw new Error(res.message ?? "Failed to load recovery record");
      return res.data;
    },
    enabled: !!recoveryId && open,
  });

  async function runAction(
    fn: () => Promise<{ status: boolean; message?: string | null }>,
    successMsg: string,
  ) {
    setActing(true);
    try {
      const res = await fn();
      if (!res.status) {
        message.error(res.message ?? "Action failed");
        return;
      }
      message.success(successMsg);
      await refetch();
      onUpdated();
    } finally {
      setActing(false);
    }
  }

  const item = data as StorefrontSettlementRecoveryDto | null | undefined;
  const currencyCode = item?.currency === "USD" ? "USD" : "NGN";

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title={item ? `Refund ${item.externalOrderId ?? item.id.slice(0, 8)}` : "Refund"}
        width={720}
        footer={
          item && item.status !== "Refunded"
            ? [
                <Button
                  key="cancel"
                  danger
                  loading={acting}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel refund
                </Button>,
                <Button
                  key="complete"
                  type="primary"
                  loading={acting}
                  onClick={() =>
                    runAction(
                      () =>
                        completeSettlementRecoveryRefund(item.id, {
                          providerRefundReference: refundRef.trim() || "manual",
                        }),
                      "Refund marked complete",
                    )
                  }
                >
                  Mark refund complete
                </Button>,
                <Button key="close" onClick={() => onOpenChange(false)}>
                  Close
                </Button>,
              ]
            : [<Button key="close" onClick={() => onOpenChange(false)}>Close</Button>]
        }
        destroyOnClose
      >
        {isLoading || !item ? (
          <Card loading />
        ) : (
          <div className="space-y-4">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Status">{statusTag(item.status)}</Descriptions.Item>
              <Descriptions.Item label="Attempts">{item.attemptCount}</Descriptions.Item>
              <Descriptions.Item label="Amount">
                {formatCurrency(item.refundAmount, currencyCode)}
              </Descriptions.Item>
              <Descriptions.Item label="Owner">{item.ownerId ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Payment reference">
                {item.paymentReference ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Provider reference">
                {item.providerRefundReference ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Reason" span={2}>
                {item.reason ?? "—"}
              </Descriptions.Item>
              {item.failureReason && (
                <Descriptions.Item label="Failure" span={2}>
                  <span className="text-red-600">{item.failureReason}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Requested">
                {formatDate(item.requestedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Refunded">
                {item.refundedAt ? formatDate(item.refundedAt) : "—"}
              </Descriptions.Item>
            </Descriptions>

            {item.status !== "Refunded" && (
              <Input
                addonBefore="Provider refund reference"
                placeholder="Paystack/transfer reference"
                value={refundRef}
                onChange={(e) => setRefundRef(e.target.value)}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={cancelOpen}
        title="Cancel refund"
        okText="Cancel refund"
        okButtonProps={{ danger: true }}
        confirmLoading={acting}
        onCancel={() => setCancelOpen(false)}
        onOk={() => {
          if (!item) return;
          runAction(
            () =>
              cancelSettlementRecoveryOrder(item.id, {
                reason: cancelReason || null,
              }),
            "Refund cancelled",
          ).then(() => setCancelOpen(false));
        }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Reason (optional)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </>
  );
}
