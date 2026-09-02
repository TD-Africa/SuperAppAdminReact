import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Table,
  Tabs,
  Tag,
  Input,
  Button,
  Empty,
  Alert,
  Space,
  Typography,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import { UserAddOutlined, StopOutlined } from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import type {
  BrandAuthorizationChangeResultDto,
  BrandPartnerDto,
  BrandRestrictionSummaryDto,
  PaginationResponse,
} from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type Mode = "authorized" | "eligible";

const ENDPOINT: Record<Mode, (brandId: string) => string> = {
  authorized: (id) => `Brand/GetBrandPartners/${id}/partners`,
  eligible: (id) => `Brand/GetEligibleBrandPartners/${id}/eligible-partners`,
};

const NOTES_MAX = 500;

function partnerName(p: BrandPartnerDto): string {
  const person = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return p.companyName || person || p.email || "—";
}

function PartnerCell({ partner }: { partner: BrandPartnerDto }) {
  const person = [partner.firstName, partner.lastName].filter(Boolean).join(" ");
  // Avoid repeating the company name underneath itself when there is no
  // separate contact person on the account.
  const sub = partner.companyName ? person || partner.email : partner.email;
  return (
    <div className="max-w-[260px]">
      <div className="truncate font-medium">{partnerName(partner)}</div>
      {sub && (
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

interface PanelProps {
  brandId: string | null;
  mode: Mode;
  /** Only the visible tab queries, so switching tabs doesn't double-fetch. */
  active: boolean;
  canEdit: boolean;
  pending: boolean;
  onAction: (userIds: string[], notes: string) => Promise<boolean>;
}

function PartnerPanel({
  brandId,
  mode,
  active,
  canEdit,
  pending,
  onAction,
}: PanelProps) {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const isGrant = mode === "eligible";

  // A different brand means a different partner set — drop any carried-over
  // page, search and selection.
  useEffect(() => {
    setKeyword("");
    setPage(1);
    setSelected([]);
    setNotes("");
  }, [brandId]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim())
      params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["brand-partners", mode, brandId, queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<BrandPartnerDto>>(
        `${ENDPOINT[mode](brandId!)}?${queryParams.toString()}`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load partners");
      return res.data;
    },
    enabled: active && !!brandId,
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  async function submit() {
    if (!selected.length) return;
    const ok = await onAction(selected, notes.trim());
    if (ok) {
      setSelected([]);
      setNotes("");
    }
  }

  const columns: TableColumnsType<BrandPartnerDto> = [
    {
      title: "Partner",
      key: "partner",
      render: (_, r) => <PartnerCell partner={r} />,
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      width: 120,
      render: (v: string | null) => (
        <span className="text-xs text-muted-foreground">{v ?? "—"}</span>
      ),
    },
    {
      title: "Sub-users",
      dataIndex: "subUserCount",
      width: 100,
      align: "right",
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      width: 96,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "default"}>{v ? "Active" : "Inactive"}</Tag>
      ),
    },
    ...(isGrant
      ? []
      : ([
          {
            title: "Authorized",
            key: "authorizedOn",
            width: 200,
            render: (_, r) => (
              <div>
                <div className="text-xs">{formatDateTime(r.authorizedOn)}</div>
                {r.authorizedBy && (
                  <div className="truncate text-xs text-muted-foreground">
                    by {r.authorizedBy}
                  </div>
                )}
              </div>
            ),
          },
          {
            title: "Notes",
            dataIndex: "notes",
            width: 200,
            render: (v: string | null) =>
              v ? (
                <Typography.Text
                  className="text-xs"
                  ellipsis={{ tooltip: v }}
                  style={{ maxWidth: 180 }}
                >
                  {v}
                </Typography.Text>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
        ] as TableColumnsType<BrandPartnerDto>)),
  ];

  return (
    <div className="space-y-3">
      <Input
        placeholder={
          isGrant
            ? "Search partners to authorize…"
            : "Search authorized partners…"
        }
        value={keyword}
        allowClear
        onChange={(e) => {
          setPage(1);
          setKeyword(e.target.value);
        }}
      />

      {canEdit && isGrant && (
        <Input.TextArea
          placeholder="Optional note recorded against these grants (e.g. approval reference)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={NOTES_MAX}
          showCount
          autoSize={{ minRows: 2, maxRows: 3 }}
        />
      )}

      {canEdit && (
        <div className="flex items-center justify-between gap-3">
          <Typography.Text type="secondary" className="text-xs">
            {selected.length
              ? `${selected.length} selected`
              : "Select partners to continue"}
          </Typography.Text>
          <Button
            type="primary"
            danger={!isGrant}
            icon={isGrant ? <UserAddOutlined /> : <StopOutlined />}
            disabled={!selected.length}
            loading={pending}
            onClick={submit}
          >
            {isGrant
              ? `Grant access${selected.length ? ` (${selected.length})` : ""}`
              : `Revoke access${selected.length ? ` (${selected.length})` : ""}`}
          </Button>
        </div>
      )}

      <Table<BrandPartnerDto>
        rowKey={(r) => r.userId ?? ""}
        dataSource={rows}
        columns={columns}
        loading={isLoading || isFetching}
        size="middle"
        scroll={{ x: 720 }}
        rowSelection={
          canEdit
            ? {
                selectedRowKeys: selected,
                onChange: (keys) => setSelected(keys as string[]),
                // Rows without a userId can't be sent to grant/revoke.
                getCheckboxProps: (r) => ({ disabled: !r.userId }),
              }
            : undefined
        }
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
        locale={{
          emptyText: (
            <Empty
              description={
                isGrant
                  ? "No partners available to authorize."
                  : "No partners are authorized on this brand yet."
              }
            />
          ),
        }}
      />
    </div>
  );
}

interface Props {
  brand: BrandRestrictionSummaryDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

export function BrandPartnersModal({
  brand,
  open,
  onOpenChange,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const { message, modal } = AntdApp.useApp();
  const [tab, setTab] = useState<Mode>("authorized");
  const [pending, setPending] = useState(false);

  const brandId = brand?.brandId ?? null;

  useEffect(() => {
    setTab("authorized");
  }, [brandId]);

  // Both endpoints return a 200 envelope even when individual users fail, so the
  // per-user `results` are the real outcome. Surface failures explicitly rather
  // than reporting a blanket success.
  function report(
    result: BrandAuthorizationChangeResultDto | null,
    verb: "granted" | "revoked",
  ) {
    const failures = (result?.results ?? []).filter((r) => !r.succeeded);
    const succeeded = result?.succeededCount ?? 0;

    if (succeeded > 0) {
      const delay = result?.propagationDelaySeconds ?? 0;
      message.success(
        `Access ${verb} for ${succeeded} partner${succeeded === 1 ? "" : "s"}.` +
          (delay > 0
            ? ` Changes may take up to ${delay}s to reach the storefront.`
            : ""),
      );
    }

    if (failures.length) {
      modal.warning({
        title: `${failures.length} partner${failures.length === 1 ? "" : "s"} could not be ${verb}`,
        width: 520,
        content: (
          <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-auto pl-5">
            {failures.map((f) => (
              <li key={f.userId ?? f.resolvedUserId} className="text-sm">
                <span className="font-medium">{f.companyName ?? f.userId}</span>
                {f.message && (
                  <span className="text-muted-foreground"> — {f.message}</span>
                )}
              </li>
            ))}
          </ul>
        ),
      });
    }

    return succeeded > 0;
  }

  async function change(
    action: "grant" | "revoke",
    userIds: string[],
    notes: string,
  ): Promise<boolean> {
    if (!brandId) return false;
    setPending(true);
    try {
      const res = await apiPost<BrandAuthorizationChangeResultDto>(
        `Brand/${action === "grant" ? "GrantBrandAccess" : "RevokeBrandAccess"}/authorizations/${action}`,
        {
          brandId,
          userIds,
          notes: notes || null,
        },
      );
      if (!res.status) {
        message.error(res.message ?? `Failed to ${action} access`);
        return false;
      }
      const changed = report(
        res.data,
        action === "grant" ? "granted" : "revoked",
      );
      if (changed) {
        // A grant moves partners out of the eligible list and into the
        // authorized one (and vice versa), and shifts the brand's partner count.
        queryClient.invalidateQueries({ queryKey: ["brand-partners"] });
        queryClient.invalidateQueries({ queryKey: ["brand-restrictions"] });
        queryClient.invalidateQueries({ queryKey: ["partner-brand-access"] });
      }
      return changed;
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={
        brand ? `Partner access — ${brand.name ?? "Brand"}` : "Partner access"
      }
      width={1000}
      footer={null}
      destroyOnClose
    >
      {brand && !brand.requiresPartnerAuthorization && (
        <Alert
          type="info"
          showIcon
          className="mb-3"
          message="This brand is not restricted"
          description="Every customer can currently see and buy it. Grants below are stored but have no effect until you turn on partner authorization."
        />
      )}

      {brand && (
        <Space size={4} className="mb-3">
          <Tag>{formatNumber(brand.productCount)} products</Tag>
          <Tag color={brand.isActive ? "success" : "default"}>
            {brand.isActive ? "Active" : "Inactive"}
          </Tag>
        </Space>
      )}

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as Mode)}
        items={[
          {
            key: "authorized",
            label: `Authorized${brand ? ` (${brand.authorizedPartnerCount})` : ""}`,
            children: (
              <PartnerPanel
                brandId={brandId}
                mode="authorized"
                active={open && tab === "authorized"}
                canEdit={canEdit}
                pending={pending}
                onAction={(ids, notes) => change("revoke", ids, notes)}
              />
            ),
          },
          {
            key: "eligible",
            label: "Add partners",
            children: (
              <PartnerPanel
                brandId={brandId}
                mode="eligible"
                active={open && tab === "eligible"}
                canEdit={canEdit}
                pending={pending}
                onAction={(ids, notes) => change("grant", ids, notes)}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
}
