import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntdApp, Avatar, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { AppstoreOutlined, SettingOutlined, ShopOutlined } from "@ant-design/icons";
import { commissionMockStore, type FranchiseBrandRow } from "@/components/brand-commission/mockStore";

function inheritanceTag(brand: FranchiseBrandRow) {
  if (brand.commissionRate === null) return <Tag color="warning">Not set</Tag>;
  return brand.isInheritable
    ? <Tag color="success">Inheritable</Tag>
    : <Tag>Not inheritable</Tag>;
}

export default function FranchiseBrandsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [brands, setBrands] = useState<FranchiseBrandRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "inheritable" | "not-inheritable" | "unset">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await commissionMockStore.getBrandSummaries();
        if (active) setBrands(rows);
      } catch {
        message.error("Unable to load mock franchise brands.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return commissionMockStore.subscribe(() => void load());
  }, [message]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands.filter((brand) => {
      if (statusFilter === "unset" && brand.commissionRate !== null) return false;
      if (statusFilter === "inheritable" && !(brand.isInheritable && brand.commissionRate !== null)) return false;
      if (statusFilter === "not-inheritable" && (brand.isInheritable || brand.commissionRate === null)) return false;
      if (!q) return true;
      return brand.name.toLowerCase().includes(q) || brand.dynamicsId.toLowerCase().includes(q);
    });
  }, [brands, search, statusFilter]);

  const columns: TableColumnsType<FranchiseBrandRow> = [
    {
      title: "",
      key: "avatar",
      width: 64,
      render: (_, brand) => (
        <Avatar shape="square" icon={<ShopOutlined />}>
          {brand.name.slice(0, 1)}
        </Avatar>
      ),
    },
    {
      title: "Brand",
      dataIndex: "name",
      render: (name: string) => <span className="font-medium">{name}</span>,
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      render: (value: string) => <span className="text-xs text-muted-foreground">{value}</span>,
    },
    {
      title: "Default markup",
      dataIndex: "commissionRate",
      render: (rate: number | null) => (
        rate === null
          ? <Typography.Text type="secondary">Not configured</Typography.Text>
          : <span className="font-medium">{rate.toFixed(2)}%</span>
      ),
    },
    { title: "Inheritance", key: "inheritance", render: (_, brand) => inheritanceTag(brand) },
    {
      title: "Products",
      dataIndex: "productCount",
      align: "right",
      render: (count: number, brand) => (
        <div>
          <div>{count}</div>
          {brand.overrideCount > 0 && (
            <Typography.Text type="secondary" className="text-xs">{brand.overrideCount} overrides</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 90,
      render: (active: boolean) => <Tag color={active ? "success" : "default"}>{active ? "Yes" : "No"}</Tag>,
    },
    {
      title: "Last updated",
      dataIndex: "updatedAt",
      render: (value: string, brand) => (
        <div>
          <div>{new Date(value).toLocaleDateString()}</div>
          <Typography.Text type="secondary" className="text-xs">{brand.updatedBy}</Typography.Text>
        </div>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      width: 220,
      render: (_, brand) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() => navigate(`/franchise-products?brand=${encodeURIComponent(brand.name)}`)}
          >
            Products
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => navigate(`/franchise-brand-commissions/${brand.id}`)}
          >
            Set markup
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">Franchise brands</Typography.Title>
        <Typography.Text type="secondary">
          Parallel brand list (mock). Default markup is inherited by products unless a storefront override is set.
        </Typography.Text>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-8"
            allowClear
            placeholder="Search brand or Dynamics ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            prefix={<ShopOutlined className="text-muted-foreground" />}
          />
          <Select
            className="md:col-span-4"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All inheritance" },
              { value: "inheritable", label: "Inheritable" },
              { value: "not-inheritable", label: "Not inheritable" },
              { value: "unset", label: "Not configured" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<FranchiseBrandRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="No franchise brands" /> }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </Card>
    </div>
  );
}
