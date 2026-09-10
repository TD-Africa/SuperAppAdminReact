import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Input,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { apiDelete, apiGet } from "@/lib/api";
import type { ExchangeRateResponse, ExchangeRateSummaryDto } from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SetRateModal } from "@/components/exchangeRates/SetRateModal";
import { RateHistoryModal } from "@/components/exchangeRates/RateHistoryModal";

type SourceFilter = "all" | "override" | "base";

// The rate target a modal is currently pointed at. `brandId: null` is the
// platform base rate.
interface RateTarget {
  brandId: string | null;
  brandName?: string | null;
  currentRate?: number | null;
}

export default function ExchangeRatesPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canManage = useAuthStore((s) =>
    s.hasPermission(Permission.ManageExchangeRate),
  );

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [source, setSource] = useState<SourceFilter>("all");

  const [editTarget, setEditTarget] = useState<RateTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<RateTarget | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ExchangeRateSummaryDto | null>(
    null,
  );

  const baseQuery = useQuery({
    queryKey: ["exchange-rate-base"],
    queryFn: async () => {
      const res = await apiGet<ExchangeRateResponse>(
        "ExchangeRate/GetBaseRate/base",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load base rate");
      return res.data;
    },
  });

  const ratesQuery = useQuery({
    queryKey: ["exchange-rates-effective"],
    queryFn: async () => {
      const res = await apiGet<ExchangeRateSummaryDto[]>(
        "ExchangeRate/GetAllEffectiveRates",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load rates");
      return res.data ?? [];
    },
  });

  // A rate change moves both the base card and every brand inheriting it, so
  // refresh the pair together — and drop cached history for the edited target.
  function refreshRates() {
    queryClient.invalidateQueries({ queryKey: ["exchange-rate-base"] });
    queryClient.invalidateQueries({ queryKey: ["exchange-rates-effective"] });
    queryClient.invalidateQueries({ queryKey: ["exchange-rate-history"] });
  }

  async function removeOverride(brand: ExchangeRateSummaryDto) {
    const res = await apiDelete<boolean>(
      `ExchangeRate/RemoveBrandRate/brand/${brand.brandId}`,
    );
    if (!res.status) {
      message.error(res.message ?? "Failed to remove override");
      return;
    }
    message.success(
      res.message ??
        `${brand.brandName ?? "Brand"} now follows the base rate`,
    );
    refreshRates();
  }

  const allRows = ratesQuery.data ?? [];

  const rows = useMemo(() => {
    const term = debouncedKeyword.trim().toLowerCase();
    return allRows.filter((r) => {
      if (source === "override" && !r.isOverride) return false;
      if (source === "base" && r.isOverride) return false;
      if (term && !(r.brandName ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allRows, debouncedKeyword, source]);

  const overrideCount = allRows.filter((r) => r.isOverride).length;
  const baseRate = baseQuery.data;

  const columns: TableColumnsType<ExchangeRateSummaryDto> = [
    {
      title: "Brand",
      dataIndex: "brandName",
      render: (v: string | null) => (
        <span className="font-medium">{v ?? "—"}</span>
      ),
      sorter: (a, b) => (a.brandName ?? "").localeCompare(b.brandName ?? ""),
    },
    {
      title: "Effective rate",
      dataIndex: "effectiveRate",
      width: 150,
      align: "right",
      render: (v: number) => <span className="font-medium">₦{formatNumber(v)}</span>,
      sorter: (a, b) => a.effectiveRate - b.effectiveRate,
    },
    {
      title: "Source",
      dataIndex: "isOverride",
      width: 130,
      render: (v: boolean) =>
        v ? (
          <Tag color="gold" className="!m-0">
            Brand override
          </Tag>
        ) : (
          <Tag className="!m-0">Base rate</Tag>
        ),
    },
    {
      title: "Dollar purchasable",
      dataIndex: "isDollarPurchasable",
      width: 170,
      render: (v: boolean) =>
        v ? (
          <Tag color="green" className="!m-0">
            Yes
          </Tag>
        ) : (
          <Tag className="!m-0">No</Tag>
        ),
      filters: [
        { text: "Yes", value: true },
        { text: "No", value: false },
      ],
      onFilter: (value, record) => record.isDollarPurchasable === value,
    },
    {
      title: "Effective from",
      dataIndex: "effectiveFrom",
      width: 190,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(v)}</span>
      ),
      sorter: (a, b) =>
        new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime(),
    },
    {
      title: "",
      key: "actions",
      width: 132,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Rate history">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() =>
                setHistoryTarget({ brandId: r.brandId, brandName: r.brandName })
              }
            />
          </Tooltip>
          {canManage && (
            <Tooltip title={r.isOverride ? "Edit override" : "Set override"}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() =>
                  setEditTarget({
                    brandId: r.brandId,
                    brandName: r.brandName,
                    currentRate: r.effectiveRate,
                  })
                }
              />
            </Tooltip>
          )}
          {canManage && r.isOverride && (
            <Tooltip title="Remove override">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setRemoveTarget(r)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Exchange Rates
        </Typography.Title>
        <Typography.Text type="secondary">
          The naira-per-dollar rate used to price products. Brands follow the base
          rate unless given an override.
        </Typography.Text>
      </div>

      <Card>
        {baseQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : baseQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Could not load the base rate"
            description={(baseQuery.error as Error).message}
            action={
              <Button size="small" onClick={() => baseQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Statistic
                title="Base rate"
                value={baseRate ? formatNumber(baseRate.rate) : "Not set"}
                prefix={baseRate ? "₦" : undefined}
                suffix={baseRate ? "/ $1" : undefined}
              />
              {baseRate ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>
                    In force since {formatDateTime(baseRate.effectiveFrom)}
                    {baseRate.createdBy ? ` · set by ${baseRate.createdBy}` : ""}
                  </div>
                  {baseRate.reason && <div>Reason: {baseRate.reason}</div>}
                  <div>
                    {overrideCount === 0
                      ? "Every brand follows this rate."
                      : `${overrideCount} brand${overrideCount === 1 ? "" : "s"} override this rate.`}
                  </div>
                </div>
              ) : (
                <Typography.Text type="secondary" className="text-xs">
                  No base rate has been set yet.
                </Typography.Text>
              )}
            </div>

            <Space wrap>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setHistoryTarget({ brandId: null })}
              >
                History
              </Button>
              {canManage && (
                <Button
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={() =>
                    setEditTarget({
                      brandId: null,
                      currentRate: baseRate?.rate ?? null,
                    })
                  }
                >
                  {baseRate ? "Update base rate" : "Set base rate"}
                </Button>
              )}
            </Space>
          </div>
        )}
      </Card>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-8"
            placeholder="Search brands by name…"
            value={keyword}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Segmented<SourceFilter>
            className="md:col-span-4"
            block
            value={source}
            onChange={setSource}
            options={[
              { value: "all", label: "All brands" },
              { value: "override", label: "Overridden" },
              { value: "base", label: "Following base" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        {ratesQuery.isError ? (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message="Could not load brand rates"
              description={(ratesQuery.error as Error).message}
              action={
                <Button size="small" onClick={() => ratesQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : (
          <Table<ExchangeRateSummaryDto>
            rowKey="brandId"
            dataSource={rows}
            columns={columns}
            loading={ratesQuery.isLoading || ratesQuery.isFetching}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `${total} brand${total === 1 ? "" : "s"}`,
            }}
            locale={{ emptyText: "No brands match these filters" }}
          />
        )}
      </Card>

      <SetRateModal
        open={editTarget !== null}
        onOpenChange={(v) => {
          if (!v) setEditTarget(null);
        }}
        brandId={editTarget?.brandId ?? null}
        brandName={editTarget?.brandName}
        currentRate={editTarget?.currentRate ?? null}
        onSaved={refreshRates}
      />

      <RateHistoryModal
        open={historyTarget !== null}
        onOpenChange={(v) => {
          if (!v) setHistoryTarget(null);
        }}
        brandId={historyTarget?.brandId ?? null}
        brandName={historyTarget?.brandName}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(v) => {
          if (!v) setRemoveTarget(null);
        }}
        title="Remove brand override?"
        description={
          removeTarget
            ? `${removeTarget.brandName ?? "This brand"} will fall back to the base rate${
                baseRate ? ` of ₦${formatNumber(baseRate.rate)} per $1` : ""
              }. Its rate history is kept.`
            : undefined
        }
        confirmLabel="Remove override"
        destructive
        onConfirm={async () => {
          if (removeTarget) await removeOverride(removeTarget);
        }}
      />
    </div>
  );
}
