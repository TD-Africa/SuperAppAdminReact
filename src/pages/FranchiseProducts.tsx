import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, App as AntdApp, Button, Card, Empty, Input, Select, Table, Tag, Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { EditOutlined, PercentageOutlined } from "@ant-design/icons";
import {
  commissionMockStore,
  formatNaira,
  type CommissionSource,
  type FranchiseCatalogRow,
} from "@/components/brand-commission/mockStore";

const sourceTag = (source: CommissionSource, markup: number | null, brandName: string) => {
  if (source === "override") return <Tag color="purple">Override · {markup?.toFixed(2)}%</Tag>;
  if (source === "inherited") return <Tag color="success">Inherited ({brandName} {markup?.toFixed(2)}%)</Tag>;
  return <Tag color="warning">Not configured</Tag>;
};

export default function FranchiseProductsPage() {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<FranchiseCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CommissionSource | "all">("all");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const catalog = await commissionMockStore.getCatalog();
        if (active) setRows(catalog);
      } catch {
        message.error("Unable to load mock franchise products.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return commissionMockStore.subscribe(() => void load());
  }, [message]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q)
        || row.sku.toLowerCase().includes(q)
        || row.brandName.toLowerCase().includes(q)
        || row.dynamicsId.toLowerCase().includes(q);
    });
  }, [rows, search, sourceFilter]);

  const columns: TableColumnsType<FranchiseCatalogRow> = [
    {
      title: "Product",
      dataIndex: "name",
      fixed: "left",
      width: 220,
      render: (name: string, row) => (
        <div className="max-w-[200px]">
          <div className="truncate font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{row.sku}</div>
        </div>
      ),
    },
    { title: "Brand", dataIndex: "brandName", width: 120 },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 80,
      align: "right",
      render: (qty: number) => qty.toLocaleString(),
    },
    {
      title: "Price (NGN)",
      dataIndex: "basePrice",
      width: 140,
      align: "right",
      render: (price: number) => formatNaira(price),
    },
    {
      title: "Price (USD)",
      dataIndex: "priceInDollar",
      width: 120,
      align: "right",
      render: (price: number) => `$${price.toLocaleString()}`,
    },
    {
      title: "Storefront price",
      key: "storefront",
      width: 160,
      align: "right",
      render: (_, row) => row.storefront === null
        ? <Typography.Text type="secondary">Not configured</Typography.Text>
        : <span className="font-semibold text-[#800020]">{formatNaira(row.storefront)}</span>,
    },
    {
      title: "Markup",
      key: "markup",
      width: 100,
      align: "right",
      render: (_, row) => row.markupPercent === null
        ? "—"
        : <span className="font-medium">{row.markupPercent.toFixed(2)}%</span>,
    },
    {
      title: "Source",
      key: "source",
      width: 200,
      render: (_, row) => sourceTag(row.source, row.markupPercent, row.brandName),
    },
    {
      title: "Dynamics ID",
      dataIndex: "dynamicsId",
      width: 140,
      render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span>,
    },
    {
      title: "Visible",
      dataIndex: "isVisible",
      width: 90,
      render: (v: boolean) => <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>,
    },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 90,
      render: (v: boolean) => <Tag color={v ? "success" : "default"}>{v ? "Yes" : "No"}</Tag>,
    },
    {
      title: "Featured",
      dataIndex: "isFeatured",
      width: 100,
      render: (v: boolean) => <Tag color={v ? "gold" : "default"}>{v ? "Yes" : "No"}</Tag>,
    },
    {
      title: "",
      key: "actions",
      fixed: "right",
      width: 150,
      align: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => navigate(`/franchise-brand-commissions/${row.brandId}`)}
        >
          Edit storefront
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">Franchise products</Typography.Title>
        <Typography.Text type="secondary">
          Parallel catalogue (mock). Includes storefront price and markup — use this page, not Products.
        </Typography.Text>
      </div>

      {/* <Alert
        type="info"
        showIcon
        message="Storefront price = product price + markup"
        description="Scroll the table horizontally to see Storefront price, Markup, Source, and the rest of the columns."
      /> */}

      <Card styles={{ body: { padding: 16 } }}>
        <div className="grid gap-3 md:grid-cols-12">
          <Input
            className="md:col-span-8"
            allowClear
            placeholder="Search product, SKU, brand, or Dynamics ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<PercentageOutlined className="text-muted-foreground" />}
          />
          <Select
            className="md:col-span-4"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "all", label: "All sources" },
              { value: "inherited", label: "Inherited" },
              { value: "override", label: "Overridden" },
              { value: "unset", label: "Not configured" },
            ]}
          />
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<FranchiseCatalogRow>
          rowKey="id"
          columns={columns}
          dataSource={visible}
          loading={loading}
          scroll={{ x: 1700 }}
          locale={{ emptyText: <Empty description="No franchise products" /> }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
