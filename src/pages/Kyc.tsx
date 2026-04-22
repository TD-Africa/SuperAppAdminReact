import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Tag,
  DatePicker,
  Form,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EyeOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  CustomerResponse,
  PaginationResponse,
  UserStatus,
} from "@/lib/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { KycReviewModal } from "@/components/kyc/KycReviewModal";
import { DynamicsAccountModal } from "@/components/kyc/DynamicsAccountModal";

const { RangePicker } = DatePicker;
const ALL = "__all__";
const KYC_STATUSES: UserStatus[] = ["Pending", "Active", "Rejected", "Incomplete"];

const statusColor: Record<string, "success" | "warning" | "error" | "default"> = {
  Active: "success",
  Pending: "warning",
  Rejected: "error",
  Incomplete: "default",
};

export default function KycPage() {
  const { message } = AntdApp.useApp();
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [status, setStatus] = useState<string>("Pending");
  const [joinedRange, setJoinedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [orderRange, setOrderRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [imageTarget, setImageTarget] = useState<{
    title: string;
    url: string;
    company: string;
  } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<CustomerResponse | null>(null);
  const [dynamicsTarget, setDynamicsTarget] = useState<CustomerResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (status !== ALL) params.set("status", status);
    const [js, je] = joinedRange ?? [null, null];
    if (js) params.set("joinedStartDate", js.format("YYYY-MM-DD"));
    if (je) params.set("joinedEndDate", je.format("YYYY-MM-DD"));
    const [os, oe] = orderRange ?? [null, null];
    if (os) params.set("orderStartDate", os.format("YYYY-MM-DD"));
    if (oe) params.set("orderEndDate", oe.format("YYYY-MM-DD"));
    return params;
  }, [pageSize, page, debouncedKeyword, status, joinedRange, orderRange]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["kyc-customers", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<CustomerResponse>>(
        `User/GetUsers?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load KYC queue");
      return res.data;
    },
  });

  async function rejectCac(customer: CustomerResponse, reason: string) {
    const res = await apiPut<boolean>(`User/RejectKyc/${customer.id}`, {
      comment: reason,
    });
    if (!res.status) throw new Error(res.message ?? "Rejection failed");
    message.success(res.message ?? "CAC file rejected");
    setReviewTarget(null);
    refetch();
  }

  async function rejectUtility(customer: CustomerResponse, reason: string) {
    const res = await apiPost<boolean>(
      `User/RejectUtilityBill/${customer.id}/reject-utility-bill`,
      { comment: reason },
    );
    if (!res.status) throw new Error(res.message ?? "Rejection failed");
    message.success(res.message ?? "Utility bill rejected");
    setReviewTarget(null);
    refetch();
  }

  function handleApprove(customer: CustomerResponse) {
    setDynamicsTarget(customer);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<CustomerResponse> = [
    { title: "Company", dataIndex: "companyName", render: (v) => <span className="font-medium">{v ?? "—"}</span> },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    {
      title: "Joined",
      dataIndex: "dateCreated",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    {
      title: "Last order",
      dataIndex: "lastOrderDate",
      render: (v) => <span className="text-xs text-muted-foreground">{v ? formatDate(v) : "—"}</span>,
    },
    {
      title: "CAC",
      key: "cac",
      render: (_, r) =>
        r.cac_FileName ? (
          <Button
            size="small"
            type="link"
            icon={<FileTextOutlined />}
            onClick={() =>
              setImageTarget({
                title: "CAC file",
                url: r.cac_FileName!,
                company: r.companyName ?? "",
              })
            }
          >
            View
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      title: "Utility",
      key: "utility",
      render: (_, r) =>
        r.utility_FileName ? (
          <Button
            size="small"
            type="link"
            icon={<FileTextOutlined />}
            onClick={() =>
              setImageTarget({
                title: "Utility bill",
                url: r.utility_FileName!,
                company: r.companyName ?? "",
              })
            }
          >
            View
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "userStatus",
      render: (v: UserStatus) => <Tag color={statusColor[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "",
      key: "review",
      width: 60,
      align: "right",
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setReviewTarget(r)} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          KYC
        </Typography.Title>
        <Typography.Text type="secondary">
          Review customer CAC files and utility bills; approve to provision on Dynamics.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Form layout="vertical">
          <div className="grid gap-3 md:grid-cols-12">
            <Form.Item className="md:col-span-8 !mb-0" label="Search">
              <Input
                placeholder="Search by company, email, phone, Dynamics ID…"
                value={keyword}
                allowClear
                onChange={(e) => {
                  setPage(1);
                  setKeyword(e.target.value);
                }}
              />
            </Form.Item>
            <Form.Item className="md:col-span-4 !mb-0" label="Status">
              <Select
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                options={[
                  { value: ALL, label: "All" },
                  ...KYC_STATUSES.map((s) => ({ value: s, label: s })),
                ]}
              />
            </Form.Item>
            <Form.Item className="md:col-span-6 !mb-0" label="Joined date range">
              <RangePicker
                className="w-full"
                value={joinedRange}
                onChange={(v) => setJoinedRange(v ? [v[0], v[1]] : null)}
              />
            </Form.Item>
            <Form.Item className="md:col-span-6 !mb-0" label="Order date range">
              <RangePicker
                className="w-full"
                value={orderRange}
                onChange={(v) => setOrderRange(v ? [v[0], v[1]] : null)}
              />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CustomerResponse>
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
          locale={{ emptyText: "No KYC submissions match the current filters." }}
        />
      </Card>

      <ImageViewerModal
        open={!!imageTarget}
        onOpenChange={(v) => !v && setImageTarget(null)}
        title={imageTarget?.title ?? ""}
        subtitle={imageTarget?.company}
        url={imageTarget?.url}
      />

      <KycReviewModal
        customer={reviewTarget}
        open={!!reviewTarget}
        onOpenChange={(v) => !v && setReviewTarget(null)}
        onApprove={handleApprove}
        onRejectCac={rejectCac}
        onRejectUtility={rejectUtility}
      />

      <DynamicsAccountModal
        customer={dynamicsTarget}
        open={!!dynamicsTarget}
        onOpenChange={(v) => !v && setDynamicsTarget(null)}
        onApproved={() => {
          setReviewTarget(null);
          refetch();
        }}
      />
    </div>
  );
}
