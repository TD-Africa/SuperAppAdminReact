import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Card, Empty, Input, Space, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { PercentageOutlined, SettingOutlined } from "@ant-design/icons";
import { commissionMockStore, type CommissionBrand } from "@/components/brand-commission/mockStore";

function status(brand: CommissionBrand) {
  if (brand.commissionRate === null) return <Tag color="warning">Not set</Tag>;
  return brand.isInheritable ? <Tag color="success">Inheritable</Tag> : <Tag>Not inheritable</Tag>;
}

export default function BrandCommissionsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [brands, setBrands] = useState<CommissionBrand[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await commissionMockStore.getBrands();
        if (active) setBrands(rows);
      } catch {
        message.error("Unable to load mock commission data.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return commissionMockStore.subscribe(() => void load());
  }, [message]);

  const rows = brands.filter((brand) => brand.name.toLowerCase().includes(search.toLowerCase()));
  const columns: TableColumnsType<CommissionBrand> = [
    { title: "Brand", dataIndex: "name", render: (name: string) => <span className="font-medium">{name}</span> },
    {
      title: "Commission rate",
      dataIndex: "commissionRate",
      render: (rate: number | null, brand) => rate === null ? "—" : (
        <Space size={4}>
          <span>{rate.toFixed(2)}%</span>
          {commissionMockStore.getOverrideCount(brand.id) > 0 && (
            <Typography.Text type="secondary">· {commissionMockStore.getOverrideCount(brand.id)} overrides</Typography.Text>
          )}
        </Space>
      ),
    },
    { title: "Status", key: "status", render: (_, brand) => status(brand) },
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
      render: (_, brand) => (
        <Button type="primary" size="small" icon={<SettingOutlined />} onClick={() => navigate(`/franchise-brand-commissions/${brand.id}`)}>
          Set commission
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">Franchise brand commissions</Typography.Title>
        <Typography.Text type="secondary">
          Set inheritable brand commission rates. TD Customers pay storefront price = product price + commission.
        </Typography.Text>
      </div>
      <Card styles={{ body: { padding: 16 } }}>
        <Input
          allowClear
          placeholder="Search brands…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<PercentageOutlined className="text-muted-foreground" />}
        />
      </Card>
      <Card styles={{ body: { padding: 0 } }}>
        <Table<CommissionBrand>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          locale={{ emptyText: <Empty description="No commission brands found" /> }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      </Card>
    </div>
  );
}
