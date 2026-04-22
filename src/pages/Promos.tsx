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
  Upload,
  Skeleton,
  Descriptions,
  Empty,
} from "antd";
import type { TableColumnsType, UploadFile } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  UploadOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  toFormData,
} from "@/lib/api";
import type {
  BaseProductReturnDto,
  LocationReturnDTO,
  MiniProductResponse,
  PaginationResponse,
  PromoResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProductSearchMultiSelect } from "@/components/ProductSearchMultiSelect";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

const ALL = "__all__";

export default function PromosPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditPromos));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreatePromos));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanDeletePromos));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [locationId, setLocationId] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromoResponse | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load warehouses");
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

  const queryKey = ["promos", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<PromoResponse>>(
        `Promo/GetPromos?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load promos");
      return res.data;
    },
  });

  async function toggleActive(promo: PromoResponse, value: boolean) {
    const fd = toFormData({ isActive: value });
    const res = await apiPatch<boolean>(`Promo/EditPromo/${promo.id}`, fd);
    if (!res.status) {
      message.error(res.message ?? "Update failed");
    } else {
      message.success(res.message ?? "Promo updated");
      queryClient.invalidateQueries({ queryKey: ["promos"] });
    }
  }

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function isExpired(p: PromoResponse) {
    if (!p.validUntil) return false;
    return new Date(p.validUntil).getTime() <= Date.now();
  }

  const columns: TableColumnsType<PromoResponse> = [
    {
      title: "Title",
      dataIndex: "name",
      render: (v, r) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{v}</span>
          {isExpired(r) && <Tag>Expired</Tag>}
        </div>
      ),
    },
    {
      title: "Starts",
      dataIndex: "startDate",
      render: (v) => <span className="text-xs text-muted-foreground">{formatDate(v)}</span>,
    },
    {
      title: "Ends",
      dataIndex: "validUntil",
      render: (v) => <span className="text-xs text-muted-foreground">{v ? formatDate(v) : "—"}</span>,
    },
    { title: "%", dataIndex: "percentOff", align: "right", render: (v: number) => `${v}%` },
    { title: "Warehouse", dataIndex: ["location", "name"], render: (v) => v ?? "—" },
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
            Promos
          </Typography.Title>
          <Typography.Text type="secondary">
            Promotional campaigns with percentage discounts on bundles of products.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New promo
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-6"
            placeholder="Search by title…"
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
              { value: ALL, label: "All warehouses" },
              ...(warehouses ?? []).map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<PromoResponse>
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
          locale={{ emptyText: "No promos match the current filters." }}
        />
      </Card>

      <PromoFormModal
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        warehouses={warehouses ?? []}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["promos"] })}
      />
      <PromoFormModal
        mode="edit"
        promoId={editId ?? undefined}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        warehouses={warehouses ?? []}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["promos"] })}
      />
      <DetailPromoModal
        promoId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onOpenProduct={(id) => setProductDetailId(id)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "promo"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(`Promo/DeletePromo/${deleteTarget.id}`);
          if (!res.status) throw new Error("delete-failed");
          queryClient.invalidateQueries({ queryKey: ["promos"] });
        }}
      />

      <ProductDetailModal
        productId={productDetailId}
        open={!!productDetailId}
        onOpenChange={(v) => !v && setProductDetailId(null)}
      />
    </div>
  );
}

// --- Create/Edit modal (shared) ---
interface PromoFormState {
  name: string;
  percentOff: number | null;
  warehouseId: string;
  range: [Dayjs | null, Dayjs | null] | null;
  productIds: string[];
  file: File | null;
}

function emptyState(): PromoFormState {
  return {
    name: "",
    percentOff: null,
    warehouseId: "",
    range: [dayjs(), dayjs().add(7, "day")],
    productIds: [],
    file: null,
  };
}

function PromoFormModal({
  mode,
  promoId,
  open,
  onOpenChange,
  warehouses,
  onDone,
}: {
  mode: "create" | "edit";
  promoId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: LocationReturnDTO[];
  onDone: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [state, setState] = useState<PromoFormState>(emptyState);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["promo", promoId],
    queryFn: async () => {
      if (!promoId) return null;
      const res = await apiGet<PromoResponse>(`Promo/GetPromo/${promoId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load promo");
      return res.data;
    },
    enabled: mode === "edit" && !!promoId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setState(emptyState());
      setInitialSelection([]);
    } else if (existing) {
      setState({
        name: existing.name,
        percentOff: existing.percentOff,
        warehouseId: existing.location?.id ?? "",
        range: [
          existing.startDate ? dayjs(existing.startDate) : null,
          existing.validUntil ? dayjs(existing.validUntil) : null,
        ],
        productIds: existing.products.map((p) => p.id),
        file: null,
      });
      setInitialSelection(
        existing.products.map((p) => ({
          id: p.id,
          productName: p.productName,
          dynamicsId: p.dynamicsId ?? undefined,
        })),
      );
    }
  }, [open, mode, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!state.name.trim()) throw new Error("Title is required");
      if (!state.percentOff || state.percentOff <= 0)
        throw new Error("Percent off must be > 0");
      if (!state.warehouseId) throw new Error("Warehouse is required");
      const [start, end] = state.range ?? [null, null];
      if (!start || !end) throw new Error("Start and end dates are required");
      if (state.productIds.length === 0)
        throw new Error("Select at least one product");

      const fd = toFormData(
        {
          name: state.name.trim(),
          percentOff: state.percentOff,
          startDate: start.toDate().toISOString(),
          endDate: end.toDate().toISOString(),
          locationId: state.warehouseId,
          productIds: state.productIds,
        },
        state.file ?? undefined,
      );

      const res =
        mode === "create"
          ? await apiPost<boolean>("Promo/CreatePromo", fd)
          : await apiPatch<boolean>(`Promo/EditPromo/${promoId}`, fd);
      if (!res.status) throw new Error(res.message ?? "Save failed");
      return res.message ?? "Promo saved";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onDone();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const uploadFileList: UploadFile[] = state.file
    ? [{ uid: "-1", name: state.file.name, status: "done" as const }]
    : [];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={mode === "create" ? "New promo" : "Edit promo"}
      width={820}
      confirmLoading={mutation.isPending}
      okText={mode === "create" ? "Create promo" : "Save changes"}
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      {mode === "edit" && isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="Title" required>
            <Input
              value={state.name}
              onChange={(e) => setState((p) => ({ ...p, name: e.target.value }))}
              placeholder="Summer sale"
            />
          </Form.Item>
          <Form.Item label="Percentage off" required>
            <InputNumber
              min={0}
              max={100}
              value={state.percentOff}
              onChange={(v) => setState((p) => ({ ...p, percentOff: v ?? null }))}
              style={{ width: "100%" }}
              placeholder="25"
            />
          </Form.Item>
          <Form.Item label="Warehouse" required>
            <Select
              value={state.warehouseId || undefined}
              onChange={(v) => setState((p) => ({ ...p, warehouseId: v }))}
              options={warehouseOptions}
              placeholder="Select warehouse"
            />
          </Form.Item>
          <Form.Item label="Date range" required>
            <DatePicker.RangePicker
              showTime
              className="w-full"
              value={state.range}
              onChange={(v) =>
                setState((p) => ({ ...p, range: v ? [v[0], v[1]] : null }))
              }
            />
          </Form.Item>
          <Form.Item label="Image">
            {existing?.imageUrl && !state.file && (
              <div className="mb-2 overflow-hidden rounded-md border bg-muted">
                <img
                  src={existing.imageUrl}
                  alt="Current"
                  className="mx-auto max-h-40 w-auto object-contain"
                />
                <div className="border-t px-3 py-1 text-center text-xs text-muted-foreground">
                  Current image — choose a new file to replace
                </div>
              </div>
            )}
            <Upload
              fileList={uploadFileList}
              beforeUpload={(file) => {
                setState((p) => ({ ...p, file }));
                return false;
              }}
              onRemove={() => {
                setState((p) => ({ ...p, file: null }));
                return true;
              }}
              accept="image/*"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>
                {state.file ? "Replace image" : "Choose an image"}
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item label="Products" required>
            <ProductSearchMultiSelect
              value={state.productIds}
              onChange={(v) => setState((p) => ({ ...p, productIds: v }))}
              initialSelection={initialSelection}
              extraParams={{
                hasPromo: "false",
                locationId: state.warehouseId || undefined,
              }}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

// --- Detail modal ---
function DetailPromoModal({
  promoId,
  open,
  onOpenChange,
  onOpenProduct,
}: {
  promoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (productId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["promo", promoId],
    queryFn: async () => {
      if (!promoId) return null;
      const res = await apiGet<PromoResponse>(`Promo/GetPromo/${promoId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load promo");
      return res.data;
    },
    enabled: !!promoId && open,
  });

  const columns: TableColumnsType<BaseProductReturnDto> = [
    { title: "Product", dataIndex: "productName", render: (v) => <span className="font-medium">{v}</span> },
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
      title={data?.name ?? "Promo"}
      width={820}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <div className="space-y-4">
          {data.imageUrl ? (
            <div className="overflow-hidden rounded-md border bg-muted">
              <img
                src={data.imageUrl}
                alt={data.name}
                className="mx-auto max-h-64 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-md border bg-muted">
              <Empty image={<PictureOutlined style={{ fontSize: 32 }} />} description="No image" />
            </div>
          )}
          <Descriptions column={2} size="small" colon={false}>
            <Descriptions.Item label="Discount">{data.percentOff}%</Descriptions.Item>
            <Descriptions.Item label="Warehouse">
              {data.location?.name ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Starts">{formatDate(data.startDate)}</Descriptions.Item>
            <Descriptions.Item label="Ends">
              {data.validUntil ? formatDate(data.validUntil) : "—"}
            </Descriptions.Item>
          </Descriptions>
          <Table<BaseProductReturnDto>
            rowKey="id"
            dataSource={data.products ?? []}
            columns={columns}
            pagination={false}
            size="small"
            onRow={(r) => ({
              onClick: () => onOpenProduct(r.id),
              style: { cursor: "pointer" },
            })}
          />
        </div>
      )}
    </Modal>
  );
}
