import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Descriptions,
  Table,
  Tag,
  Button,
  Space,
  Skeleton,
  Input,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import { useState } from "react";
import {
  approveAdminPayout,
  getAdminPayout,
  getAdminPayoutAudit,
  getStorefrontPayout,
  getStorefrontPayoutAudit,
  processAdminPayout,
  rejectAdminPayout,
} from "@/lib/storefrontApi";
import type {
  StorefrontPayoutAuditDto,
  StorefrontPayoutDto,
  StorefrontPayoutStatus,
} from "@/lib/storefrontTypes";
import { formatCurrency, formatDate } from "@/lib/utils";

function payoutStatusTag(status: StorefrontPayoutStatus) {
  const map: Record<StorefrontPayoutStatus, string> = {
    Requested: "processing",
    Approved: "blue",
    Processing: "processing",
    Paid: "success",
    Rejected: "error",
    Failed: "error",
    Cancelled: "default",
  };
  return <Tag color={map[status]}>{status}</Tag>;
}

interface Props {
  payoutId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function PayoutDetailModal({
  payoutId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [acting, setActing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-payout", payoutId],
    queryFn: async () => {
      if (!payoutId) return null;
      const res = await getAdminPayout(payoutId);
      if (res.status && res.data) return res.data;
      const fallback = await getStorefrontPayout(payoutId);
      if (!fallback.status) {
        throw new Error(res.message ?? fallback.message ?? "Failed to load payout");
      }
      return fallback.data;
    },
    enabled: !!payoutId && open,
  });

  const auditQuery = useQuery({
    queryKey: ["admin-payout-audit", payoutId],
    queryFn: async () => {
      if (!payoutId) return [];
      const res = await getAdminPayoutAudit(payoutId);
      if (res.status && res.data) return res.data;
      const fallback = await getStorefrontPayoutAudit(payoutId);
      if (!fallback.status) {
        throw new Error(res.message ?? fallback.message ?? "Failed to load audit trail");
      }
      return fallback.data ?? [];
    },
    enabled: !!payoutId && open,
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
      auditQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      onUpdated?.();
    } finally {
      setActing(false);
    }
  }

  const auditColumns: TableColumnsType<StorefrontPayoutAuditDto> = [
    {
      title: "Date",
      dataIndex: "dateCreated",
      width: 150,
      render: (v) => formatDate(v),
    },
    { title: "Action", dataIndex: "action", render: (v) => v ?? "—" },
    {
      title: "From",
      dataIndex: "fromStatus",
      render: (v) => payoutStatusTag(v),
    },
    {
      title: "To",
      dataIndex: "toStatus",
      render: (v) => payoutStatusTag(v),
    },
    { title: "Note", dataIndex: "note", ellipsis: true, render: (v) => v ?? "—" },
  ];

  const payout = data as StorefrontPayoutDto | null | undefined;
  const currency = payout?.currency ?? "NGN";
  const currencyCode = currency === "USD" ? "USD" : "NGN";

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title={payout ? `Payout ${payout.requestReference ?? payout.id.slice(0, 8)}` : "Payout"}
        width={880}
        footer={
          payout ? (
            <Space wrap>
              {payout.status === "Requested" && (
                <>
                  <Button
                    type="primary"
                    loading={acting}
                    onClick={() =>
                      runAction(
                        () => approveAdminPayout(payout.id),
                        "Payout approved",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button danger loading={acting} onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {payout.status === "Approved" && (
                <Button
                  type="primary"
                  loading={acting}
                  onClick={() =>
                    runAction(
                      () => processAdminPayout(payout.id),
                      "Payout queued for processing",
                    )
                  }
                >
                  Process
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </Space>
          ) : null
        }
        destroyOnClose
      >
        {isLoading || !payout ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <div className="space-y-5">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Status">
                {payoutStatusTag(payout.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Owner">{payout.ownerId ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Amount">
                {formatCurrency(payout.amount, currencyCode)}
              </Descriptions.Item>
              <Descriptions.Item label="Fee">
                {formatCurrency(payout.fee, currencyCode)}
              </Descriptions.Item>
              <Descriptions.Item label="Net">
                {formatCurrency(payout.netAmount, currencyCode)}
              </Descriptions.Item>
              <Descriptions.Item label="Bank">
                {[payout.bankName, payout.accountName].filter(Boolean).join(" · ") || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Account">
                {payout.accountNumberLast4 ? `****${payout.accountNumberLast4}` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Requested">
                {formatDate(payout.requestedAt)}
              </Descriptions.Item>
              {payout.failureReason && (
                <Descriptions.Item label="Failure" span={2}>
                  <span className="text-red-600">{payout.failureReason}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Table<StorefrontPayoutAuditDto>
              size="small"
              rowKey="id"
              title={() => <span className="font-medium">Audit trail</span>}
              columns={auditColumns}
              dataSource={auditQuery.data ?? []}
              loading={auditQuery.isLoading}
              pagination={false}
              scroll={{ x: 700 }}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={rejectOpen}
        title="Reject payout"
        okText="Reject"
        okButtonProps={{ danger: true }}
        confirmLoading={acting}
        onCancel={() => setRejectOpen(false)}
        onOk={() => {
          if (!payout) return;
          runAction(
            () => rejectAdminPayout(payout.id, { reason: rejectReason || null }),
            "Payout rejected",
          ).then(() => setRejectOpen(false));
        }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Reason (optional)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
        />
      </Modal>
    </>
  );
}
