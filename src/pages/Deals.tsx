import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Input,
  Select,
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
  Alert,
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
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  DealEnum,
  DealRequest,
  DealResponse,
  EditDealRequest,
  LocationReturnDTO,
  MiniProductResponse,
  PaginationResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProductSearchMultiSelect } from "@/components/ProductSearchMultiSelect";

const ALL = "__all__";

const DEAL_TYPE_LABELS: Record<DealEnum, string> = {
  PercentageDiscount: "Percentage Discount",
  FixedDiscount: "Fixed Discount",
  BuyOneGetOneFree: "Buy X Get Y Free",
};

function discountDisplay(d: DealResponse): string {
  switch (d.dealType) {
    case "PercentageDiscount":
      return `${d.percentOff ?? 0}%`;
    case "FixedDiscount":
      return `$${(d.fixedAmount ?? 0).toFixed(2)}`;
    case "BuyOneGetOneFree":
      return `Buy ${d.buyQuantity ?? 0}, Get ${d.getQuantity ?? 0} free`;
  }
}

export default function DealsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [locationId, setLocationId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DealResponse | null>(null);

  const { data: locations } = useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load locations");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActive !== ALL) params.set("isActive", isActive);
    if (locationId !== ALL) params.set("locationId", locationId);
    return params;
  }, [pageSize, page, debouncedKeyword, isActive, locationId]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["deals", queryParams.toString()],
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<DealResponse>>(
        `Deal/GetAll?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load deals");
      return res.data;
    },
  });

  async function toggleActive(deal: DealResponse, value: boolean) {
    const res = await apiPut<boolean>(`Deal/Update/${deal.id}`, {
      isActive: value,
    } satisfies EditDealRequest);
    if (!res.status) {
      message.error(res.message ?? "Update failed");
    } else {
      message.success(res.message ?? "Deal updated");
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function isExpired(d: DealResponse) {
    if (!d.validUntil) return false;
    return new Date(d.validUntil).getTime() <= Date.now();
  }

  const columns: TableColumnsType<DealResponse> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (v, r) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{v}</span>
          {isExpired(r) && <Tag>Expired</Tag>}
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "dealType",
      render: (v: DealEnum) => <Tag>{DEAL_TYPE_LABELS[v]}</Tag>,
    },
    {
      title: "Discount",
      key: "discount",
      render: (_, r) => discountDisplay(r),
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
    { title: "Location", dataIndex: ["location", "locationName"], render: (v) => v ?? "—" },
    {
      title: "Products",
      dataIndex: "products",
      align: "right",
      render: (v: unknown[]) => v?.length ?? 0,
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
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditId(r.id)} />
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDeleteTarget(r)}
              />
            </>
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
            Deals
          </Typography.Title>
          <Typography.Text type="secondary">
            Percentage, fixed-amount, or buy-x-get-y deals on sets of products.
          </Typography.Text>
        </div>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New deal
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search by name…"
            value={keyword}
            allowClear
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
          />
          <Select
            className="md:col-span-3"
            value={isActive}
            onChange={(v) => {
              setPage(1);
              setIsActive(v);
            }}
            options={[
              { value: ALL, label: "All statuses" },
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
          <Select
            className="md:col-span-3"
            value={locationId}
            onChange={(v) => {
              setPage(1);
              setLocationId(v);
            }}
            options={[
              { value: ALL, label: "All locations" },
              ...(locations ?? []).map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<DealResponse>
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: "No deals match the current filters." }}
        />
      </Card>

      <DealFormModal
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        locations={locations ?? []}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["deals"] })}
      />
      <DealFormModal
        mode="edit"
        dealId={editId ?? undefined}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        locations={locations ?? []}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["deals"] })}
      />
      <DetailDealModal
        dealId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "deal"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(`Deal/Delete/${deleteTarget.id}`);
          if (!res.status) throw new Error("delete-failed");
          queryClient.invalidateQueries({ queryKey: ["deals"] });
        }}
      />
    </div>
  );
}

interface DealFormState {
  name: string;
  dealType: DealEnum;
  percentOff: number | null;
  fixedAmount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  locationId: string;
  range: [Dayjs | null, Dayjs | null] | null;
  productIds: string[];
}

function emptyForm(): DealFormState {
  return {
    name: "",
    dealType: "PercentageDiscount",
    percentOff: null,
    fixedAmount: null,
    buyQuantity: 1,
    getQuantity: 1,
    locationId: "",
    range: [dayjs(), dayjs().add(7, "day")],
    productIds: [],
  };
}

function buildPayload(s: DealFormState): DealRequest {
  const [start, end] = s.range ?? [null, null];
  const payload: DealRequest = {
    name: s.name.trim(),
    dealType: s.dealType,
    locationId: s.locationId,
    startDate: start ? start.toDate().toISOString() : null,
    validUntil: end ? end.toDate().toISOString() : null,
    productIds: s.productIds,
  };
  if (s.dealType === "PercentageDiscount") payload.percentOff = s.percentOff;
  else if (s.dealType === "FixedDiscount") payload.fixedAmount = s.fixedAmount;
  else {
    payload.buyQuantity = s.buyQuantity;
    payload.getQuantity = s.getQuantity;
  }
  return payload;
}

function DealFormModal({
  mode,
  dealId,
  open,
  onOpenChange,
  locations,
  onDone,
}: {
  mode: "create" | "edit";
  dealId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationReturnDTO[];
  onDone: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [form, setForm] = useState<DealFormState>(emptyForm);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const res = await apiGet<DealResponse>(`Deal/Get/${dealId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load deal");
      return res.data;
    },
    enabled: mode === "edit" && !!dealId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setForm(emptyForm());
      setInitialSelection([]);
    } else if (existing) {
      setForm({
        name: existing.name,
        dealType: existing.dealType,
        percentOff: existing.percentOff,
        fixedAmount: existing.fixedAmount,
        buyQuantity: existing.buyQuantity ?? 1,
        getQuantity: existing.getQuantity ?? 1,
        locationId: existing.locationId,
        range: [
          existing.startDate ? dayjs(existing.startDate) : null,
          existing.validUntil ? dayjs(existing.validUntil) : null,
        ],
        productIds: existing.products.map((p) => p.id),
      });
      setInitialSelection(
        existing.products.map((p) => ({
          id: p.id,
          productName: p.name ?? "Unnamed",
        })),
      );
    }
  }, [open, mode, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      if (!form.locationId) throw new Error("Location is required");
      if (form.productIds.length === 0)
        throw new Error("Select at least one product");
      const payload = buildPayload(form);
      const res =
        mode === "create"
          ? await apiPost<boolean>("Deal/Create", payload)
          : await apiPut<boolean>(`Deal/Update/${dealId}`, payload);
      if (!res.status) throw new Error(res.message ?? "Save failed");
      return res.message ?? "Deal saved";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onDone();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={mode === "create" ? "New deal" : "Edit deal"}
      width={820}
      confirmLoading={mutation.isPending}
      okText={mode === "create" ? "Create deal" : "Save changes"}
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      {mode === "edit" && isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Weekend BOGO"
            />
          </Form.Item>
          <Form.Item label="Deal type" required>
            <Select
              value={form.dealType}
              onChange={(v) =>
                setForm((p) => ({
                  ...p,
                  dealType: v,
                  percentOff: null,
                  fixedAmount: null,
                  buyQuantity: 1,
                  getQuantity: 1,
                }))
              }
              options={[
                { value: "PercentageDiscount", label: DEAL_TYPE_LABELS.PercentageDiscount },
                { value: "FixedDiscount", label: DEAL_TYPE_LABELS.FixedDiscount },
                { value: "BuyOneGetOneFree", label: DEAL_TYPE_LABELS.BuyOneGetOneFree },
              ]}
            />
          </Form.Item>

          {form.dealType === "PercentageDiscount" && (
            <Form.Item label="Percentage off">
              <InputNumber
                min={0}
                max={100}
                value={form.percentOff}
                onChange={(v) => setForm((p) => ({ ...p, percentOff: v ?? null }))}
                style={{ width: "100%" }}
                placeholder="25"
              />
            </Form.Item>
          )}
          {form.dealType === "FixedDiscount" && (
            <Form.Item label="Fixed amount off">
              <InputNumber
                min={0}
                value={form.fixedAmount}
                onChange={(v) => setForm((p) => ({ ...p, fixedAmount: v ?? null }))}
                style={{ width: "100%" }}
                placeholder="50.00"
              />
            </Form.Item>
          )}
          {form.dealType === "BuyOneGetOneFree" && (
            <Alert
              type="info"
              showIcon
              message={
                <>
                  Customer must buy <strong>{form.buyQuantity ?? 1}</strong> to get{" "}
                  <strong>{form.getQuantity ?? 1}</strong> free.
                </>
              }
              description={
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Form.Item label="Buy quantity" className="!mb-0">
                    <InputNumber
                      min={1}
                      value={form.buyQuantity}
                      onChange={(v) => setForm((p) => ({ ...p, buyQuantity: v ?? 1 }))}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item label="Get free" className="!mb-0">
                    <InputNumber
                      min={1}
                      value={form.getQuantity}
                      onChange={(v) => setForm((p) => ({ ...p, getQuantity: v ?? 1 }))}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </div>
              }
            />
          )}

          <Form.Item label="Location" required className="mt-4">
            <Select
              value={form.locationId || undefined}
              onChange={(v) => setForm((p) => ({ ...p, locationId: v }))}
              options={locationOptions}
              placeholder="Select location"
            />
          </Form.Item>
          <Form.Item label="Date range" required>
            <DatePicker.RangePicker
              showTime
              className="w-full"
              value={form.range}
              onChange={(v) =>
                setForm((p) => ({ ...p, range: v ? [v[0], v[1]] : null }))
              }
            />
          </Form.Item>
          <Form.Item label="Products" required>
            <ProductSearchMultiSelect
              value={form.productIds}
              onChange={(v) => setForm((p) => ({ ...p, productIds: v }))}
              initialSelection={initialSelection}
              extraParams={{ locationId: form.locationId || undefined }}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

function DetailDealModal({
  dealId,
  open,
  onOpenChange,
}: {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      if (!dealId) return null;
      const res = await apiGet<DealResponse>(`Deal/Get/${dealId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load deal");
      return res.data;
    },
    enabled: !!dealId && open,
  });

  const columns = [
    {
      title: "Product",
      dataIndex: "name",
      render: (v: string | null) => <span className="font-medium">{v ?? "—"}</span>,
    },
    {
      title: "Price",
      dataIndex: "price",
      align: "right" as const,
      render: (v: number) =>
        v.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.name ?? "Deal"}
      width={720}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <div className="space-y-4">
          <Descriptions column={2} size="small" colon={false}>
            <Descriptions.Item label="Type">
              {DEAL_TYPE_LABELS[data.dealType]}
            </Descriptions.Item>
            <Descriptions.Item label="Discount">{discountDisplay(data)}</Descriptions.Item>
            <Descriptions.Item label="Location">
              {data.location?.locationName ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {data.isActive ? "Active" : "Inactive"}
            </Descriptions.Item>
            <Descriptions.Item label="Starts">
              {data.startDate ? formatDate(data.startDate) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ends">
              {data.validUntil ? formatDate(data.validUntil) : "—"}
            </Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="id"
            dataSource={data.products ?? []}
            columns={columns}
            pagination={false}
            size="small"
          />
        </div>
      )}
    </Modal>
  );
}
