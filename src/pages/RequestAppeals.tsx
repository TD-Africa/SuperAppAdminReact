import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Typography,
  App as AntdApp,
  Table,
  Tag,
  Button,
  Space,
} from "antd";
import type { TableColumnsType } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { apiGet, apiPut } from "@/lib/api";
import type {
  ActionStatus,
  PaginationResponse,
  RequestAppealResponseWithUser,
} from "@/lib/types";
import { ActionStatusValues } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

function statusFor(row: { isActedOn: boolean; isAccepted: boolean }): ActionStatus {
  if (!row.isActedOn) return "PENDING";
  return row.isAccepted ? "APPROVED" : "DECLINED";
}

const STATUS_COLOR: Record<ActionStatus, "warning" | "success" | "error"> = {
  PENDING: "warning",
  APPROVED: "success",
  DECLINED: "error",
};

export default function RequestAppealsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditRequestAppeals),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [action, setAction] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (action !== ALL) params.set("action", action);
    return params;
  }, [pageSize, page, debouncedKeyword, action]);

  const queryKey = ["request-appeals", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<RequestAppealResponseWithUser>>(
        `Component/GetRequestAppeals?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load appeals");
      return res.data;
    },
  });

  async function decide(row: RequestAppealResponseWithUser, approve: boolean) {
    const prev =
      queryClient.getQueryData<PaginationResponse<RequestAppealResponseWithUser>>(
        queryKey,
      );
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<RequestAppealResponseWithUser>>(
        queryKey,
        {
          ...prev,
          data: prev.data.map((x) =>
            x.id === row.id
              ? { ...x, isActedOn: true, isAccepted: approve }
              : x,
          ),
        },
      );
    }
    const res = await apiPut<boolean>(`Component/UpdateRequestAppeal/${row.id}`, {
      isApproved: approve,
    });
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      queryClient.setQueryData(queryKey, prev);
    } else {
      message.success(res.message ?? (approve ? "Approved" : "Declined"));
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<RequestAppealResponseWithUser> = [
    { title: "Name", dataIndex: "name", render: (v) => <span className="font-medium">{v ?? "—"}</span> },
    { title: "Company", dataIndex: "company", render: (v, r) => v ?? r.companyName ?? "—" },
    { title: "Phone", dataIndex: "phone", render: (v) => <span className="text-xs">{v ?? "—"}</span> },
    {
      title: "Submitted",
      dataIndex: "dateCreated",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => {
        const s = statusFor(r);
        return <Tag color={STATUS_COLOR[s]}>{s}</Tag>;
      },
    },
    {
      title: "",
      key: "actions",
      width: 140,
      align: "right",
      render: (_, r) =>
        !r.isActedOn ? (
          <Space size={4}>
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              disabled={!canEdit}
              onClick={() => decide(r, true)}
            >
              Approve
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              disabled={!canEdit}
              onClick={() => decide(r, false)}
            />
          </Space>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Request Appeals
        </Typography.Title>
        <Typography.Text type="secondary">
          Review partner appeal submissions.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search by name, company, or phone…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={action}
            onChange={(v) => {
              setPage(1);
              setAction(v);
            }}
            options={[
              { value: ALL, label: "All" },
              ...ActionStatusValues.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<RequestAppealResponseWithUser>
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
          locale={{ emptyText: "No appeals to review." }}
        />
      </Card>
    </div>
  );
}
