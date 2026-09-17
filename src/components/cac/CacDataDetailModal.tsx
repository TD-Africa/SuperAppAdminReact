import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Skeleton,
  Descriptions,
  Typography,
  Table,
  Tag,
  Empty,
  Button,
  Tooltip,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DownloadOutlined,
  FileZipOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import {
  downloadCacRegistration,
  downloadCacRegistrationWithDocuments,
} from "@/lib/cacExports";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import type { CacPersonResponse, CacRegistrationResponse } from "@/lib/types";
import {
  CAC_TYPE_COLOR,
  CAC_TYPE_LABEL,
  cacRegistrationType,
} from "@/lib/cacRegistrationType";
import { formatDate, formatDateTime } from "@/lib/utils";

interface Props {
  cacId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every row and section is omitted when its value is absent, so the modal shows
 * only what the backend actually sent.
 */
export function CacDataDetailModal({ cacId, open, onOpenChange }: Props) {
  const { message, modal } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const canCreateUser = useAuthStore((s) =>
    s.hasPermission(Permission.CanCreateUser),
  );
  const [exporting, setExporting] = useState<"sheet" | "docs" | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

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

  async function exportRecord(kind: "sheet" | "docs") {
    if (!cacId) return;
    setExporting(kind);
    try {
      const err =
        kind === "docs"
          ? await downloadCacRegistrationWithDocuments(cacId)
          : await downloadCacRegistration(cacId);
      if (err) message.error(err);
      else message.success("Download started.");
    } finally {
      setExporting(null);
    }
  }

  /**
   * Creates the SuperApp account for the registrant once their CAC registration
   * has come through. The endpoint keys off the prospective-customer id, which
   * is `registrant.id` (the same value as the record's `applicationUserId`).
   *
   * Confirmed first because it is not idempotent server-side — nothing stops a
   * second run — and it emails the registrant their sign-in credentials.
   */
  async function createUser() {
    const registrant = data?.registrant;
    if (!registrant) return;
    setCreatingUser(true);
    try {
      const res = await apiPost<boolean>(
        `CacRegistration/CreateUserAfterCACIsRegistered?prospectiveUserId=${encodeURIComponent(registrant.id)}`,
      );
      if (res.status && res.data) {
        message.success(
          `Account created for ${registrant.email ?? "the registrant"}. Their credentials have been emailed to them.`,
        );
      } else {
        message.error(res.message ?? "Could not create the account.");
      }
      // Refetch either way: the endpoint reports success even when Identity
      // rejects the user, so `hasSuperAppAccount` is the only reliable signal.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cac", cacId] }),
        queryClient.invalidateQueries({ queryKey: ["cac-registrations"] }),
      ]);
    } finally {
      setCreatingUser(false);
    }
  }

  function confirmCreateUser() {
    const registrant = data?.registrant;
    if (!registrant) return;
    modal.confirm({
      title: "Create SuperApp account?",
      content: `An account will be created for ${[registrant.firstName, registrant.lastName].filter(Boolean).join(" ") || "this registrant"} (${registrant.email ?? "no email on file"}), and their sign-in credentials will be emailed to them. This cannot be undone.`,
      okText: "Create account",
      onOk: createUser,
    });
  }

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
  }

  const registrant = data?.registrant ?? null;

  // The registrant's own details, and whether their SuperApp account exists yet.
  const registrantRows: { label: string; value: React.ReactNode }[] = [];
  if (registrant) {
    const name = [registrant.firstName, registrant.lastName]
      .filter(Boolean)
      .join(" ");
    if (name) registrantRows.push({ label: "Name", value: name });
    if (registrant.email)
      registrantRows.push({ label: "Email", value: registrant.email });
    if (registrant.phoneNumber)
      registrantRows.push({ label: "Phone", value: registrant.phoneNumber });
    if (registrant.dateCreated)
      registrantRows.push({
        label: "Registered",
        value: formatDateTime(registrant.dateCreated),
      });
  }

  const statusTags = data && regType ? (
    <div className="flex flex-wrap gap-2">
      <Tag color={CAC_TYPE_COLOR[regType]}>{CAC_TYPE_LABEL[regType]}</Tag>
      {registrant && (
        <Tag color={registrant.hasSuperAppAccount ? "green" : "orange"}>
          {registrant.hasSuperAppAccount
            ? "SuperApp account created"
            : "No SuperApp account"}
        </Tag>
      )}
      {registrant?.isRegistered && <Tag color="green">CAC registered</Tag>}
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

  // The account action needs a prospective-customer row to key off. Registrations
  // submitted by an already-onboarded partner have no `registrant`, and the
  // endpoint would fail on a null lookup, so it is disabled with the reason shown.
  const createUserBlockedReason = !registrant
    ? "This registration was not submitted by a prospective customer, so there is no account to create."
    : registrant.hasSuperAppAccount
      ? "This registrant already has a SuperApp account."
      : !canCreateUser
        ? "You do not have permission to create users."
        : null;

  const footer = data ? (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        icon={<DownloadOutlined />}
        loading={exporting === "sheet"}
        disabled={exporting !== null}
        onClick={() => exportRecord("sheet")}
      >
        Export record
      </Button>
      <Button
        icon={<FileZipOutlined />}
        loading={exporting === "docs"}
        disabled={exporting !== null}
        onClick={() => exportRecord("docs")}
      >
        Export record with documents
      </Button>
      <Tooltip title={createUserBlockedReason ?? ""}>
        {/* span keeps the tooltip alive while the button is disabled */}
        <span>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            loading={creatingUser}
            disabled={!!createUserBlockedReason}
            onClick={confirmCreateUser}
          >
            Create SuperApp account
          </Button>
        </span>
      </Tooltip>
    </div>
  ) : null;

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.firstPreferredBusinessName ?? "CAC registration"}
      width={1080}
      footer={footer}
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

          {registrantRows.length > 0 && (
            <div>
              <Typography.Text strong>Registrant</Typography.Text>
              <Descriptions
                className="mt-2"
                column={{ xs: 1, md: 2 }}
                size="small"
                colon={false}
                bordered
              >
                {registrantRows.map((r) => (
                  <Descriptions.Item key={r.label} label={r.label}>
                    {r.value}
                  </Descriptions.Item>
                ))}
              </Descriptions>
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
                "No proprietor recorded on this registration.",
              ),
            )
          )}
        </div>
      )}
    </Modal>
  );
}
