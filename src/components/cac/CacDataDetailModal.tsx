import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Skeleton,
  Descriptions,
  Typography,
  Table,
  Tag,
  Empty,
} from "antd";
import type { TableColumnsType } from "antd";
import { apiGet } from "@/lib/api";
import type { CacPersonResponse, CacRegistrationResponse } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

interface Props {
  cacId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Several fields below are optional on CacRegistrationResponse because the API
 * does not return them yet. Every row and section is omitted when its value is
 * absent, so the modal shows only what the backend actually sent.
 */
export function CacDataDetailModal({ cacId, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["cac", cacId],
    queryFn: async () => {
      if (!cacId) return null;
      const res = await apiGet<CacRegistrationResponse>(
        `CacRegistration/GetCacRegistrationById?id=${cacId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load CAC record");
      return res.data;
    },
    enabled: !!cacId && open,
  });

  const fullName = (p: CacPersonResponse) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ") || "—";

  const personColumns: TableColumnsType<CacPersonResponse> = [
    {
      title: "Name",
      key: "name",
      render: (_, r) => <span className="font-medium">{fullName(r)}</span>,
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <div className="text-xs leading-5">
          <div>{r.email ?? "—"}</div>
          {r.phoneNumber && (
            <div className="text-muted-foreground">{r.phoneNumber}</div>
          )}
        </div>
      ),
    },
    {
      title: "Date of birth",
      dataIndex: "dateOfBirth",
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    { title: "Occupation", dataIndex: "occupation", render: (v) => v ?? "—" },
    {
      title: "ID number",
      dataIndex: "idNumber",
      render: (v) => <span className="text-xs">{v ?? "—"}</span>,
    },
    {
      title: "Home address",
      dataIndex: "homeAddress",
      render: (v) => (
        <span className="block max-w-[260px] text-xs text-muted-foreground">
          {v ?? "—"}
        </span>
      ),
    },
  ];

  // Only the rows the API actually returned, so the panel never fills with dashes.
  const businessRows: { label: string; value: React.ReactNode }[] = [];
  if (data) {
    const add = (label: string, value: React.ReactNode, present: boolean) => {
      if (present) businessRows.push({ label, value });
    };
    add(
      "First preferred name",
      data.firstPreferredBusinessName,
      !!data.firstPreferredBusinessName,
    );
    add(
      "Second preferred name",
      data.secondPreferredBusinessName,
      !!data.secondPreferredBusinessName,
    );
    add("Registration type", data.businessRegType, !!data.businessRegType);
    add("Company email", data.companyEmail, !!data.companyEmail);
    add("Company phone", data.companyPhone, !!data.companyPhone);
    add("Share capital", data.shareCapital, !!data.shareCapital);
    add("Shareholding ratio", data.shareholdingRatio, !!data.shareholdingRatio);
    add(
      "Head office address",
      data.companyHeadOfficeAddress,
      !!data.companyHeadOfficeAddress,
    );
    add("Submitted", formatDateTime(data.dateCreated), !!data.dateCreated);
    add("Applicant", data.applicantName ?? data.applicantEmail, !!(data.applicantName ?? data.applicantEmail));
    add(
      "Transaction reference",
      data.transactionReference,
      !!data.transactionReference,
    );
    add(
      "Registration fee",
      formatCurrency(data.cost, "NGN"),
      data.cost != null,
    );
  }

  const statusTags = data ? (
    <div className="flex flex-wrap gap-2">
      {data.regStatus && <Tag>{data.regStatus}</Tag>}
      {data.isCacRegFeePaid != null && (
        <Tag color={data.isCacRegFeePaid ? "green" : "orange"}>
          {data.isCacRegFeePaid ? "Fee paid" : "Fee unpaid"}
        </Tag>
      )}
      {data.isRegCompleted != null && (
        <Tag color={data.isRegCompleted ? "green" : "blue"}>
          {data.isRegCompleted ? "Registration complete" : "In progress"}
        </Tag>
      )}
    </div>
  ) : null;

  const hasStatus =
    !!data &&
    (!!data.regStatus ||
      data.isCacRegFeePaid != null ||
      data.isRegCompleted != null);

  const section = (title: string, count: number, node: React.ReactNode) => (
    <div>
      <Typography.Text strong>
        {title} ({count})
      </Typography.Text>
      <div className="mt-2">{node}</div>
    </div>
  );

  const peopleTable = (rows: CacPersonResponse[]) => (
    <Table<CacPersonResponse>
      rowKey={(r, i) => r.id ?? `${r.email ?? "person"}-${i}`}
      dataSource={rows}
      columns={personColumns}
      pagination={false}
      size="small"
      scroll={{ x: "max-content" }}
      locale={{ emptyText: <Empty description="None listed." /> }}
    />
  );

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.firstPreferredBusinessName ?? "CAC registration"}
      width={1080}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="space-y-5">
          {hasStatus && statusTags}

          {businessRows.length > 0 && (
            <Descriptions column={{ xs: 1, md: 2 }} size="small" colon={false} bordered>
              {businessRows.map((r) => (
                <Descriptions.Item key={r.label} label={r.label}>
                  {r.value}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}

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

          {data.objectiveOfBusiness && (
            <div>
              <Typography.Text type="secondary" className="text-xs uppercase">
                Objective of business
              </Typography.Text>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {data.objectiveOfBusiness}
              </p>
            </div>
          )}

          {data.proprietor &&
            section("Proprietor", 1, peopleTable([data.proprietor]))}

          {section(
            "Directors",
            data.directors?.length ?? 0,
            peopleTable(data.directors ?? []),
          )}

          {section(
            "Secretaries",
            data.secretaries?.length ?? 0,
            peopleTable(data.secretaries ?? []),
          )}
        </div>
      )}
    </Modal>
  );
}
