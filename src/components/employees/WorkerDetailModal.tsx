import { useQuery } from "@tanstack/react-query";
import { Modal, Descriptions, Tag, Skeleton, Alert } from "antd";
import { apiGet, API_ORIGIN } from "@/lib/api";
import type { WorkerSalesStats } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

interface WorkerDetailModalProps {
  referralId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkerDetailModal({
  referralId,
  open,
  onOpenChange,
}: WorkerDetailModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["worker-detail", referralId],
    enabled: open && !!referralId,
    queryFn: async () => {
      const res = await apiGet<WorkerSalesStats>(
        `${API_ORIGIN}/api/Worker/${encodeURIComponent(referralId!)}`,
      );
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load employee");
      }
      return res.data;
    },
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      title={data?.fullName ?? "Employee details"}
      width={560}
      destroyOnClose
    >
      {isLoading && <Skeleton active paragraph={{ rows: 5 }} />}
      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load"
          description={(error as Error).message}
        />
      )}
      {data && !isLoading && (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Full name">
            {data.fullName ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Personnel number">
            {data.personnelNumber ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Referral ID">
            <span className="font-mono">{data.referralId ?? "—"}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            {data.isActive ? (
              <Tag color="success">Active</Tag>
            ) : (
              <Tag>Inactive</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Converted orders">
            {formatNumber(data.orderCount)}
          </Descriptions.Item>
          <Descriptions.Item label="Total sales">
            {formatCurrency(data.totalAmount, "NGN")}
          </Descriptions.Item>
          <Descriptions.Item label="Last converted">
            {data.lastConvertedUtc ? formatDate(data.lastConvertedUtc) : "—"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
