import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Button,
  Skeleton,
  Tag,
  Divider,
  Typography,
  Input,
  App as AntdApp,
  Card,
  Empty,
  Descriptions,
} from "antd";
import { MessageOutlined, SafetyOutlined } from "@ant-design/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiGet, apiPost } from "@/lib/api";
import type { TicketResponse, TicketStatus } from "@/lib/types";

interface Props {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseTicket: (ticketId: string) => Promise<void>;
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLOR: Record<TicketStatus, "success" | "warning" | "default"> = {
  Opened: "success",
  Pending: "warning",
  Closed: "default",
};

export function TicketDetailModal({
  ticketId,
  open,
  onOpenChange,
  onCloseTicket,
}: Props) {
  const { message: msg } = AntdApp.useApp();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const res = await apiGet<TicketResponse>(`Ticket/GetTicket/${ticketId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load ticket");
      return res.data;
    },
    enabled: !!ticketId && open,
  });

  useEffect(() => {
    if (!open) setComment("");
  }, [open]);

  async function addComment() {
    if (!data) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      msg.error("Comment cannot be empty");
      return;
    }
    setPosting(true);
    const res = await apiPost<boolean>(`Ticket/AddComment/${data.id}`, {
      comment: trimmed,
    });
    setPosting(false);
    if (!res.status) {
      msg.error(res.message ?? "Failed to post comment");
      return;
    }
    setComment("");
    refetch();
  }

  async function handleConfirmClose() {
    if (!data) return;
    await onCloseTicket(data.id);
    onOpenChange(false);
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={() => onOpenChange(false)}
        title={
          <div>
            <div>{data?.topic ?? "Ticket"}</div>
            <div className="mt-0.5 text-xs font-normal text-muted-foreground">
              {data ? `#${data.id.slice(0, 8)}` : "Loading…"}
            </div>
          </div>
        }
        width={800}
        footer={[
          <Button key="close" onClick={() => onOpenChange(false)}>
            Close
          </Button>,
        ]}
        destroyOnClose
      >
        {isLoading || !data ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Tag color={STATUS_COLOR[data.status]}>{data.status}</Tag>
              <Tag>{data.category}</Tag>
              {data.isEscalated && <Tag color="error">Escalated</Tag>}
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} size="small" colon={false}>
              <Descriptions.Item label="Company">
                {data.user?.companyName ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {[data.user?.firstName, data.user?.lastName]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Opened">
                {formatDateTime(data.dateOpened)}
              </Descriptions.Item>
              <Descriptions.Item label="Closed">
                {formatDateTime(data.dateClosed)}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text type="secondary" className="text-xs uppercase">
                Description
              </Typography.Text>
              <p className="mt-1 whitespace-pre-wrap text-sm">{data.description}</p>
            </div>

            <Divider className="!my-2" />

            <div>
              <Typography.Text strong>
                Conversation ({data.comments?.length ?? 0})
              </Typography.Text>
              {!data.comments || data.comments.length === 0 ? (
                <div className="mt-2 rounded-md border border-dashed p-6 text-center">
                  <Empty description="No comments yet." />
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {data.comments.map((c) => (
                    <Card
                      key={c.id}
                      size="small"
                      className={
                        c.isAdmin ? "border-primary bg-primary/5" : undefined
                      }
                      title={
                        <div className="flex items-center gap-2 text-sm">
                          {c.isAdmin ? (
                            <>
                              <SafetyOutlined className="text-primary" />
                              Admin
                            </>
                          ) : (
                            data.user?.companyName ?? "Customer"
                          )}
                        </div>
                      }
                      extra={
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(c.dateCreated)}
                        </span>
                      }
                    >
                      <p className="whitespace-pre-wrap text-sm">{c.comment}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {data.status !== "Closed" && (
              <>
                <Divider className="!my-2" />
                <div className="space-y-2">
                  <Typography.Text strong>Add a new comment</Typography.Text>
                  <Input.TextArea
                    rows={4}
                    maxLength={600}
                    showCount
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Type your response…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="primary"
                      icon={<MessageOutlined />}
                      loading={posting}
                      onClick={addComment}
                    >
                      Post comment
                    </Button>
                    <Button danger onClick={() => setConfirmOpen(true)}>
                      Close ticket
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Close this ticket?"
        description="The customer won't be able to add further comments."
        confirmLabel="Close ticket"
        destructive
        onConfirm={handleConfirmClose}
      />
    </>
  );
}
