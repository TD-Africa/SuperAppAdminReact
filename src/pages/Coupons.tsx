import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Typography,
  App as AntdApp,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Skeleton,
  Descriptions,
  Empty,
  Select,
  Spin,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { apiDelete, apiGet, apiPost, apiPut, API_ORIGIN } from "@/lib/api";
import type {
  CouponProductInput,
  CouponResponse,
  CreateCouponRequest,
  MiniProductResponse,
  PaginationResponse,
  UpdateCouponRequest,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CustomerSearchMultiSelect,
  type CustomerOption,
} from "@/components/CustomerSearchMultiSelect";

// Coupons live under the bare `/api/...` route, not the versioned `/api/v1/` base.
const COUPON_BASE = `${API_ORIGIN}/api/Coupon`;

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  // No dedicated Coupon permission exists in the backend enum; coupons are part of
  // the promotional family, so they reuse the Promo permissions.
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditPromos));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreatePromos));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanDeletePromos));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CouponResponse | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const queryKey = ["coupons", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<CouponResponse>>(
        `${COUPON_BASE}?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load coupons");
      return res.data;
    },
  });

  async function toggleActive(coupon: CouponResponse, value: boolean) {
    // Only PUT is available, so send a full representation to avoid clearing fields.
    const body = toUpdateRequest(coupon, { isActive: value });
    const res = await apiPut<CouponResponse>(`${COUPON_BASE}/${coupon.id}`, body);
    if (!res.status) {
      message.error(res.message ?? "Update failed");
    } else {
      message.success(res.message ?? "Coupon updated");
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function isExpired(c: CouponResponse) {
    if (!c.validUntil) return false;
    return new Date(c.validUntil).getTime() <= Date.now();
  }

  const columns: TableColumnsType<CouponResponse> = [
    {
      title: "Code",
      dataIndex: "code",
      render: (v) => <span className="font-mono font-medium">{v ?? "—"}</span>,
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (v, r) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{v ?? "—"}</span>
          {isExpired(r) && <Tag>Expired</Tag>}
        </div>
      ),
    },
    {
      title: "Redemptions",
      key: "redemptions",
      align: "right",
      render: (_, r) => (
        <span className="text-xs text-muted-foreground">
          {r.redemptionCount}
          {r.maxRedemptions != null ? ` / ${r.maxRedemptions}` : ""}
        </span>
      ),
    },
    {
      title: "Starts",
      dataIndex: "startDate",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{v ? formatDate(v) : "—"}</span>
      ),
    },
    {
      title: "Ends",
      dataIndex: "validUntil",
      render: (v) => (
        <span className="text-xs text-muted-foreground">{v ? formatDate(v) : "—"}</span>
      ),
    },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v: boolean, r) => (
        <Switch
          checked={v && !isExpired(r)}
          disabled={!canEdit || isExpired(r)}
          onChange={(val) => toggleActive(r, val)}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 140,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)} />
          {canEdit && (
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditId(r.id)} />
          )}
          {canDelete && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteTarget(r)}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Coupons
          </Typography.Title>
          <Typography.Text type="secondary">
            Discount codes with optional product price overrides and customer targeting.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New coupon
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          placeholder="Search by code or name…"
          value={keyword}
          allowClear
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CouponResponse>
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
          locale={{ emptyText: "No coupons match the current filters." }}
        />
      </Card>

      <CouponFormModal
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["coupons"] })}
      />
      <CouponFormModal
        mode="edit"
        couponId={editId ?? undefined}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["coupons"] })}
      />
      <DetailCouponModal
        couponId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.code ?? "coupon"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(`${COUPON_BASE}/${deleteTarget.id}`);
          if (!res.status) throw new Error("delete-failed");
          queryClient.invalidateQueries({ queryKey: ["coupons"] });
        }}
      />
    </div>
  );
}

// Reconstruct a full UpdateCouponRequest from an existing coupon, applying overrides.
function toUpdateRequest(
  coupon: CouponResponse,
  overrides: Partial<UpdateCouponRequest>,
): UpdateCouponRequest {
  return {
    name: coupon.name,
    isActive: coupon.isActive,
    startDate: coupon.startDate,
    validUntil: coupon.validUntil,
    maxRedemptions: coupon.maxRedemptions,
    oncePerCustomer: coupon.oncePerCustomer,
    customerUserIds: (coupon.customers ?? [])
      .map((c) => c.userId)
      .filter((id): id is string => !!id),
    products: (coupon.products ?? []).map((p) => ({
      productId: p.productId,
      overridePriceInNaira: p.overridePriceInNaira,
      overridePriceInDollar: p.overridePriceInDollar,
    })),
    ...overrides,
  };
}

// --- Product + override-price editor ---
interface CouponProductRow {
  productId: string;
  productName: string;
  dynamicsId: string | null;
  overridePriceInNaira: number | null;
  overridePriceInDollar: number | null;
}

function CouponProductEditor({
  value,
  onChange,
}: {
  value: CouponProductRow[];
  onChange: (rows: CouponProductRow[]) => void;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["product-options", "coupon", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("searchString", debouncedSearch.trim());
      const res = await apiGet<MiniProductResponse[]>(
        `Product/GetProductOptions?${params.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Search failed");
      return res.data ?? [];
    },
    enabled: !!debouncedSearch.trim(),
    staleTime: 30_000,
  });

  const selectedIds = useMemo(() => new Set(value.map((r) => r.productId)), [value]);

  const options = (results ?? [])
    .filter((p) => !selectedIds.has(p.id))
    .map((p) => ({
      value: p.id,
      label: p.dynamicsId ? `${p.productName} · ${p.dynamicsId}` : p.productName,
    }));

  function addProduct(productId: string) {
    const found = (results ?? []).find((p) => p.id === productId);
    if (!found || selectedIds.has(productId)) return;
    onChange([
      ...value,
      {
        productId,
        productName: found.productName,
        dynamicsId: found.dynamicsId ?? null,
        overridePriceInNaira: null,
        overridePriceInDollar: null,
      },
    ]);
    setSearch("");
  }

  function updateRow(productId: string, patch: Partial<CouponProductRow>) {
    onChange(value.map((r) => (r.productId === productId ? { ...r, ...patch } : r)));
  }

  function removeRow(productId: string) {
    onChange(value.filter((r) => r.productId !== productId));
  }

  const columns: TableColumnsType<CouponProductRow> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v, r) => (
        <div>
          <div className="font-medium">{v}</div>
          {r.dynamicsId && (
            <div className="text-xs text-muted-foreground">{r.dynamicsId}</div>
          )}
        </div>
      ),
    },
    {
      title: "Override ₦",
      key: "naira",
      width: 150,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.overridePriceInNaira}
          onChange={(val) => updateRow(r.productId, { overridePriceInNaira: val ?? null })}
          style={{ width: "100%" }}
          placeholder="—"
        />
      ),
    },
    {
      title: "Override $",
      key: "dollar",
      width: 150,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.overridePriceInDollar}
          onChange={(val) => updateRow(r.productId, { overridePriceInDollar: val ?? null })}
          style={{ width: "100%" }}
          placeholder="—"
        />
      ),
    },
    {
      title: "",
      key: "remove",
      width: 48,
      align: "right",
      render: (_, r) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeRow(r.productId)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <Select<string>
        value={null as unknown as string}
        onSelect={(v) => addProduct(v)}
        onSearch={setSearch}
        searchValue={search}
        options={options}
        placeholder="Search to add a product…"
        style={{ width: "100%" }}
        showSearch
        filterOption={false}
        notFoundContent={
          isFetching ? (
            <div className="flex items-center justify-center py-3">
              <Spin size="small" />
            </div>
          ) : debouncedSearch.trim() ? (
            <div className="py-3 text-center text-sm text-muted-foreground">No matches</div>
          ) : (
            <div className="py-3 text-center text-sm text-muted-foreground">
              Start typing to search
            </div>
          )
        }
      />
      {value.length > 0 && (
        <Table<CouponProductRow>
          rowKey="productId"
          dataSource={value}
          columns={columns}
          pagination={false}
          size="small"
        />
      )}
    </div>
  );
}

// --- Create/Edit modal (shared) ---
interface CouponFormState {
  code: string;
  name: string;
  isActive: boolean;
  range: [Dayjs | null, Dayjs | null] | null;
  maxRedemptions: number | null;
  oncePerCustomer: boolean;
  customerUserIds: string[];
  products: CouponProductRow[];
}

function emptyState(): CouponFormState {
  return {
    code: "",
    name: "",
    isActive: true,
    range: null,
    maxRedemptions: null,
    oncePerCustomer: false,
    customerUserIds: [],
    products: [],
  };
}

function CouponFormModal({
  mode,
  couponId,
  open,
  onOpenChange,
  onDone,
}: {
  mode: "create" | "edit";
  couponId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [state, setState] = useState<CouponFormState>(emptyState);
  const [initialCustomers, setInitialCustomers] = useState<CustomerOption[]>([]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["coupon", couponId],
    queryFn: async () => {
      if (!couponId) return null;
      const res = await apiGet<CouponResponse>(`${COUPON_BASE}/${couponId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load coupon");
      return res.data;
    },
    enabled: mode === "edit" && !!couponId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setState(emptyState());
      setInitialCustomers([]);
    } else if (existing) {
      setState({
        code: existing.code ?? "",
        name: existing.name ?? "",
        isActive: existing.isActive,
        range: [
          existing.startDate ? dayjs(existing.startDate) : null,
          existing.validUntil ? dayjs(existing.validUntil) : null,
        ],
        maxRedemptions: existing.maxRedemptions,
        oncePerCustomer: existing.oncePerCustomer,
        customerUserIds: (existing.customers ?? [])
          .map((c) => c.userId)
          .filter((id): id is string => !!id),
        products: (existing.products ?? []).map((p) => ({
          productId: p.productId,
          productName: p.productName ?? p.productId,
          dynamicsId: p.dynamicsId,
          overridePriceInNaira: p.overridePriceInNaira,
          overridePriceInDollar: p.overridePriceInDollar,
        })),
      });
      setInitialCustomers(
        (existing.customers ?? [])
          .filter((c) => !!c.userId)
          .map((c) => ({
            id: c.userId as string,
            companyName: c.companyName,
            email: c.email,
          })),
      );
    }
  }, [open, mode, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "create" && !state.code.trim()) throw new Error("Code is required");
      if (!state.name.trim()) throw new Error("Name is required");
      const [start, end] = state.range ?? [null, null];
      if (start && end && end.isBefore(start))
        throw new Error("End date must be after the start date");

      const products: CouponProductInput[] = state.products.map((p) => ({
        productId: p.productId,
        overridePriceInNaira: p.overridePriceInNaira,
        overridePriceInDollar: p.overridePriceInDollar,
      }));

      if (mode === "create") {
        const body: CreateCouponRequest = {
          code: state.code.trim(),
          name: state.name.trim(),
          isActive: state.isActive,
          startDate: start ? start.toDate().toISOString() : null,
          validUntil: end ? end.toDate().toISOString() : null,
          maxRedemptions: state.maxRedemptions,
          oncePerCustomer: state.oncePerCustomer,
          customerUserIds: state.customerUserIds,
          products,
        };
        const res = await apiPost<CouponResponse>(COUPON_BASE, body);
        if (!res.status) throw new Error(res.message ?? "Save failed");
        return res.message ?? "Coupon created";
      }

      const body: UpdateCouponRequest = {
        name: state.name.trim(),
        isActive: state.isActive,
        startDate: start ? start.toDate().toISOString() : null,
        validUntil: end ? end.toDate().toISOString() : null,
        maxRedemptions: state.maxRedemptions,
        oncePerCustomer: state.oncePerCustomer,
        customerUserIds: state.customerUserIds,
        products,
      };
      const res = await apiPut<CouponResponse>(`${COUPON_BASE}/${couponId}`, body);
      if (!res.status) throw new Error(res.message ?? "Save failed");
      return res.message ?? "Coupon updated";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onDone();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={mode === "create" ? "New coupon" : "Edit coupon"}
      width={860}
      confirmLoading={mutation.isPending}
      okText={mode === "create" ? "Create coupon" : "Save changes"}
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      {mode === "edit" && isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Form layout="vertical" requiredMark={false}>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Form.Item label="Code" required={mode === "create"}>
              <Input
                value={state.code}
                disabled={mode === "edit"}
                onChange={(e) => setState((p) => ({ ...p, code: e.target.value }))}
                placeholder="SUMMER25"
              />
            </Form.Item>
            <Form.Item label="Name" required>
              <Input
                value={state.name}
                onChange={(e) => setState((p) => ({ ...p, name: e.target.value }))}
                placeholder="Summer sale coupon"
              />
            </Form.Item>
          </div>
          <Form.Item label="Valid window">
            <DatePicker.RangePicker
              showTime
              className="w-full"
              value={state.range}
              onChange={(v) => setState((p) => ({ ...p, range: v ? [v[0], v[1]] : null }))}
            />
          </Form.Item>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Form.Item
              label="Max redemptions"
              tooltip="Leave empty for unlimited redemptions."
            >
              <InputNumber
                min={1}
                value={state.maxRedemptions}
                onChange={(v) => setState((p) => ({ ...p, maxRedemptions: v ?? null }))}
                style={{ width: "100%" }}
                placeholder="Unlimited"
              />
            </Form.Item>
            <div className="flex items-center gap-6 pb-6 pt-1 md:pt-8">
              <Tooltip title="Each customer can redeem this coupon only once.">
                <span className="flex items-center gap-2">
                  <Switch
                    checked={state.oncePerCustomer}
                    onChange={(v) => setState((p) => ({ ...p, oncePerCustomer: v }))}
                  />
                  <span className="text-sm">Once per customer</span>
                </span>
              </Tooltip>
              <span className="flex items-center gap-2">
                <Switch
                  checked={state.isActive}
                  onChange={(v) => setState((p) => ({ ...p, isActive: v }))}
                />
                <span className="text-sm">Active</span>
              </span>
            </div>
          </div>
          <Form.Item
            label="Eligible customers"
            tooltip="Leave empty to make the coupon available to all customers."
          >
            <CustomerSearchMultiSelect
              value={state.customerUserIds}
              onChange={(v) => setState((p) => ({ ...p, customerUserIds: v }))}
              initialSelection={initialCustomers}
            />
          </Form.Item>
          <Form.Item
            label="Products & price overrides"
            tooltip="Optionally restrict the coupon to specific products and override their prices."
          >
            <CouponProductEditor
              value={state.products}
              onChange={(rows) => setState((p) => ({ ...p, products: rows }))}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

// --- Detail modal ---
function DetailCouponModal({
  couponId,
  open,
  onOpenChange,
}: {
  couponId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["coupon", couponId],
    queryFn: async () => {
      if (!couponId) return null;
      const res = await apiGet<CouponResponse>(`${COUPON_BASE}/${couponId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load coupon");
      return res.data;
    },
    enabled: !!couponId && open,
  });

  const productColumns: TableColumnsType<NonNullable<CouponResponse["products"]>[number]> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v) => <span className="font-medium">{v ?? "—"}</span>,
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
    {
      title: "Override ₦",
      dataIndex: "overridePriceInNaira",
      align: "right",
      render: (v: number | null) => (v != null ? formatCurrency(v, "NGN") : "—"),
    },
    {
      title: "Override $",
      dataIndex: "overridePriceInDollar",
      align: "right",
      render: (v: number | null) => (v != null ? formatCurrency(v, "USD") : "—"),
    },
  ];

  const customerColumns: TableColumnsType<
    NonNullable<CouponResponse["customers"]>[number]
  > = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v) => <span className="font-medium">{v ?? "—"}</span>,
    },
    { title: "Email", dataIndex: "email", render: (v) => v ?? "—" },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (v) => <span className="text-xs text-muted-foreground">{v ?? "—"}</span>,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.code ?? "Coupon"}
      width={860}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <div className="space-y-5">
          <Descriptions column={2} size="small" colon={false} bordered>
            <Descriptions.Item label="Code">
              <span className="font-mono">{data.code ?? "—"}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Name">{data.name ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={data.isActive ? "success" : "default"}>
                {data.isActive ? "Active" : "Inactive"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Once per customer">
              {data.oncePerCustomer ? "Yes" : "No"}
            </Descriptions.Item>
            <Descriptions.Item label="Starts">
              {data.startDate ? formatDate(data.startDate) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ends">
              {data.validUntil ? formatDate(data.validUntil) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Redemptions">
              {data.redemptionCount}
              {data.maxRedemptions != null ? ` / ${data.maxRedemptions}` : " (unlimited)"}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Typography.Text strong>Eligible customers</Typography.Text>
            {data.customers && data.customers.length > 0 ? (
              <Table
                className="mt-2"
                rowKey={(r) => r.userId ?? r.email ?? Math.random().toString()}
                dataSource={data.customers}
                columns={customerColumns}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                className="mt-2"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Available to all customers"
              />
            )}
          </div>

          <div>
            <Typography.Text strong>Products</Typography.Text>
            {data.products && data.products.length > 0 ? (
              <Table
                className="mt-2"
                rowKey="productId"
                dataSource={data.products}
                columns={productColumns}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                className="mt-2"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Applies to all products"
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
