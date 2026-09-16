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
import {
  CAC_TYPE_COLOR,
  CAC_TYPE_LABEL,
  cacRegistrationType,
} from "@/lib/cacRegistrationType";
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

  const regType = data ? cacRegistrationType(data) : null;
  const isLlc = regType === "llc";

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
    add(isLlc ? "Company email" : "Business email", data.companyEmail, !!data.companyEmail);
    add(isLlc ? "Company phone" : "Business phone", data.companyPhone, !!data.companyPhone);
    // Share capital and shareholding only exist on the LLC flow.
    add("Share capital", data.shareCapital, isLlc && !!data.shareCapital);
    add(
      "Shareholding ratio",
      data.shareholdingRatio,
      isLlc && !!data.shareholdingRatio,
    );
    add(
      isLlc ? "Head office address" : "Business address",
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

  const statusTags = data && regType ? (
    <div className="flex flex-wrap gap-2">
      <Tag color={CAC_TYPE_COLOR[regType]}>{CAC_TYPE_LABEL[regType]}</Tag>
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

  const section = (title: string, count: number, node: React.ReactNode) => (
    <div>
      <Typography.Text strong>
        {title} ({count})
      </Typography.Text>
      <div className="mt-2">{node}</div>
    </div>
  );

  const peopleTable = (rows: CacPersonResponse[], emptyText = "None listed.") => (
    <Table<CacPersonResponse>
      rowKey={(r, i) => r.id ?? `${r.email ?? "person"}-${i}`}
      dataSource={rows}
      columns={personColumns}
      pagination={false}
      size="small"
      scroll={{ x: "max-content" }}
      locale={{ emptyText: <Empty description={emptyText} /> }}
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
          {statusTags}

          {businessRows.length > 0 && (
            <Descriptions column={{ xs: 1, md: 2 }} size="small" colon={false} bordered>
              {businessRows.map((r) => (
                <Descriptions.Item key={r.label} label={r.label}>
                  {r.value}
                </Descriptions.Item>
              ))}
            </Descriptions>
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

          {/*
            A business name has one proprietor; an LLC has directors and
            secretaries. Only the sections that belong to this record's flow are
            rendered, so an LLC never shows an empty proprietor panel.
          */}
          {isLlc ? (
            <>
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
            </>
          ) : (
            section(
              "Proprietor",
              data.proprietor ? 1 : 0,
              peopleTable(
                data.proprietor ? [data.proprietor] : [],
                "The API does not return the proprietor on this endpoint yet.",
              ),
            )
          )}
        </div>
      )}
    </Modal>
  );
}
