import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App as AntdApp, Button, Empty, Input, Modal, Space, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { deleteStorefrontTheme, getStorefrontThemes } from "@/lib/storefrontApi";
import type { StorefrontThemeDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function statusTag(isActive: boolean) {
  return <Tag color={isActive ? "success" : "default"}>{isActive ? "Active" : "Inactive"}</Tag>;
}

export default function StorefrontThemesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 350).trim().toLowerCase();

  const query = useQuery({
    queryKey: ["storefront", "themes"],
    queryFn: async () => {
      const res = await getStorefrontThemes();
      if (!res.status) throw new Error(res.message ?? "Failed to load storefront themes");
      return res.data ?? [];
    },
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: async (theme: StorefrontThemeDto) => {
      const res = await deleteStorefrontTheme(theme.id);
      if (!res.status) throw new Error(res.message ?? "Failed to remove storefront theme");
      return theme;
    },
    onSuccess: (theme) => {
      message.success(`${theme.themeName ?? "Theme"} removed`);
      void queryClient.invalidateQueries({ queryKey: ["storefront", "themes"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "Failed to remove theme"),
  });

  const rows = (query.data ?? []).filter((theme) =>
    (theme.themeName ?? "").toLowerCase().includes(debouncedKeyword),
  );

  const confirmRemove = (theme: StorefrontThemeDto) => {
    Modal.confirm({
      title: `Remove ${theme.themeName ?? "this theme"}?`,
      content: "The theme will be removed from the standalone theme library.",
      okText: "Remove theme",
      okButtonProps: { danger: true },
      onOk: () => removeMutation.mutateAsync(theme),
    });
  };

  const columns: TableColumnsType<StorefrontThemeDto> = [
    {
      title: "Theme",
      dataIndex: "themeName",
      render: (name: string | null, row) => (
        <div>
          <div className="font-medium">{name || "Untitled"}</div>
          <Typography.Text type="secondary" className="text-xs">{row.id}</Typography.Text>
        </div>
      ),
    },
    { title: "Status", dataIndex: "isActive", width: 150, render: statusTag },
    {
      title: "Created",
      dataIndex: "dateCreated",
      width: 180,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      title: "",
      key: "actions",
      width: 240,
      align: "right",
      render: (_, theme) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} disabled={!canEdit}
            onClick={() => navigate(`/storefront-themes/${theme.id}`)}>
            Edit
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={!canEdit || removeMutation.isPending}
            onClick={() => confirmRemove(theme)}>
            Remove
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Typography.Title level={3} className="!m-0">Storefront themes</Typography.Title>
          <Typography.Text type="secondary">
            Create and manage standalone theme templates. Themes are not tied to brands or owners.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} disabled={!canEdit}
          onClick={() => navigate("/storefront-themes/new")}>
          Add theme
        </Button>
      </div>

      <Input allowClear placeholder="Search themes…" value={keyword}
        onChange={(event) => setKeyword(event.target.value)} className="max-w-md" />

      <Table<StorefrontThemeDto>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={query.isLoading}
        locale={{ emptyText: <Empty description={query.isError ? "Unable to load themes" : "No themes configured"} /> }}
        pagination={false}
        scroll={{ x: 800 }}
      />
    </div>
  );
}
