import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
  Switch,
  Typography,
  Avatar,
  App as AntdApp,
  Table,
  Button,
  Tooltip,
  Tag,
  Space,
} from "antd";
import type { TableColumnsType } from "antd";
import { ShopOutlined, TeamOutlined, LockOutlined } from "@ant-design/icons";
import { apiGet, apiPatch } from "@/lib/api";
import type {
  BrandRestrictionSummaryDto,
  PaginationResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatNumber } from "@/lib/utils";
import { BrandPartnersModal } from "@/components/brands/BrandPartnersModal";

const ALL = "__all__";

export default function BrandRestrictionsPage() {
  const queryClient = useQueryClient();
  const { message, modal } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [restrictedOnly, setRestrictedOnly] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [partnersBrand, setPartnersBrand] =
    useState<BrandRestrictionSummaryDto | null>(null);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim())
      params.set("SearchString", debouncedKeyword.trim());
    if (restrictedOnly !== ALL) params.set("restrictedOnly", restrictedOnly);
    return params;
  }, [pageSize, page, debouncedKeyword, restrictedOnly]);

  const queryKey = ["brand-restrictions", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<BrandRestrictionSummaryDto>>(
        `Brand/GetBrandRestrictions/authorizations?${queryParams.toString()}`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load brand restrictions");
      return res.data;
    },
  });

  async function setRestriction(
    brand: BrandRestrictionSummaryDto,
    value: boolean,
  ) {
    setSavingId(brand.brandId);
    const prev =
      queryClient.getQueryData<PaginationResponse<BrandRestrictionSummaryDto>>(
        queryKey,
      );
    if (prev?.data) {
      queryClient.setQueryData<PaginationResponse<BrandRestrictionSummaryDto>>(
        queryKey,
        {
          ...prev,
          data: prev.data.map((b) =>
            b.brandId === brand.brandId
              ? { ...b, requiresPartnerAuthorization: value }
              : b,
          ),
        },
      );
    }

    try {
      const res = await apiPatch<BrandRestrictionSummaryDto>(
        `Brand/SetBrandRestriction/${brand.brandId}/restriction`,
        { requiresPartnerAuthorization: value },
      );
      if (!res.status) {
        message.error(res.message ?? "Update failed");
        queryClient.setQueryData(queryKey, prev);
        return;
      }
      // Reconcile with the server's own summary — the counts can move as a
      // side effect of the toggle.
      const updated = res.data;
      if (updated) {
        const current =
          queryClient.getQueryData<
            PaginationResponse<BrandRestrictionSummaryDto>
          >(queryKey);
        if (current?.data) {
          queryClient.setQueryData<
            PaginationResponse<BrandRestrictionSummaryDto>
          >(queryKey, {
            ...current,
            data: current.data.map((b) =>
              b.brandId === brand.brandId ? { ...b, ...updated } : b,
            ),
          });
        }
        // Keep an open modal's header counts in step with the row.
        setPartnersBrand((p) =>
          p && p.brandId === brand.brandId ? { ...p, ...updated } : p,
        );
      }
      message.success(
        value
          ? `${brand.name ?? "Brand"} is now restricted to authorized partners.`
          : `${brand.name ?? "Brand"} is now open to all customers.`,
      );
    } finally {
      setSavingId(null);
    }
  }

  function onToggleRestriction(
    brand: BrandRestrictionSummaryDto,
    value: boolean,
  ) {
    // Restricting a brand with nobody authorized hides it from every customer.
    // That is occasionally intended, but it is destructive enough to confirm.
    if (value && brand.authorizedPartnerCount === 0) {
      modal.confirm({
        title: "Restrict this brand with no authorized partners?",
        icon: <LockOutlined />,
        width: 480,
        content: (
          <span>
            No partner is authorized on{" "}
            <strong>{brand.name ?? "this brand"}</strong> yet, so restricting it
            will hide all {formatNumber(brand.productCount)} of its products
            from every customer until you grant access.
          </span>
        ),
        okText: "Restrict anyway",
        okButtonProps: { danger: true },
        onOk: () => setRestriction(brand, true),
      });
      return;
    }
    setRestriction(brand, value);
  }

  function openPartners(brand: BrandRestrictionSummaryDto) {
    setPartnersBrand(brand);
    setPartnersOpen(true);
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<BrandRestrictionSummaryDto> = [
    {
      title: "",
      dataIndex: "brandImageUrl",
      width: 64,
      render: (v: string | null) => (
        <Avatar
          src={v ?? undefined}
          icon={!v ? <ShopOutlined /> : undefined}
          shape="square"
        />
      ),
    },
    {
      title: "Brand",
      dataIndex: "name",
      render: (v: string | null, r) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium">{v ?? "—"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.dynamicsId ?? "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 96,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "default"}>{v ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Products",
      dataIndex: "productCount",
      width: 100,
      align: "right",
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Restricted",
      dataIndex: "requiresPartnerAuthorization",
      width: 120,
      render: (v: boolean, r) => (
        <Tooltip
          title={
            v
              ? "Only authorized partners can see this brand"
              : "Visible to all customers"
          }
        >
          <Switch
            checked={v}
            disabled={!canEdit}
            loading={savingId === r.brandId}
            onChange={(val) => onToggleRestriction(r, val)}
          />
        </Tooltip>
      ),
    },
    {
      title: "Authorized partners",
      dataIndex: "authorizedPartnerCount",
      width: 170,
      align: "right",
      render: (v: number, r) => (
        <Space size={4}>
          {/* A restricted brand with nobody authorized is invisible to every
              customer — call that out rather than showing a bare zero. */}
          {r.requiresPartnerAuthorization && v === 0 ? (
            <Tag color="error">Nobody</Tag>
          ) : (
            <span className="tabular-nums">{formatNumber(v)}</span>
          )}
          <Button
            size="small"
            icon={<TeamOutlined />}
            onClick={() => openPartners(r)}
          >
            Manage
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Brand Restrictions
        </Typography.Title>
        <Typography.Text type="secondary">
          Restrict brands to authorized partners and manage who can access them.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-9"
            placeholder="Search brands by name or Dynamics ID…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={restrictedOnly}
            onChange={(v) => {
              setPage(1);
              setRestrictedOnly(v);
            }}
            options={[
              { value: ALL, label: "All brands" },
              { value: "true", label: "Restricted only" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<BrandRestrictionSummaryDto>
          rowKey="brandId"
          dataSource={rows}
          columns={columns}
          loading={isLoading || isFetching}
          scroll={{ x: 900 }}
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
        />
      </Card>

      <BrandPartnersModal
        brand={partnersBrand}
        open={partnersOpen}
        canEdit={canEdit}
        onOpenChange={(v) => {
          setPartnersOpen(v);
          if (!v) setPartnersBrand(null);
        }}
      />
    </div>
  );
}
