import { useState } from "react";
import { Modal, Descriptions, Tag, Button, Space, Typography } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import type { CustomerResponse, UserStatus } from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ImageViewerModal } from "@/components/ImageViewerModal";

interface CustomerDetailModalProps {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColor: Record<UserStatus, "success" | "warning" | "error" | "default"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "error",
  Rejected: "error",
  Incomplete: "default",
};

function yesNo(v: boolean | null | undefined) {
  return v ? <Tag color="success">Yes</Tag> : <Tag>No</Tag>;
}

export function CustomerDetailModal({
  customer,
  open,
  onOpenChange,
}: CustomerDetailModalProps) {
  const [doc, setDoc] = useState<{ title: string; url: string } | null>(null);

  const c = customer;
  const fullName = c
    ? [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"
    : "—";
  const address =
    c &&
    [c.addressLine, c.street, c.city, c.state, c.country]
      .filter(Boolean)
      .join(", ");

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        footer={null}
        width={760}
        destroyOnClose
        title={
          <div>
            <div>{c?.companyName ?? "Customer details"}</div>
            {c && (
              <Space size={6} className="mt-1">
                <Tag color={statusColor[c.userStatus] ?? "default"}>
                  {c.userStatus}
                </Tag>
                {c.userType && <Tag>{c.userType}</Tag>}
                {c.isSuspended && <Tag color="error">Suspended</Tag>}
              </Space>
            )}
          </div>
        }
      >
        {c && (
          <div className="space-y-4">
            <Descriptions
              title="Contact"
              column={{ xs: 1, sm: 2 }}
              size="small"
              bordered
            >
              <Descriptions.Item label="Full name">
                {fullName}
              </Descriptions.Item>
              <Descriptions.Item label="Username">
                {c.userName ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {c.email ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {c.phoneNumber ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>
                {address || "—"}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Account & credit"
              column={{ xs: 1, sm: 2 }}
              size="small"
              bordered
            >
              <Descriptions.Item label="Dynamics ID">
                {c.dynamicsId ?? <Tag color="warning">Not linked</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Existing partner">
                {yesNo(c.isExistingPartner)}
              </Descriptions.Item>
              <Descriptions.Item label="Credit txns enabled">
                {yesNo(c.isCreditTransactionEnabled)}
              </Descriptions.Item>
              <Descriptions.Item label="Credit days">
                {c.creditDays ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Credit limit">
                {formatCurrency(c.creditLimit, "NGN")}
              </Descriptions.Item>
              <Descriptions.Item label="Credit balance">
                {formatCurrency(c.creditBalance, "NGN")}
              </Descriptions.Item>
              <Descriptions.Item label="Customer balance">
                {formatCurrency(c.customerBalance, "NGN")}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Orders"
              column={{ xs: 1, sm: 2 }}
              size="small"
              bordered
            >
              <Descriptions.Item label="Total orders">
                {formatNumber(c.numberOfOrders ?? c.totalOrders ?? 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Pending orders">
                {formatNumber(c.pendingOrders ?? 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Date joined">
                {c.dateCreated ? formatDate(c.dateCreated) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Last order">
                {c.lastOrderDate ? formatDate(c.lastOrderDate) : "—"}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>Warehouses</Typography.Text>
              <div className="mt-2">
                {c.userWarehouses && c.userWarehouses.length > 0 ? (
                  <Space wrap size={[4, 8]}>
                    {c.userWarehouses.map((w) => (
                      <Tag key={w.id}>{w.name}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">
                    No warehouses assigned.
                  </Typography.Text>
                )}
              </div>
            </div>

            <div>
              <Typography.Text strong>Documents</Typography.Text>
              <div className="mt-2">
                <Space wrap>
                  <Button
                    icon={<FileTextOutlined />}
                    disabled={!c.cac_FileName}
                    onClick={() =>
                      c.cac_FileName &&
                      setDoc({ title: "CAC document", url: c.cac_FileName })
                    }
                  >
                    {c.cac_FileName ? "View CAC document" : "No CAC document"}
                  </Button>
                  <Button
                    icon={<FileTextOutlined />}
                    disabled={!c.utility_FileName}
                    onClick={() =>
                      c.utility_FileName &&
                      setDoc({ title: "Utility bill", url: c.utility_FileName })
                    }
                  >
                    {c.utility_FileName ? "View utility bill" : "No utility bill"}
                  </Button>
                </Space>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ImageViewerModal
        open={!!doc}
        onOpenChange={(v) => !v && setDoc(null)}
        title={doc?.title ?? ""}
        subtitle={c?.companyName ?? undefined}
        url={doc?.url}
      />
    </>
  );
}
