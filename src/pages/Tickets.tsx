import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  Input,
  Select,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Tag,
  Badge,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { apiGet, apiPut } from "@/lib/api";
import {
  TicketCategoryValues,
  TicketStatusValues,
  type PaginationResponse,
  type TicketResponse,
  type TicketStatus,
} from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { TicketDetailModal } from "@/components/tickets/TicketDetailModal";

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

export default function TicketsPage() {
  const { message } = AntdApp.useApp();
  const [searchParams] = useSearchParams();
  const isOpenParam = searchParams.get("IsOpen");

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [ticketStatus, setTicketStatus] = useState<string>(ALL);
  const [ticketCategory, setTicketCategory] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (isOpenParam === "true") setTicketStatus("Opened");
    else if (isOpenParam === "false") setTicketStatus("Closed");
  }, [isOpenParam]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (ticketStatus !== ALL) params.set("ticketStatus", ticketStatus);
    if (ticketCategory !== ALL) params.set("ticketCategory", ticketCategory);
    return params;
  }, [pageSize, page, debouncedKeyword, ticketStatus, ticketCategory]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["tickets", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<TicketResponse>>(
        `Ticket/GetTickets?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load tickets");
      return res.data;
    },
  });

  async function handleCloseTicket(ticketId: string) {
    const res = await apiPut<boolean>(`Ticket/CloseTicket/${ticketId}`);
    if (res.status) {
      message.success(res.message ?? "Ticket closed");
      refetch();
    } else {
      message.error(res.message ?? "Failed to close ticket");
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<TicketResponse> = [
    {
      title: "Topic",
      dataIndex: "topic",
      render: (v, r) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{v}</span>
          {r.hasUnreadComment && <Badge status="error" />}
        </div>
      ),
    },
    { title: "Company", dataIndex: ["user", "companyName"], render: (v) => v ?? "—" },
    { title: "Category", dataIndex: "category", render: (v) => <Tag>{v}</Tag> },
    {
      title: "Opened",
      dataIndex: "dateOpened",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>,
    },
    {
      title: "Closed",
      dataIndex: "dateClosed",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
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
            setSelectedId(r.id);
            setDetailOpen(true);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Tickets
        </Typography.Title>
        <Typography.Text type="secondary">
          Review and respond to customer support tickets.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search by topic, description, company…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
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
          loading={isLoading || isFetching}
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
          locale={{ emptyText: "No tickets match the current filters." }}
        />
      </Card>

      <TicketDetailModal
        ticketId={selectedId}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setSelectedId(null);
        }}
        onCloseTicket={handleCloseTicket}
      />
    </div>
  );
}
