import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Table, Tag, Empty, Typography } from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import { apiGet } from "@/lib/api";
import type {
  AbandonedCartUserDTO,
  PaginationResponse,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: Dayjs | null;
  endDate: Dayjs | null;
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 365) return `${Math.floor(days / 365)} year(s) ago`;
  if (days >= 30) return `${Math.floor(days / 30)} month(s) ago`;
  if (days >= 1) return `${days} day(s) ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours} hour(s) ago`;
  const minutes = Math.floor(ms / 60000);
  if (minutes >= 1) return `${minutes} minute(s) ago`;
  return "Just now";
}

export function AbandonedCartUsersModal({
  open,
  onOpenChange,
  startDate,
  endDate,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("pageNumber", String(page));
    params.set("pageSize", String(pageSize));
    if (startDate) params.set("startDate", startDate.toDate().toISOString());
    if (endDate) params.set("endDate", endDate.toDate().toISOString());
    return params;
  }, [page, pageSize, startDate, endDate]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["abandoned-cart-users", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<AbandonedCartUserDTO>>(
        `Component/GetAbandonedCartUsers/abandoned-carts/users?${queryParams.toString()}`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load abandoned carts");
      return res.data;
    },
    enabled: open,
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<AbandonedCartUserDTO> = [
    {
      title: "User Email",
      dataIndex: "email",
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Last Updated",
      dataIndex: "lastUpdated",
      render: (v: string) => (
        <div>
          <div className="text-sm">
            {new Date(v).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="text-xs text-muted-foreground">{timeAgo(v)}</div>
        </div>
      ),
    },
    {
      title: "Products",
      key: "productCount",
      width: 120,
      render: (_, r) => (
        <Tag color="blue">{r.cartProducts?.length ?? 0} item(s)</Tag>
      ),
    },
    {
      title: "Total Quantity",
      key: "totalQuantity",
      width: 140,
      render: (_, r) => (
        <Tag>
          {(r.cartProducts ?? []).reduce((acc, p) => acc + p.quantity, 0)}
        </Tag>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="Abandoned Cart Users"
      width={1000}
      footer={null}
      destroyOnClose
    >
      {totalItems > 0 && (
        <Typography.Text strong className="mb-3 block">
          Total Users with Abandoned Carts: {totalItems.toLocaleString()}
        </Typography.Text>
      )}
      <Table<AbandonedCartUserDTO>
        rowKey={(r) => r.cartId ?? r.userId}
        dataSource={rows}
        columns={columns}
        loading={isLoading || isFetching}
        pagination={{
          current: page,
          pageSize,
          total: totalItems,
          showSizeChanger: true,
          pageSizeOptions: [10, 25, 50, 100],
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        size="middle"
        locale={{
          emptyText: (
            <Empty description="No abandoned cart users for the selected date range." />
          ),
        }}
      />
    </Modal>
  );
}
