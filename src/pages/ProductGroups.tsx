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
  Modal,
  Form,
  Skeleton,
  Empty,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EyeOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  BaseProductReturnDto,
  MiniProductResponse,
  PaginationResponse,
  ProductGroupResponse,
} from "@/lib/types";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProductSearchMultiSelect } from "@/components/ProductSearchMultiSelect";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";

export default function ProductGroupsPage() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditProductGroup));
  const canCreate = useAuthStore((s) => s.hasPermission(Permission.CanCreateProductGroup));
  const canDelete = useAuthStore((s) => s.hasPermission(Permission.CanDeleteProductGroup));

  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductGroupResponse | null>(null);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("PageSize", String(pageSize));
    params.set("PageNumber", String(page));
    if (debouncedKeyword.trim()) params.set("SearchString", debouncedKeyword.trim());
    return params;
  }, [pageSize, page, debouncedKeyword]);

  const queryKey = ["product-groups", queryParams.toString()];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<PaginationResponse<ProductGroupResponse>>(
        `Product/GetProductGroups?${queryParams.toString()}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load product groups");
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<ProductGroupResponse> = [
    { title: "Name", dataIndex: "name", render: (v) => <span className="font-medium">{v}</span> },
    {
      title: "ID",
      dataIndex: "id",
      render: (v) => <span className="font-mono text-xs text-muted-foreground">{v.slice(0, 8)}</span>,
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

  async function invalidateAll() {
    await queryClient.invalidateQueries({ queryKey: ["product-groups"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Product Groups
          </Typography.Title>
          <Typography.Text type="secondary">
            Bundle products together for easier merchandising.
          </Typography.Text>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New group
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          placeholder="Search by group name…"
          value={keyword}
          allowClear
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ProductGroupResponse>
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
          locale={{ emptyText: "No product groups yet." }}
        />
      </Card>

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidateAll}
      />
      <EditGroupModal
        groupId={editId}
        open={!!editId}
        onOpenChange={(v) => !v && setEditId(null)}
        onUpdated={invalidateAll}
      />
      <DetailGroupModal
        groupId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onOpenProduct={(id) => setProductDetailId(id)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "group"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await apiDelete<boolean>(
            `Product/DeleteProductGroup/${deleteTarget.id}`,
          );
          if (!res.status) throw new Error("delete-failed");
          await invalidateAll();
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

// --- Create ---
function CreateGroupModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [name, setName] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName("");
      setProductIds([]);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (productIds.length === 0) throw new Error("Select at least one product");
      const res = await apiPost<boolean>("Product/CreateProductGroup", {
        name: name.trim(),
        productIds,
      });
      if (!res.status) throw new Error(res.message ?? "Create failed");
      return res.message ?? "Group created";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onCreated();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="New product group"
      width={720}
      confirmLoading={mutation.isPending}
      okText="Create group"
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Title" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer essentials"
          />
        </Form.Item>
        <Form.Item label="Products" required>
          <ProductSearchMultiSelect value={productIds} onChange={setProductIds} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// --- Edit ---
function EditGroupModal({
  groupId,
  open,
  onOpenChange,
  onUpdated,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [name, setName] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [initialSelection, setInitialSelection] = useState<MiniProductResponse[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["product-group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await apiGet<ProductGroupResponse>(
        `Product/GetProductGroup/${groupId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load");
      return res.data;
    },
    enabled: !!groupId && open,
  });

  useEffect(() => {
    if (data) {
      setName(data.name);
      setProductIds(data.products.map((p) => p.id));
      setInitialSelection(
        data.products.map((p) => ({
          id: p.id,
          productName: p.productName,
          dynamicsId: p.dynamicsId ?? undefined,
        })),
      );
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!groupId) throw new Error("No group");
      if (productIds.length === 0) throw new Error("Select at least one product");
      const res = await apiPatch<boolean>(`Product/EditProductGroup/${groupId}`, {
        name: name.trim(),
        productIds,
      });
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res.message ?? "Group updated";
    },
    onSuccess: (msg) => {
      message.success(msg);
      onUpdated();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={data?.name ?? "Edit group"}
      width={720}
      confirmLoading={mutation.isPending}
      okText="Save changes"
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Form.Item>
          <Form.Item label="Products" required>
            <ProductSearchMultiSelect
              value={productIds}
              onChange={setProductIds}
              initialSelection={initialSelection}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

// --- Detail ---
function DetailGroupModal({
  groupId,
  open,
  onOpenChange,
  onOpenProduct,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (productId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await apiGet<ProductGroupResponse>(
        `Product/GetProductGroup/${groupId}`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load");
      return res.data;
    },
    enabled: !!groupId && open,
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
      title={data?.name ?? "Group"}
      width={720}
      footer={null}
      destroyOnClose
    >
      {isLoading || !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Table<BaseProductReturnDto>
          rowKey="id"
          dataSource={data.products}
          columns={columns}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="Empty group." /> }}
          onRow={(r) => ({
            onClick: () => onOpenProduct(r.id),
            style: { cursor: "pointer" },
          })}
        />
      )}
    </Modal>
  );
}
