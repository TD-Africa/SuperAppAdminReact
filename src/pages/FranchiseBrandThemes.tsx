import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  deleteStorefrontBrandTheme,
  getStorefrontBrandTheme,
  getStorefrontBrands,
} from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function statusTag(isActive: boolean) {
  return <Tag color={isActive ? "success" : "default"}>{isActive ? "Active" : "Inactive"}</Tag>;
}

type BrandThemeRow = StorefrontBrandAdminDto & { hasTheme: boolean };

export default function FranchiseBrandThemesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>();
  const debouncedKeyword = useDebouncedValue(keyword, 350);
  const keywordFilter = debouncedKeyword.trim().toLowerCase();

  const query = useQuery({
    queryKey: ["storefront", "brand-themes", keywordFilter],
    queryFn: async () => {
      // Load all storefront brands (theme editor is per storefrontBrandId).
      const perPage = 500;
      let pageNumber = 1;
      const all: StorefrontBrandAdminDto[] = [];

      while (true) {
        const res = await getStorefrontBrands({ PageSize: perPage, PageNumber: pageNumber });
        if (!res.status) throw new Error(res.message ?? "Failed to load storefront brands");
        all.push(...(res.data?.data ?? []));

        const total = res.data?.count ?? 0;
        if (pageNumber * perPage >= total) break;
        pageNumber += 1;
      }

      const filtered = keywordFilter
        ? all.filter((b) => (b.name ?? "").toLowerCase().includes(keywordFilter))
        : all;

      // Brand activation and theme activation are separate records. Resolve the
      // theme state for display while keeping deletion idempotent for every row.
      return Promise.all(
        filtered.map(async (brand): Promise<BrandThemeRow> => {
          const theme = await getStorefrontBrandTheme(brand.id);
          return { ...brand, hasTheme: Boolean(theme.status && theme.data) };
        }),
      );
    },
    staleTime: 30_000,
  });

  const rows = query.data ?? [];

  const openTheme = () => {
    if (!selectedBrandId) {
      message.warning("Select a storefront brand first");
      return;
    }
    setAddModalOpen(false);
    navigate(`/franchise-brands/${selectedBrandId}/theme`);
  };

  const removeTheme = useMutation({
    mutationFn: async (brand: StorefrontBrandAdminDto) => {
      const res = await deleteStorefrontBrandTheme(brand.id);
      if (!res.status) throw new Error(res.message ?? "Failed to remove theme");
      return brand;
    },
    onSuccess: (brand) => {
      message.success(`${brand.name} theme removed. You can create a new one from Add theme.`);
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brand-themes"] });
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : "Failed to remove theme");
    },
  });

  const confirmRemoveTheme = (brand: StorefrontBrandAdminDto) => {
    Modal.confirm({
      title: `Remove ${brand.name} theme?`,
      content: "The current theme will be removed. You can create a replacement afterward.",
      okText: "Remove theme",
      okButtonProps: { danger: true },
      onOk: () => removeTheme.mutateAsync(brand),
    });
  };

  const columns: TableColumnsType<BrandThemeRow> = [
    {
      title: "Brand",
      dataIndex: "name",
      render: (name: string, row) => (
        <div>
          <div className="font-medium">{name}</div>
          <Typography.Text type="secondary" className="text-xs">
            {row.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Storefront status",
      dataIndex: "isActive",
      width: 160,
      render: (v: boolean) => statusTag(v),
    },
    {
      title: "Theme",
      dataIndex: "hasTheme",
      width: 150,
      render: (hasTheme: boolean) => (
        <Tag color={hasTheme ? "success" : "default"}>
          {hasTheme ? "Configured" : "Not configured"}
        </Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 260,
      align: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={!canEdit}
            onClick={() => navigate(`/franchise-brands/${row.id}/theme`)}
          >
            Edit theme
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!canEdit || removeTheme.isPending}
            onClick={() => confirmRemoveTheme(row)}
          >
            Remove theme
          </Button>
        </Space>
      ),
    },
  ];

  if (query.isError) {
    message.error(query.error instanceof Error ? query.error.message : "Unable to load brand themes");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">
            Brand Themes
          </Typography.Title>
          <Typography.Text type="secondary">
            Configure theme JSON for each storefront brand. Toggle activation from the theme editor.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!canEdit || query.isLoading || rows.length === 0}
          onClick={() => {
            setSelectedBrandId(undefined);
            setAddModalOpen(true);
          }}
        >
          Add theme
        </Button>
      </div>

      <div>
        <Input
          allowClear
          placeholder="Search brand…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Table<BrandThemeRow>
        rowKey={(row) => row.id}
        columns={columns}
        dataSource={rows}
        loading={query.isLoading}
        locale={{ emptyText: <Empty description="No storefront brands found" /> }}
        pagination={false}
        scroll={{ x: 800 }}
      />

      <Modal
        open={addModalOpen}
        title="Add storefront brand theme"
        okText="Open theme editor"
        onCancel={() => setAddModalOpen(false)}
        onOk={openTheme}
        okButtonProps={{ disabled: !selectedBrandId }}
      >
        <Typography.Paragraph type="secondary">
          Select the storefront brand that should receive a theme. If it already has one, the
          existing theme will open for editing instead of creating a duplicate.
        </Typography.Paragraph>
        <Select
          className="w-full"
          showSearch
          optionFilterProp="label"
          placeholder="Select a storefront brand"
          value={selectedBrandId}
          onChange={setSelectedBrandId}
          options={rows.map((brand) => ({
            value: brand.id,
            label: brand.name,
          }))}
        />
      </Modal>
    </div>
  );
}
