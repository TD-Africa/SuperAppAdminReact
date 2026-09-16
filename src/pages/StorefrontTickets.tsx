import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined, MessageOutlined, UserOutlined } from "@ant-design/icons";
import {
  addStorefrontTicketComment,
  getStorefrontTicket,
  getStorefrontOwners,
  getStorefrontTickets,
} from "@/lib/storefrontApi";
import type { StorefrontOwnerDetailDto } from "@/lib/storefrontTypes";
import {
  TicketCategoryValues,
  TicketStatusValues,
  type TicketResponse,
  type TicketStatus,
} from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

const STATUS_COLOR: Record<TicketStatus, "success" | "warning" | "default"> = {
  Opened: "success",
  Pending: "warning",
  Closed: "default",
};

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ownerDisplayName(o: {
  firstName: string | null;
  lastName: string | null;
}) {
  return [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
}

export default function StorefrontTicketsPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const ownerIdParam = searchParams.get("ownerId") ?? "";
  const [ownerId, setOwnerId] = useState<string>(ownerIdParam);

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [ticketStatus, setTicketStatus] = useState<string>(ALL);
  const [ticketCategory, setTicketCategory] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Owners list for the selector (client-filtered via showSearch).
  const ownersQuery = useQuery({
    queryKey: ["storefront", "store-owners", "tickets-picker"],
    queryFn: async () => {
      const res = await getStorefrontOwners({ PageSize: 500, PageNumber: 1 });
      if (!res.status) throw new Error(res.message ?? "Failed to load store owners");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (ownersQuery.isError) {
      message.error(
        ownersQuery.error instanceof Error
          ? ownersQuery.error.message
          : "Unable to load store owners.",
      );
    }
  }, [ownersQuery.isError, ownersQuery.error, message]);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedKeyword.trim() || undefined,
      ticketStatus: ticketStatus !== ALL ? ticketStatus : undefined,
      ticketCategory: ticketCategory !== ALL ? ticketCategory : undefined,
    }),
    [pageSize, page, debouncedKeyword, ticketStatus, ticketCategory],
  );

  const ticketsQuery = useQuery({
    queryKey: ["storefront", "tickets", ownerId, queryParams],
    queryFn: async () => {
      if (!ownerId) return { data: [], count: 0 };
      const res = await getStorefrontTickets(ownerId, queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load tickets");
      return { data: res.data?.data ?? [], count: Number(res.data?.count ?? 0) };
    },
    enabled: !!ownerId,
  });

  function handleOwnerChange(value: string) {
    setOwnerId(value);
    setPage(1);
    setSearchParams(value ? { ownerId: value } : {}, { replace: true });
  }

  function invalidateTickets() {
    queryClient.invalidateQueries({ queryKey: ["storefront", "tickets"] });
  }

  const rows = ticketsQuery.data?.data ?? [];
  const totalItems = ticketsQuery.data?.count ?? 0;

  const columns: TableColumnsType<TicketResponse> = [
    {
      title: "Topic",
      dataIndex: "topic",
      render: (v: string) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{v}</span>
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 140,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Opened",
      dataIndex: "dateOpened",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>
      ),
    },
    {
      title: "Closed",
      dataIndex: "dateClosed",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: TicketStatus) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Button
          size="small"
          type={r.hasUnreadComment ? "primary" : "default"}
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedTicketId(r.id);
            setDetailOpen(true);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Storefront Tickets
          </Typography.Title>
          <Typography.Text type="secondary">
            Review and respond to store owner support tickets.
          </Typography.Text>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Store Owners List */}
        <Card
          className="lg:col-span-4"
          title={
            <Space>
              <UserOutlined />
              <span>Store Owners</span>
              {ownersQuery.data && (
                <Tag color="blue">{ownersQuery.data.length}</Tag>
              )}
            </Space>
          }
          styles={{ body: { padding: 0 } }}
        >
          {ownersQuery.isLoading ? (
            <div className="flex justify-center p-8">
              <Spin />
            </div>
          ) : !ownersQuery.data || ownersQuery.data.length === 0 ? (
            <Empty
              description="No store owners found"
              className="py-8"
            />
          ) : (
            <List
              dataSource={ownersQuery.data}
              renderItem={(owner) => (
                <OwnerListItem
                  owner={owner}
                  isSelected={ownerId === owner.id}
                  onClick={() => handleOwnerChange(owner.id ?? "")}
                />
              )}
            />
          )}
        </Card>

        {/* Tickets Panel */}
        <div className="lg:col-span-8 space-y-4">
          {ownerId ? (
            <>
              <Card styles={{ body: { padding: 16 } }}>
                <div className="grid gap-3 md:grid-cols-12">
                  <Input
                    className="md:col-span-5"
                    placeholder="Search by topic, description…"
                    value={keyword}
                    allowClear
                    onChange={(e) => {
                      setPage(1);
                      setKeyword(e.target.value);
                    }}
                  />
                  <Select
                    className="md:col-span-4"
                    value={ticketStatus}
                    onChange={(v) => {
                      setPage(1);
                      setTicketStatus(v);
                    }}
                    options={[
                      { value: ALL, label: "All statuses" },
                      ...TicketStatusValues.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                  <Select
                    className="md:col-span-3"
                    value={ticketCategory}
                    onChange={(v) => {
                      setPage(1);
                      setTicketCategory(v);
                    }}
                    options={[
                      { value: ALL, label: "All categories" },
                      ...TicketCategoryValues.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                </div>
              </Card>

              <Card styles={{ body: { padding: 0 } }}>
                <Table<TicketResponse>
                  rowKey="id"
                  dataSource={rows}
                  columns={columns}
                  loading={ticketsQuery.isLoading || ticketsQuery.isFetching}
                  pagination={{
                    current: page,
                    pageSize,
                    total: totalItems,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                  locale={{
                    emptyText: <Empty description="No tickets for this owner." />,
                  }}
                />
              </Card>
            </>
          ) : (
            <Card>
              <Empty
                description="Select a store owner from the list to view their tickets"
                className="py-8"
              />
            </Card>
          )}
        </div>
      </div>

      <StorefrontTicketDetailModal
        ownerId={ownerId}
        ticketId={selectedTicketId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedTicketId(null);
        }}
        onUpdated={invalidateTickets}
      />
    </div>
  );
}

function OwnerListItem({
  owner,
  isSelected,
  onClick,
}: {
  owner: StorefrontOwnerDetailDto;
  isSelected: boolean;
  onClick: () => void;
}) {
  const ownerName = ownerDisplayName(owner);
  const company = owner.companyName?.trim();
  const displayName = company || ownerName || owner.userName || "Unknown owner";

  // Fetch ticket count for this owner
  const { data: ticketCount } = useQuery({
    queryKey: ["storefront", "tickets-count", owner.id],
    queryFn: async () => {
      if (!owner.id) return 0;
      const res = await getStorefrontTickets(owner.id, { PageSize: 1, PageNumber: 1 });
      if (!res.status) return 0;
      return Number(res.data?.count ?? 0);
    },
    enabled: !!owner.id,
    staleTime: 30_000, // Cache for 30 seconds
  });

  return (
    <List.Item
      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? "bg-primary/10 border-l-4 border-primary" : ""
      }`}
      onClick={onClick}
      style={{ padding: "12px 16px" }}
    >
      <List.Item.Meta
        title={
          <div className="flex items-center justify-between">
            <span className={isSelected ? "font-semibold text-primary" : ""}>
              {displayName}
            </span>
            {ticketCount !== undefined && (
              <Badge
                count={ticketCount}
                showZero
                color={ticketCount > 0 ? "blue" : "default"}
              />
            )}
          </div>
        }
        description={
          <div className="text-xs text-gray-500">
            {company && ownerName && <div>{ownerName}</div>}
            {owner.email && <div>{owner.email}</div>}
          </div>
        }
      />
    </List.Item>
  );
}

function StorefrontTicketDetailModal({
  ownerId,
  ticketId,
  open,
  onOpenChange,
  onUpdated,
}: {
  ownerId: string;
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["storefront", "ticket", ownerId, ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const res = await getStorefrontTicket(ownerId, ticketId);
      if (!res.status) throw new Error(res.message ?? "Failed to load ticket");
      return res.data;
    },
    enabled: !!ownerId && !!ticketId && open,
  });

  useEffect(() => {
    if (!open) setComment("");
  }, [open]);

  async function addComment() {
    if (!data || !ticketId) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      message.error("Comment cannot be empty");
      return;
    }
    setPosting(true);
    const res = await addStorefrontTicketComment(ownerId, ticketId, { comment: trimmed });
    setPosting(false);
    if (!res.status) {
      message.error(res.message ?? "Failed to post comment");
      return;
    }
    setComment("");
    refetch();
    onUpdated();
  }

  return (
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
      width={760}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Card loading />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Tag>{data.category}</Tag>
            <Tag color={STATUS_COLOR[data.status]}>{data.status}</Tag>
          </div>

          <div>
            <Typography.Text type="secondary" className="text-xs uppercase">
              Description
            </Typography.Text>
            <p className="mt-1 whitespace-pre-wrap text-sm">{data.description}</p>
          </div>

          <div className="space-y-2">
            <Typography.Text strong>
              Conversation ({data.comments?.length ?? 0})
            </Typography.Text>
            {!data.comments || data.comments.length === 0 ? (
              <Empty description="No comments yet." />
            ) : (
              data.comments.map((c) => (
                <Card
                  key={c.id}
                  size="small"
                  className={c.isAdmin ? "border-primary bg-primary/5" : undefined}
                  title={
                    <span className="text-sm">
                      {c.isAdmin ? "Admin" : "Store owner"}
                    </span>
                  }
                  extra={
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(c.dateCreated)}
                    </span>
                  }
                >
                  <p className="whitespace-pre-wrap text-sm">{c.comment}</p>
                </Card>
              ))
            )}
          </div>

          {data.status !== "Closed" && (
            <div className="space-y-2">
              <Typography.Text strong>Add a comment</Typography.Text>
              <Input.TextArea
                rows={3}
                maxLength={600}
                showCount
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type your response…"
              />
              <Button
                type="primary"
                icon={<MessageOutlined />}
                loading={posting}
                onClick={addComment}
              >
                Post comment
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
