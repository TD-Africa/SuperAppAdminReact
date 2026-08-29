import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EyeOutlined, ShopOutlined } from "@ant-design/icons";
import { getStoreOwners } from "@/lib/storefrontApi";
import type { StorefrontStoreOwnerDto } from "@/lib/storefrontTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function ownerDisplayName(row: StorefrontStoreOwnerDto) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function openOwnerPath(row: StorefrontStoreOwnerDto) {
  const params = new URLSearchParams();
  if (row.companyName?.trim()) params.set("company", row.companyName.trim());
  const name = ownerDisplayName(row);
  if (name) params.set("owner", name);
  if (row.userName?.trim()) params.set("user", row.userName.trim());
  const qs = params.toString();
  return `/franchise-store-owners/${row.id}${qs ? `?${qs}` : ""}`;
}

export default function FranchiseStoreOwnersPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(
    () => ({
      PageSize: pageSize,
      PageNumber: page,
      SearchString: debouncedSearch.trim() || undefined,
    }),
    [pageSize, page, debouncedSearch],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["storefront", "store-owners", queryParams],
    queryFn: async () => {
      const res = await getStoreOwners(queryParams);
      if (!res.status) throw new Error(res.message ?? "Failed to load store owners");
      return res.data;
    },
  });

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? error.message : "Unable to load store owners.",
      );
    }
  }, [isError, error, message]);

  const rows = data?.data ?? [];
  const totalItems = Number(data?.count ?? 0);

  const columns: TableColumnsType<StorefrontStoreOwnerDto> = [
    {
      title: "Company",
      dataIndex: "companyName",
      render: (v: string | null, row) => (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-[#800020] hover:underline"
          onClick={() => navigate(openOwnerPath(row))}
        >
          {v?.trim() || "—"}
        </button>
      ),
    },
    {
      title: "Owner",
      key: "owner",
      render: (_, row) => ownerDisplayName(row) || "—",
    },
    {
      title: "Username",
      dataIndex: "userName",
      render: (v: string | null) => (
        <span className="text-xs text-muted-foreground">{v ?? "—"}</span>
      ),
    },
    {
      title: "CAC verified",
      dataIndex: "isCacVerified",
      width: 130,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "default"}>{v ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Verified at",
      dataIndex: "cacVerifiedAt",
      width: 180,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleString() : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "",
      key: "actions",
      width: 90,
      align: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(openOwnerPath(row))}
            title="View wallet & earnings"
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">Franchise store owners</Typography.Title>
        <Typography.Text type="secondary">
          Active SuperApp customers with completed CAC verification (store directory).
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search company, name, or username…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          prefix={<ShopOutlined className="text-muted-foreground" />}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StorefrontStoreOwnerDto>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isLoading || isFetching}
          locale={{ emptyText: <Empty description="No store owners" /> }}
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
        />
      </Card>
    </div>
  );
}
