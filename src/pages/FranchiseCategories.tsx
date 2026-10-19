import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AppstoreOutlined, TagsOutlined } from "@ant-design/icons";
import { getStorefrontCategories } from "@/lib/storefrontApi";
import type { StorefrontCategoryDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ALL = "__all__";

export default function FranchiseCategoriesPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [isActive, setIsActive] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
      isActive: isActive === ALL ? undefined : isActive === "true",
    }),
    [pageSize, page, debouncedSearch, isActive],
  );

  const categoriesQuery = useQuery({
    queryKey: ["storefront", "categories-admin", queryParams],
    queryFn: async () => {
      // This endpoint mirrors SuperApp categories and reuses the source ID.
      const res = await getStorefrontCategories(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront categories");
      return res.data;
    },
  });

  useEffect(() => {
    if (!categoriesQuery.isError) return;
    message.error(
      categoriesQuery.error instanceof Error
        ? categoriesQuery.error.message
        : "Unable to load storefront categories.",
    );
  }, [categoriesQuery.isError, categoriesQuery.error, message]);

  const rows = categoriesQuery.data?.data ?? [];
  const totalItems = Number(categoriesQuery.data?.count ?? 0);

  const columns: TableColumnsType<StorefrontCategoryDto> = [
    {
      title: "Category",
      key: "category",
      render: (_, category) => (
        <div>
          <div className="font-medium">{category.name}</div>
          <Typography.Text type="secondary" className="text-xs">
            SuperApp ID: {category.superAppCategoryId ?? category.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Source products",
      dataIndex: "productCount",
      width: 150,
      align: "right",
    },
    {
      title: "Status",
      dataIndex: "isActive",
      width: 110,
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Source",
      key: "source",
      width: 130,
      render: () => <Tag color="blue">Mirrored</Tag>,
    },
    {
      title: "Created",
      dataIndex: "dateCreated",
      width: 130,
      render: (value: string) => (value ? new Date(value).toLocaleDateString() : "—"),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 120,
      render: (_, category) => (
        <Button
          type="primary"
          size="small"
          icon={<AppstoreOutlined />}
          onClick={() => navigate(`/franchise-categories/${category.id}`, { state: { category } })}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Storefront categories
        </Typography.Title>
        <Typography.Text type="secondary">
          Categories are mirrored from SuperApp. Their IDs and product-category relationships remain the SuperApp source of truth.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap gap-3">
          <Input
            allowClear
            placeholder="Search mirrored categories…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            prefix={<TagsOutlined className="text-muted-foreground" />}
            className="min-w-[240px] flex-1"
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
          loading={categoriesQuery.isLoading || categoriesQuery.isFetching}
          locale={{ emptyText: <Empty description="No mirrored categories" /> }}
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

      <Typography.Text type="secondary" className="block text-sm">
        Product exclusions are configured on the storefront brand, not on a category or store owner.
      </Typography.Text>
    </div>
  );
}
