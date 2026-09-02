import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  addStorefrontCategory,
  deleteStorefrontCategory,
  getStorefrontCategories,
  updateStorefrontCategory,
} from "@/lib/storefrontApi";
import type { StorefrontCategoryDto } from "@/lib/storefrontTypes";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

export default function FranchiseCategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StorefrontCategoryDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ name: string; isActive: boolean }>();

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      isActive: isActive === ALL ? undefined : isActive === "true",
    }),
    [pageSize, page, debouncedSearch, isActive],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["storefront", "categories-admin", queryParams],
    queryFn: async () => {
      const res = await getStorefrontCategories(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront categories");
      return res.data;
    },
  });

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? error.message : "Unable to load storefront categories.",
      );
    }
  }, [isError, error, message]);

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue({ name: "", isActive: true });
    setModalOpen(true);
  }

  function openEdit(category: StorefrontCategoryDto) {
    setEditing(category);
    form.setFieldsValue({ name: category.name, isActive: category.isActive });
    setModalOpen(true);
  }

  async function saveCategory() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const res = await updateStorefrontCategory(editing.id, values);
        if (!res.status) {
          message.error(res.message ?? "Failed to update category");
          return;
        }
        message.success(res.message ?? "Category updated");
      } else {
        const res = await addStorefrontCategory(values);
        if (!res.status) {
          message.error(res.message ?? "Failed to create category");
          return;
        }
        message.success(res.message ?? "Category created");
      }
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["storefront", "categories-admin"] });
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(category: StorefrontCategoryDto) {
    const res = await deleteStorefrontCategory(category.id);
    if (!res.status) {
      message.error(res.message ?? "Failed to delete category");
      return;
    }
    message.success(res.message ?? "Category deleted");
    void queryClient.invalidateQueries({ queryKey: ["storefront", "categories-admin"] });
  }

  const columns: TableColumnsType<StorefrontCategoryDto> = [
    {
      title: "Category",
      dataIndex: "name",
      render: (name: string) => <span className="font-medium">{name}</span>,
    },
    {
      title: "Products",
      dataIndex: "productCount",
      width: 100,
      align: "right",
    },
    {
      title: "Status",
      dataIndex: "isActive",
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Created",
      dataIndex: "dateCreated",
      width: 120,
      render: (value: string) => (value ? new Date(value).toLocaleDateString() : "—"),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 260,
      render: (_, category) => (
        <Space size={4}>
          <Button
            type="primary"
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() =>
              navigate(`/franchise-categories/${category.id}`, { state: { category } })
            }
          >
            Manage
          </Button>
          {canEdit && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(category)}>
              Edit
            </Button>
          )}
          {canEdit && (
            <Popconfirm
              title="Delete this storefront category?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => void removeCategory(category)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!m-0">
            Franchise categories
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage storefront categories and assign products to them.
          </Typography.Text>
        </div>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add category
          </Button>
        )}
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap gap-3">
          <Input
            allowClear
            placeholder="Search category…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            prefix={<TagsOutlined className="text-muted-foreground" />}
            className="min-w-[220px] flex-1"
          />
          <Select
            value={isActive}
            onChange={(value) => {
              setIsActive(value);
              setPage(1);
            }}
            className="min-w-[140px]"
            options={[
              { value: ALL, label: "All statuses" },
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontCategoryDto>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isLoading || isFetching}
          locale={{ emptyText: <Empty description="No storefront categories" /> }}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            hideOnSinglePage: totalItems <= pageSize,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "Edit category" : "Add category"}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveCategory()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Enter a category name" }]}
          >
            <Input placeholder="Category name" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
