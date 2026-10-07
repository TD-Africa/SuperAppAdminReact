import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { App as AntdApp, Button, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import { getStorefrontBrands } from "@/lib/storefrontApi";
import type { StorefrontBrandAdminDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function statusTag(isActive: boolean) {
  return <Tag color={isActive ? "success" : "default"}>{isActive ? "Active" : "Inactive"}</Tag>;
}

export default function FranchiseBrandThemesPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const [keyword, setKeyword] = useState("");
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

      if (keywordFilter) {
        return all.filter((b) => (b.name ?? "").toLowerCase().includes(keywordFilter));
      }
      return all;
    },
    staleTime: 30_000,
  });

  const rows = query.data ?? [];

  const columns: TableColumnsType<StorefrontBrandAdminDto> = [
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
      title: "",
      key: "actions",
      width: 140,
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

      <Table<StorefrontBrandAdminDto>
        rowKey={(row) => row.id}
        columns={columns}
        dataSource={rows}
        loading={query.isLoading}
        locale={{ emptyText: <Empty description="No storefront brands found" /> }}
        pagination={false}
        scroll={{ x: 800 }}
      />
    </div>
  );
}

