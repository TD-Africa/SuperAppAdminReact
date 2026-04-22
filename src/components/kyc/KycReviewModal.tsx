import { useState } from "react";
import {
  Modal,
  Button,
  Descriptions,
  Tag,
  Divider,
  Empty,
  App as AntdApp,
  Row,
  Col,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ExportOutlined,
  FileImageOutlined,
} from "@ant-design/icons";
import { PromptDialog } from "@/components/PromptDialog";
import type { CustomerResponse } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";

interface Props {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (customer: CustomerResponse) => void;
  onRejectCac: (customer: CustomerResponse, reason: string) => Promise<void>;
  onRejectUtility: (customer: CustomerResponse, reason: string) => Promise<void>;
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

function isImage(url: string | null | undefined) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return IMAGE_EXTS.some((ext) => clean.endsWith(ext));
}

export function KycReviewModal({
  customer,
  open,
  onOpenChange,
  onApprove,
  onRejectCac,
  onRejectUtility,
}: Props) {
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditUser));
  const [rejectCacOpen, setRejectCacOpen] = useState(false);
  const [rejectUtilityOpen, setRejectUtilityOpen] = useState(false);

  const canShowActions =
    customer?.userStatus === "Pending" || customer?.userStatus === "Active";

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title={
          <div>
            <div>KYC documents</div>
            {customer && (
              <div className="mt-1 text-xs font-normal">
                {customer.companyName}{" "}
                <Tag className="ml-1" color="default">
                  {customer.userStatus}
                </Tag>
              </div>
            )}
          </div>
        }
        width={1200}
        footer={[
          <Button key="close" onClick={() => onOpenChange(false)}>
            Close
          </Button>,
          customer?.userStatus === "Pending" && canEdit && (
            <Button
              key="approve"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => onApprove(customer)}
            >
              Approve
            </Button>
          ),
        ]}
        destroyOnClose
      >
        {customer && (
          <div className="space-y-5">
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <DocumentPane
                  title="CAC file"
                  url={customer.cac_FileName}
                  showReject={canShowActions && canEdit}
                  rejectLabel="Reject CAC file"
                  onReject={() => setRejectCacOpen(true)}
                />
              </Col>
              <Col xs={24} lg={12}>
                <DocumentPane
                  title="Utility bill"
                  url={customer.utility_FileName}
                  showReject={canShowActions && canEdit}
                  rejectLabel="Reject utility bill"
                  onReject={() => setRejectUtilityOpen(true)}
                />
              </Col>
            </Row>

            <Divider className="!my-3" />

            <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon={false}>
              <Descriptions.Item label="Company">
                {customer.companyName ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {customer.email ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {customer.phoneNumber ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Address">
                {[
                  customer.addressLine,
                  customer.street,
                  customer.city,
                  customer.state,
                  customer.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      <PromptDialog
        open={rejectCacOpen}
        onOpenChange={setRejectCacOpen}
        title="Reject CAC file"
        description="Give the customer a reason so they can re-upload."
        label="Reason for rejection"
        placeholder="e.g. Document is blurry, expired…"
        confirmLabel="Reject"
        destructive
        onConfirm={async (reason) => {
          if (!customer) return;
          try {
            await onRejectCac(customer, reason);
          } catch (err) {
            message.error((err as Error).message);
          }
        }}
      />

      <PromptDialog
        open={rejectUtilityOpen}
        onOpenChange={setRejectUtilityOpen}
        title="Reject utility bill"
        description="The customer will be prompted to upload a new bill."
        label="Reason for rejection"
        placeholder="e.g. Too old, wrong address…"
        confirmLabel="Reject"
        destructive
        onConfirm={async (reason) => {
          if (!customer) return;
          try {
            await onRejectUtility(customer, reason);
          } catch (err) {
            message.error((err as Error).message);
          }
        }}
      />
    </>
  );
}

function DocumentPane({
  title,
  url,
  showReject,
  rejectLabel,
  onReject,
}: {
  title: string;
  url: string | null;
  showReject: boolean;
  rejectLabel: string;
  onReject: () => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="font-medium">{title}</div>
        <div className="flex items-center gap-1">
          {url && (
            <Button size="small" icon={<ExportOutlined />}>
              <a href={url} target="_blank" rel="noreferrer">
                Open
              </a>
            </Button>
          )}
          {showReject && (
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={onReject}
            >
              {rejectLabel}
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-[400px] bg-muted">
        {!url ? (
          <div className="flex h-[500px] items-center justify-center">
            <Empty
              image={<FileImageOutlined style={{ fontSize: 48 }} />}
              description="No document on file"
            />
          </div>
        ) : isImage(url) ? (
          <img
            src={url}
            alt={title}
            className="mx-auto max-h-[500px] w-auto object-contain"
          />
        ) : (
          <iframe src={url} title={title} className="h-[500px] w-full border-0" />
        )}
      </div>
    </div>
  );
}
