import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  Typography,
} from "antd";
import type { TableColumnsType, UploadFile } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PictureOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/lib/utils";
import { ProductSearchMultiSelect } from "@/components/ProductSearchMultiSelect";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  createStorefrontPromotion,
  deleteStorefrontPromotion,
  getStorefrontPromotion,
  getStorefrontPromotions,
  updateStorefrontPromotion,
} from "@/lib/storefrontApi";
import type {
  StorefrontPagedPromotions,
  StorefrontPromotionProductResponse,
  StorefrontPromotionResponse,
} from "@/lib/storefrontTypes";
import type { MiniProductResponse } from "@/lib/types";

const ALL = "__all__";

interface StorefrontPromotionFormState {
  name: string;
  percentOff: number | null;
  range: [Dayjs | null, Dayjs | null] | null;
  productIds: string[];
  file: File | null;
  isActive: boolean;
}

function emptyState(): StorefrontPromotionFormState {
  return {
    name: "",
    percentOff: null,
    range: [dayjs(), dayjs().add(7, "day")],
    productIds: [],
    file: null,
    isActive: true,
  };
}

export default function StorefrontPromotionsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();

  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditPromos));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreatePromos));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanDeletePromos));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorefrontPromotionResponse | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);

  const isActiveParam = useMemo(() => {
    if (isActive === ALL) return undefined;
    return isActive === "true";
  }, [isActive]);

  const queryParamsKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    if (isActiveParam !== undefined) params.set("isActive", String(isActiveParam));
    return params.toString();
  }, [pageSize, page, debouncedKeyword, isActiveParam]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["storefront-promotions", queryParamsKey],
    queryFn: async () => {
      const res = await getStorefrontPromotions({
        PageSize: pageSize,
        PageNumber: page,
        SearchString: debouncedKeyword.trim() || undefined,
        isActive: isActiveParam,
      });
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront promotions");
      return res.data as StorefrontPagedPromotions;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function isExpired(p: StorefrontPromotionResponse) {
    if (!p.validUntil) return false;
    return new Date(p.validUntil).getTime() <= Date.now();
  }

  const columns: TableColumnsType<StorefrontPromotionResponse> = [
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
    {
      title: "%",
      dataIndex: "percentOff",
      align: "right",
      render: (v: number) => `${v}%`,
    },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v: boolean, r) => {
        const expired = isExpired(r);
        const effectiveActive = v && !expired;
        return (
          <Tag color={effectiveActive ? "green" : "red"}>
            {effectiveActive ? "Active" : "Inactive"}
          </Tag>
        );
      },
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
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteTarget(r)} />
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
            Storefront Promotions
          </Typography.Title>
          <Typography.Text type="secondary">
            Percentage-discount campaigns shown on the storefront.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New promotion
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
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontPromotionResponse>
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
          locale={{ emptyText: "No promotions match the current filters." }}
        />
      </Card>

      <StorefrontPromotionFormModal
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["storefront-promotions"] })}
      />
      <StorefrontPromotionFormModal
        mode="edit"
        promotionId={editId ?? undefined}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["storefront-promotions"] })}
      />
      <DetailStorefrontPromotionModal
        promotionId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onOpenProduct={(id) => setProductDetailId(id)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "promotion"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await deleteStorefrontPromotion(deleteTarget.id);
          if (!res.status) throw new Error("delete-failed");
          message.success(res.message ?? "Promotion deleted");
          queryClient.invalidateQueries({ queryKey: ["storefront-promotions"] });
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

function StorefrontPromotionFormModal({
  mode,
  promotionId,
  open,
  onOpenChange,
  onDone,
}: {
  mode: "create" | "edit";
  promotionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { message } = AntdApp.useApp();

  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditPromos));

  const [state, setState] = useState<StorefrontPromotionFormState>(emptyState);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["storefront-promotion", promotionId],
    queryFn: async () => {
      if (!promotionId) return null;
      const res = await getStorefrontPromotion(promotionId);
      if (!res.status) throw new Error(res.message ?? "Failed to load promotion");
      return res.data;
    },
    enabled: mode === "edit" && !!promotionId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setState(emptyState());
      setInitialSelection([]);
      return;
    }

    if (!existing) return;
    setState({
      name: existing.name,
      percentOff: existing.percentOff,
      range: [
        existing.startDate ? dayjs(existing.startDate) : null,
        existing.validUntil ? dayjs(existing.validUntil) : null,
      ],
      productIds: existing.products?.map((p) => p.id) ?? [],
      file: null,
      isActive: existing.isActive,
    });
    setInitialSelection(
      (existing.products ?? []).map((p) => ({
        id: p.id,
        productName: p.productName,
        dynamicsId: undefined,
      })),
    );
  }, [open, mode, existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!state.name.trim()) throw new Error("Title is required");
      if (!state.percentOff || state.percentOff <= 0) throw new Error("Percent off must be > 0");

      const [start, end] = state.range ?? [null, null];
      if (!start || !end) throw new Error("Start and end dates are required");
      if (state.productIds.length === 0) throw new Error("Select at least one product");

      const base = {
        name: state.name.trim(),
        percentOff: state.percentOff,
        startDate: start.toDate().toISOString(),
        endDate: end.toDate().toISOString(),
        productIds: state.productIds,
        imageFile: state.file,
      };

      const res =
        mode === "create"
          ? await createStorefrontPromotion(base)
          : await updateStorefrontPromotion(promotionId!, {
              ...base,
              isActive: canEdit ? state.isActive : existing?.isActive ?? state.isActive,
            });

      if (!res.status) throw new Error(res.message ?? "Save failed");
      return res.message ?? "Promotion saved";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onDone();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  const uploadFileList: UploadFile[] = state.file
    ? [{ uid: "-1", name: state.file.name, status: "done" as const }]
    : [];

  const uploadHelp = (
    <div className="border-t px-3 py-1 text-center text-xs text-muted-foreground">
      {mode === "edit" ? "Choose a new image to replace the current one." : "Optional: you can skip an image."}
    </div>
  );

  const datePickerValue: [Dayjs | null, Dayjs | null] | null = state.range;

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={mode === "create" ? "New storefront promotion" : "Edit promotion"}
      width={820}
      confirmLoading={mutation.isPending}
      okText={mode === "create" ? "Create promotion" : "Save changes"}
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

          {mode === "edit" && (
            <Form.Item label="Active">
              <Switch
                checked={state.isActive}
                disabled={!canEdit}
                onChange={(v) => setState((p) => ({ ...p, isActive: v }))}
              />
            </Form.Item>
          )}

          <Form.Item label="Date range" required>
            <DatePicker.RangePicker
              showTime
              className="w-full"
              value={datePickerValue}
              onChange={(v) => setState((p) => ({ ...p, range: v ? [v[0], v[1]] : null }))}
            />
          </Form.Item>

          <Form.Item label="Image">
            {existing?.imageUrl && !state.file && mode === "edit" && (
              <div className="mb-2 overflow-hidden rounded-md border bg-muted">
                <img
                  src={existing.imageUrl}
                  alt="Current"
                  className="mx-auto max-h-40 w-auto object-contain"
                />
                {uploadHelp}
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
              }}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

function DetailStorefrontPromotionModal({
  promotionId,
  open,
  onOpenChange,
  onOpenProduct,
}: {
  promotionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (productId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["storefront-promotion-detail", promotionId],
    queryFn: async () => {
      if (!promotionId) return null;
      const res = await getStorefrontPromotion(promotionId);
      if (!res.status) throw new Error(res.message ?? "Failed to load promotion");
      return res.data;
    },
    enabled: !!promotionId && open,
  });

  const columns: TableColumnsType<StorefrontPromotionProductResponse> = [
    {
      title: "Product",
      dataIndex: "productName",
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Price (NGN)",
      dataIndex: "priceInNaira",
      align: "right",
      render: (v: number) => v?.toLocaleString?.() ?? String(v),
    },
    {
      title: "Special Price",
      dataIndex: "specialPrice",
      align: "right",
      render: (v: number) => (v ? v.toLocaleString() : "—"),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.name ?? "Promotion"}
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
            <Descriptions.Item label="Status">
              {data.isActive ? (
                <Tag color="green">Active</Tag>
              ) : (
                <Tag color="red">Inactive</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Starts">{formatDate(data.startDate)}</Descriptions.Item>
            <Descriptions.Item label="Ends">{data.validUntil ? formatDate(data.validUntil) : "—"}</Descriptions.Item>
          </Descriptions>

          <Table<StorefrontPromotionProductResponse>
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

