import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Skeleton,
  Descriptions,
  Divider,
  Typography,
  Table,
  Empty,
} from "antd";
import type { TableColumnsType } from "antd";
import { apiGet } from "@/lib/api";
import type { CacPersonResponse, CacRegistrationResponse } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Props {
  cacId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CacDataDetailModal({ cacId, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["cac", cacId],
    queryFn: async () => {
      if (!cacId) return null;
      const res = await apiGet<CacRegistrationResponse>(
        `CacRegistration/GetCacRegistrationById/${cacId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load CAC record");
      return res.data;
    },
    enabled: !!cacId && open,
  });

  const columns: TableColumnsType<CacPersonResponse> = [
    {
      title: "Name",
      key: "name",
      render: (_, r) =>
        [r.firstName, r.lastName].filter(Boolean).join(" ") || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Date of birth",
      dataIndex: "dateOfBirth",
      render: (v) => formatDate(v),
    },
    { title: "Occupation", dataIndex: "occupation", render: (v) => v ?? "—" },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.firstPreferredBusinessName ?? "CAC registration"}
      width={960}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <div className="space-y-5">
          <Descriptions column={{ xs: 1, md: 2 }} size="small" colon={false}>
            <Descriptions.Item label="First preferred business name">
              {data.firstPreferredBusinessName ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Second preferred business name">
              {data.secondPreferredBusinessName ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Date submitted">
              {formatDate(data.dateCreated)}
            </Descriptions.Item>
            <Descriptions.Item label="Transaction reference">
              {data.transactionReference ?? "—"}
            </Descriptions.Item>
          </Descriptions>

          {data.businessDescription && (
            <div>
              <Typography.Text type="secondary" className="text-xs uppercase">
                Business description
              </Typography.Text>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {data.businessDescription}
              </p>
            </div>
          )}

          <Divider className="!my-2" />
          <div>
            <Typography.Text strong>
              Directors ({data.directors?.length ?? 0})
            </Typography.Text>
            <Table<CacPersonResponse>
              rowKey={(r) => `${r.email}-${r.firstName}`}
              dataSource={data.directors ?? []}
              columns={columns}
              pagination={false}
              size="small"
              className="mt-2"
              locale={{ emptyText: <Empty description="None listed." /> }}
            />
          </div>
          <div>
            <Typography.Text strong>
              Secretaries ({data.secretaries?.length ?? 0})
            </Typography.Text>
            <Table<CacPersonResponse>
              rowKey={(r) => `${r.email}-${r.firstName}`}
              dataSource={data.secretaries ?? []}
              columns={columns}
              pagination={false}
              size="small"
              className="mt-2"
              locale={{ emptyText: <Empty description="None listed." /> }}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
