import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Table,
  Tag,
  Input,
  InputNumber,
  Button,
  Select,
  Switch,
  Empty,
  Alert,
  Space,
  Spin,
  Tooltip,
  Typography,
  DatePicker,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DeleteOutlined,
  HistoryOutlined,
  PlusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  BrandPartnerDto,
  BrandRestrictionSummaryDto,
  PaginationResponse,
  PartnerAllocationDto,
  ProductReturnDto,
} from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const NOTES_MAX = 500;

/**
 * One row of the editable grid. `consumedQuantity` is server-derived and cannot
 * be edited; for a product that has never been capped the server has not told us
 * its consumption yet, so `isNew` rows render it as unknown until saved.
 */
interface DraftRow {
  productId: string;
  productName: string;
  productDynamicsId: string | null;
  allocatedQuantity: number;
  isActive: boolean;
  consumedQuantity: number | null;
  isNew: boolean;
}

function toDraft(a: PartnerAllocationDto): DraftRow {
  return {
    productId: a.productId,
    productName: a.productName,
    productDynamicsId: a.productDynamicsId,
    allocatedQuantity: a.allocatedQuantity,
    isActive: a.isActive,
    consumedQuantity: a.consumedQuantity,
    isNew: false,
  };
}

function partnerName(p: BrandPartnerDto): string {
  const person = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return p.companyName || person || p.email || "this partner";
}

interface Props {
  brand: BrandRestrictionSummaryDto | null;
  partner: BrandPartnerDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

export function PartnerAllocationsModal({
  brand,
  partner,
  open,
  onOpenChange,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const { message, modal } = AntdApp.useApp();

  const brandId = brand?.brandId ?? null;
  const userId = partner?.userId ?? null;

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetAt, setResetAt] = useState<Dayjs | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearch, 350);

  const allocationsKey = ["partner-allocations", brandId, userId];

  const {
    data: allocations,
    isLoading,
    isFetching,
    isSuccess,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: allocationsKey,
    queryFn: async () => {
      const res = await apiGet<PartnerAllocationDto[]>(
        `Brand/GetPartnerAllocations/${brandId}/partners/${userId}/allocations`,
      );
      if (!res.status)
        throw new Error(res.message ?? "Failed to load allocations");
      return res.data ?? [];
    },
    enabled: open && !!brandId && !!userId,
  });

  // Seed the editable grid from the server, discarding any edits from a
  // previously opened partner. Keyed on the fetched object so a refetch after a
  // save or reset re-syncs the grid rather than leaving it stale.
  useEffect(() => {
    setRows((allocations ?? []).map(toDraft));
    setNotes("");
    setProductSearch("");
  }, [allocations]);

  useEffect(() => {
    if (!open) return;
    setResetAt(null);
  }, [open, brandId, userId]);

  // The window start lives on the authorization, so it is the same on every row.
  const windowStart = allocations?.[0]?.allocationResetAt ?? null;

  const takenProductIds = useMemo(
    () => new Set(rows.map((r) => r.productId)),
    [rows],
  );

  // Products already in the grid are filtered out of the picker rather than
  // shown-and-disabled: re-adding one would silently overwrite its edited cap.
  const { data: productPage, isFetching: productsFetching } = useQuery({
    queryKey: ["brand-products-picker", brandId, debouncedProductSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("PageNumber", "1");
      params.set("PageSize", "25");
      if (debouncedProductSearch.trim())
        params.set("SearchString", debouncedProductSearch.trim());
      const res = await apiGet<PaginationResponse<ProductReturnDto>>(
        `Brand/GetBrandProducts/${brandId}/products?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load products");
      return res.data;
    },
    enabled: open && canEdit && !!brandId,
  });

  const productOptions = useMemo(
    () =>
      (productPage?.data ?? [])
        .filter((p) => !takenProductIds.has(p.id))
        .map((p) => ({
          value: p.id,
          label: p.dynamicsId
            ? `${p.productName} · ${p.dynamicsId}`
            : p.productName,
          product: p,
        })),
    [productPage, takenProductIds],
  );

  const dirty = useMemo(() => {
    const original = allocations ?? [];
    if (original.length !== rows.length) return true;
    return rows.some((r) => {
      const before = original.find((a) => a.productId === r.productId);
      if (!before) return true;
      return (
        before.allocatedQuantity !== r.allocatedQuantity ||
        before.isActive !== r.isActive
      );
    });
  }, [rows, allocations]);

  function addProduct(productId: string) {
    const option = productOptions.find((o) => o.value === productId);
    if (!option) return;
    setRows((prev) => [
      ...prev,
      {
        productId: option.product.id,
        productName: option.product.productName,
        productDynamicsId: option.product.dynamicsId ?? null,
        // A new cap starts at zero, which blocks the product outright. That is a
        // deliberate, visible default — an admin adding a row must type the
        // number they mean rather than inherit an arbitrary one.
        allocatedQuantity: 0,
        isActive: true,
        consumedQuantity: null,
        isNew: true,
      },
    ]);
    setProductSearch("");
  }

  function patchRow(productId: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r)),
    );
  }

  function removeRow(productId: string) {
    setRows((prev) => prev.filter((r) => r.productId !== productId));
  }

  async function save() {
    if (!brandId || !userId) return;
    setSaving(true);
    try {
      const res = await apiPut<PartnerAllocationDto[]>(
        "Brand/SetPartnerAllocations/allocations",
        {
          brandId,
          userId,
          allocations: rows.map((r) => ({
            productId: r.productId,
            allocatedQuantity: r.allocatedQuantity,
            isActive: r.isActive,
          })),
          notes: notes.trim() || null,
        },
      );
      if (!res.status) {
        message.error(res.message ?? "Failed to save allocations");
        return;
      }
      queryClient.setQueryData(allocationsKey, res.data ?? []);
      message.success(
        rows.length
          ? `Allocations saved for ${partnerName(partner!)}.`
          : `${partnerName(partner!)} is now uncapped on ${brand?.name ?? "this brand"}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmSave() {
    // The endpoint replaces the whole set, so a product dropped from the grid
    // loses its cap entirely. Name those products before committing — an
    // uncapped product is unlimited, which is the opposite of what a half-edited
    // grid looks like it is doing.
    const removed = (allocations ?? []).filter(
      (a) => !takenProductIds.has(a.productId),
    );
    if (!removed.length) {
      save();
      return;
    }
    modal.confirm({
      title: `Remove ${removed.length} cap${removed.length === 1 ? "" : "s"}?`,
      icon: <WarningOutlined />,
      width: 520,
      content: (
        <div className="space-y-2">
          <span>
            These products will become <strong>uncapped</strong> —{" "}
            {partnerName(partner!)} will be able to order any quantity of them:
          </span>
          <ul className="max-h-48 list-disc space-y-1 overflow-auto pl-5">
            {removed.map((a) => (
              <li key={a.productId} className="text-sm">
                {a.productName}
              </li>
            ))}
          </ul>
        </div>
      ),
      okText: "Save changes",
      okButtonProps: { danger: true },
      onOk: save,
    });
  }

  async function doReset(at: Dayjs | null) {
    if (!brandId || !userId) return;
    setResetting(true);
    try {
      const res = await apiPost<PartnerAllocationDto[]>(
        "Brand/ResetPartnerAllocation/allocations/reset",
        {
          brandId,
          userId,
          resetAt: at ? at.toISOString() : null,
        },
      );
      if (!res.status) {
        message.error(res.message ?? "Failed to reset the allocation window");
        return;
      }
      queryClient.setQueryData(allocationsKey, res.data ?? []);
      setResetAt(null);
      message.success("Allocation window reset — consumption starts from zero.");
    } finally {
      setResetting(false);
    }
  }

  function confirmReset() {
    const at = resetAt;
    modal.confirm({
      title: "Open a fresh allocation window?",
      icon: <HistoryOutlined />,
      width: 520,
      content: (
        <span>
          Orders placed before{" "}
          <strong>{at ? at.format("D MMM YYYY, h:mm A") : "now"}</strong> stop
          counting, so every product below returns to zero consumed for{" "}
          {partnerName(partner!)}. The caps themselves are unchanged, and the
          previous consumption cannot be restored.
        </span>
      ),
      okText: "Reset window",
      okButtonProps: { danger: true },
      onOk: () => doReset(at),
    });
  }

  const columns: TableColumnsType<DraftRow> = [
    {
      title: "Product",
      key: "product",
      render: (_, r) => (
        <div className="max-w-[260px]">
          <div className="truncate font-medium">{r.productName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.productDynamicsId ?? "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Cap (units)",
      key: "allocatedQuantity",
      width: 130,
      render: (_, r) => (
        <InputNumber
          min={0}
          precision={0}
          className="w-full"
          disabled={!canEdit}
          value={r.allocatedQuantity}
          onChange={(v) =>
            patchRow(r.productId, { allocatedQuantity: Number(v ?? 0) })
          }
        />
      ),
    },
    {
      title: "Consumed",
      key: "consumedQuantity",
      width: 110,
      align: "right",
      render: (_, r) =>
        r.consumedQuantity == null ? (
          <Tooltip title="Calculated once this cap is saved">
            <span className="text-xs text-muted-foreground">—</span>
          </Tooltip>
        ) : (
          <span className="tabular-nums">
            {formatNumber(r.consumedQuantity)}
          </span>
        ),
    },
    {
      title: "Remaining",
      key: "remaining",
      width: 130,
      align: "right",
      render: (_, r) => {
        if (r.consumedQuantity == null)
          return <span className="text-xs text-muted-foreground">—</span>;
        if (!r.isActive)
          return <Tag color="default">Uncapped</Tag>;
        const over = r.consumedQuantity > r.allocatedQuantity;
        if (over)
          return (
            <Tooltip
              title={`Over by ${formatNumber(
                r.consumedQuantity - r.allocatedQuantity,
              )} units — no further orders until the cap rises or the window resets`}
            >
              <Tag color="error">Over allocated</Tag>
            </Tooltip>
          );
        const remaining = r.allocatedQuantity - r.consumedQuantity;
        return (
          <Tag color={remaining === 0 ? "warning" : "success"}>
            {formatNumber(remaining)} left
          </Tag>
        );
      },
    },
    {
      title: "Enforced",
      key: "isActive",
      width: 100,
      render: (_, r) => (
        <Tooltip
          title={
            r.isActive
              ? "The cap is enforced at checkout"
              : "The cap is stored but not enforced — the partner is effectively uncapped"
          }
        >
          <Switch
            size="small"
            checked={r.isActive}
            disabled={!canEdit}
            onChange={(v) => patchRow(r.productId, { isActive: v })}
          />
        </Tooltip>
      ),
    },
    ...(canEdit
      ? ([
          {
            title: "",
            key: "actions",
            width: 56,
            render: (_, r) => (
              <Tooltip title="Remove the cap (product becomes unlimited)">
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRow(r.productId)}
                />
              </Tooltip>
            ),
          },
        ] as TableColumnsType<DraftRow>)
      : []),
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={
        partner
          ? `Allocations — ${partnerName(partner)}`
          : "Partner allocations"
      }
      width={1000}
      destroyOnClose
      footer={
        canEdit
          ? [
              <Button key="cancel" onClick={() => onOpenChange(false)}>
                Close
              </Button>,
              <Button
                key="save"
                type="primary"
                loading={saving}
                // Saving replaces the whole set, so committing a grid we never
                // successfully loaded would wipe every existing cap.
                disabled={!isSuccess || !dirty}
                onClick={confirmSave}
              >
                Save allocations
              </Button>,
            ]
          : null
      }
    >
      {brand && (
        <Space size={4} className="mb-3" wrap>
          <Tag>{brand.name ?? "Brand"}</Tag>
          {!brand.requiresPartnerAuthorization && (
            <Tag color="warning">Brand not restricted</Tag>
          )}
          <Tag color={rows.length ? "processing" : "default"}>
            {rows.length
              ? `${formatNumber(rows.length)} capped product${rows.length === 1 ? "" : "s"}`
              : "Uncapped"}
          </Tag>
        </Space>
      )}

      {isError && (
        <Alert
          type="error"
          showIcon
          className="mb-3"
          message="Could not load allocations"
          description={
            error instanceof Error ? error.message : "Please try again."
          }
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {isSuccess && rows.length === 0 && !dirty && (
        <Alert
          type="info"
          showIcon
          className="mb-3"
          message="This partner is uncapped on this brand"
          description="They can order any quantity of every product they can see. Add a product below to start capping."
        />
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Typography.Text type="secondary" className="text-xs">
          Counting orders since{" "}
          <strong>
            {windowStart ? formatDateTime(windowStart) : "the beginning"}
          </strong>
        </Typography.Text>
        {canEdit && (
          <Space size={4}>
            <DatePicker
              size="small"
              showTime
              allowClear
              placeholder="Reset from (now)"
              value={resetAt}
              onChange={(d) => setResetAt(d)}
              // The backend rejects a future window: it would exclude every
              // order that has already happened and read zero until the date
              // passed.
              disabledDate={(d) => d.isAfter(dayjs(), "day")}
            />
            <Button
              size="small"
              icon={<HistoryOutlined />}
              loading={resetting}
              disabled={!isSuccess || rows.length === 0}
              onClick={confirmReset}
            >
              Reset window
            </Button>
          </Space>
        )}
      </div>

      {canEdit && (
        <Select
          className="mb-3 w-full"
          showSearch
          value={null}
          placeholder="Add a product to cap…"
          suffixIcon={<PlusOutlined />}
          filterOption={false}
          searchValue={productSearch}
          onSearch={setProductSearch}
          onChange={addProduct}
          notFoundContent={
            productsFetching ? (
              <div className="py-2 text-center">
                <Spin size="small" />
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No matching products in this brand"
              />
            )
          }
          options={productOptions.map(({ value, label }) => ({ value, label }))}
        />
      )}

      <Table<DraftRow>
        rowKey="productId"
        dataSource={rows}
        columns={columns}
        loading={isLoading || isFetching}
        size="middle"
        pagination={false}
        scroll={{ x: 760, y: 360 }}
        locale={{
          emptyText: (
            <Empty description="No product caps set for this partner." />
          ),
        }}
      />

      {canEdit && (
        <Input.TextArea
          className="mt-3"
          placeholder="Optional note recorded against these allocations (e.g. approval reference)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={NOTES_MAX}
          showCount
          autoSize={{ minRows: 2, maxRows: 3 }}
        />
      )}
    </Modal>
  );
}
