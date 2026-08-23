import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, App as AntdApp, Button, Card, Descriptions, Drawer, Empty, Form, InputNumber,
  Modal, Select, Space, Spin, Switch, Table, Tag, Timeline, Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import {
  commissionMockStore, formatNaira, markupFromStorefront, resolveCommission, storefrontPrice,
  type AuditEntry, type CommissionBrand, type CommissionProduct, type CommissionSource,
} from "@/components/brand-commission/mockStore";

const sourceTag = (source: CommissionSource, rate: number | null, brandName: string) => {
  if (source === "override") return <Tag color="purple">Override · {rate?.toFixed(2)}% markup</Tag>;
  if (source === "inherited") return <Tag color="success">Inherited ({brandName} {rate?.toFixed(2)}%)</Tag>;
  return <Tag color="warning">Commission not configured</Tag>;
};

export default function BrandCommissionDetailPage() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [brand, setBrand] = useState<CommissionBrand | null>(null);
  const [products, setProducts] = useState<CommissionProduct[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [inheritable, setInheritable] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<CommissionSource | "all">("all");
  const [impactOpen, setImpactOpen] = useState(false);
  const [impact, setImpact] = useState({ affectedCount: 0, overrideCount: 0 });
  const [editingProduct, setEditingProduct] = useState<CommissionProduct | null>(null);
  /** Editable field — storefront price only. Null means revert to brand rate. */
  const [draftStorefront, setDraftStorefront] = useState<number | null>(null);
  const [clearOverride, setClearOverride] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const [nextBrand, nextProducts, nextAudit] = await Promise.all([
        commissionMockStore.getBrand(brandId),
        commissionMockStore.getProducts(brandId),
        commissionMockStore.getAudit(brandId),
      ]);
      if (!active) return;
      setBrand(nextBrand);
      setProducts(nextProducts);
      setAudit(nextAudit);
      setRate(nextBrand?.commissionRate ?? null);
      setInheritable(nextBrand?.isInheritable ?? false);
      setLoading(false);
    };
    void load();
    return commissionMockStore.subscribe(() => void load());
  }, [brandId]);

  const visibleProducts = useMemo(() => {
    if (!brand || sourceFilter === "all") return products;
    return products.filter((product) => resolveCommission(product, brand).source === sourceFilter);
  }, [brand, products, sourceFilter]);

  async function previewImpact() {
    if (!brandId) return;
    const result = await commissionMockStore.getImpact(brandId);
    setImpact(result);
    setImpactOpen(true);
  }

  async function saveBrand() {
    if (!brandId) return;
    setSaving(true);
    try {
      await commissionMockStore.saveBrand(brandId, rate, inheritable);
      message.success("Mock brand commission saved.");
      setImpactOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function openStorefrontEditor(product: CommissionProduct) {
    if (!brand) return;
    const { rate: effective } = resolveCommission(product, brand);
    setEditingProduct(product);
    setClearOverride(false);
    setDraftStorefront(storefrontPrice(product.basePrice, effective));
  }

  async function saveStorefront() {
    if (!editingProduct || !brand) return;
    setSaving(true);
    try {
      if (clearOverride) {
        await commissionMockStore.saveProductOverride(editingProduct.id, null);
        message.success("Reverted to brand rate.");
      } else {
        if (draftStorefront === null || draftStorefront < editingProduct.basePrice) {
          message.error("Storefront price must be at least the product price.");
          return;
        }
        const markup = markupFromStorefront(editingProduct.basePrice, draftStorefront);
        if (markup === null) {
          message.error("Unable to derive markup from storefront price.");
          return;
        }
        await commissionMockStore.saveProductOverride(editingProduct.id, Number(markup.toFixed(2)));
        message.success("Storefront price saved.");
      }
      setEditingProduct(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!brand) {
    return (
      <Empty description="Franchise brand commission record not found">
        <Button onClick={() => navigate("/franchise-brand-commissions")}>Back to commissions</Button>
      </Empty>
    );
  }

  const columns: TableColumnsType<CommissionProduct> = [
    {
      title: "Product",
      dataIndex: "name",
      render: (name: string, product) => (
        <div>
          <div className="font-medium">{name}</div>
          <Typography.Text type="secondary" className="text-xs">{product.sku}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Product price",
      dataIndex: "basePrice",
      render: (price: number) => (
        <div>
          <div>{formatNaira(price)}</div>
          <Typography.Text type="secondary" className="text-xs">Read-only</Typography.Text>
        </div>
      ),
    },
    {
      title: "Storefront price",
      key: "storefront",
      render: (_, product) => {
        const { rate: effective } = resolveCommission(product, brand);
        const priced = storefrontPrice(product.basePrice, effective);
        if (priced === null) {
          return <Typography.Text type="secondary">Not configured</Typography.Text>;
        }
        return <span className="font-medium">{formatNaira(priced)}</span>;
      },
    },
    {
      title: "Markup",
      key: "markup",
      render: (_, product) => {
        const { rate: effective } = resolveCommission(product, brand);
        return effective === null ? "—" : `${effective.toFixed(2)}%`;
      },
    },
    {
      title: "Source",
      key: "source",
      render: (_, product) => {
        const result = resolveCommission(product, brand);
        return sourceTag(result.source, result.rate, brand.name);
      },
    },
    {
      title: "",
      key: "actions",
      align: "right",
      render: (_, product) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openStorefrontEditor(product)}>
          Edit storefront price
        </Button>
      ),
    },
  ];

  const derivedMarkup = editingProduct && draftStorefront !== null && !clearOverride
    ? markupFromStorefront(editingProduct.basePrice, draftStorefront)
    : null;

  const brandDefaultStorefront = editingProduct
    ? storefrontPrice(editingProduct.basePrice, brand.isInheritable ? brand.commissionRate : null)
    : null;

  return (
    <div className="space-y-6">
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/franchise-brand-commissions")}>
          All commissions
        </Button>
        <Typography.Text type="secondary">Mock-only workspace</Typography.Text>
      </Space>
      <div>
        <Typography.Title level={3} className="!m-0">{brand.name} — franchise brand commission</Typography.Title>
        <Typography.Text type="secondary">
          Brand default sets inheritance. On products, only storefront price is editable — markup is derived.
        </Typography.Text>
      </div>

      <Card title="Franchise brand commission settings">
        <Form layout="vertical" className="max-w-xl">
          <Form.Item label="Default markup %" extra="Inherited by products without a storefront override. TD Customers pay product price + markup.">
            <InputNumber min={0} max={100} precision={2} addonAfter="%" className="w-full" value={rate} onChange={setRate} placeholder="Enter a rate" />
          </Form.Item>
          <Form.Item label="Mark as inheritable" extra="Products without a storefront override use this brand markup.">
            <Switch checked={inheritable} onChange={setInheritable} checkedChildren="Inheritable" unCheckedChildren="Not inheritable" />
          </Form.Item>
          {!inheritable && rate !== null && (
            <Alert className="mb-4" type="warning" showIcon message="Rate is stored but not applied to products while inheritance is off." />
          )}
          <Space>
            <Button type="primary" onClick={() => void previewImpact()}>Review impact</Button>
            <Button onClick={() => { setRate(brand.commissionRate); setInheritable(brand.isInheritable); }}>Reset</Button>
          </Space>
        </Form>
      </Card>

      <Card
        title={`Products (${products.length})`}
        extra={
          <Select
            value={sourceFilter}
            onChange={setSourceFilter}
            className="min-w-40"
            options={[
              { value: "all", label: "All sources" },
              { value: "inherited", label: "Inherited" },
              { value: "override", label: "Overridden" },
              { value: "unset", label: "Not configured" },
            ]}
          />
        }
      >
        <Table rowKey="id" columns={columns} dataSource={visibleProducts} pagination={false} />
      </Card>

      <Card title="Audit trail">
        {audit.length ? (
          <Timeline
            items={audit.map((entry) => ({
              children: (
                <div>
                  <div>{entry.description}</div>
                  <Typography.Text type="secondary" className="text-xs">
                    {new Date(entry.timestamp).toLocaleString()} · {entry.actor}
                  </Typography.Text>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty description="No mock audit history" />
        )}
      </Card>

      <Modal
        open={impactOpen}
        title="Review commission impact"
        onCancel={() => setImpactOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setImpactOpen(false)}>Cancel</Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => void saveBrand()}>Save commission</Button>,
        ]}
      >
        <Descriptions
          column={1}
          bordered
          size="small"
          items={[
            { key: "rate", label: "New brand markup", children: rate === null ? "Not set" : `${rate.toFixed(2)}%` },
            { key: "inheritance", label: "Inheritance", children: inheritable ? "Enabled" : "Disabled" },
            { key: "affected", label: "Products updated", children: impact.affectedCount },
            { key: "overrides", label: "Storefront overrides unchanged", children: impact.overrideCount },
          ]}
        />
        <Alert
          className="mt-4"
          type="info"
          showIcon
          message={`This affects ${impact.affectedCount} product${impact.affectedCount === 1 ? "" : "s"} without storefront overrides.`}
        />
      </Modal>

      <Drawer
        open={editingProduct !== null}
        title={`Edit storefront price — ${editingProduct?.name ?? ""}`}
        onClose={() => setEditingProduct(null)}
        extra={
          <Button type="primary" loading={saving} onClick={() => void saveStorefront()}>
            Save
          </Button>
        }
      >
        {editingProduct && (
          <>
            <Descriptions
              column={1}
              size="small"
              className="mb-4"
              items={[
                { key: "base", label: "Product price", children: formatNaira(editingProduct.basePrice) },
                {
                  key: "brand",
                  label: "Brand default storefront",
                  children: brandDefaultStorefront === null
                    ? "Not configured"
                    : `${formatNaira(brandDefaultStorefront)} (${brand.commissionRate?.toFixed(2) ?? "—"}%)`,
                },
              ]}
            />

            <Form layout="vertical">
              <Form.Item
                label="Storefront price"
                required
                extra="Only this field is editable. Markup is calculated automatically."
              >
                <InputNumber
                  min={editingProduct.basePrice}
                  precision={0}
                  addonBefore="₦"
                  className="w-full"
                  disabled={clearOverride}
                  value={clearOverride ? brandDefaultStorefront : draftStorefront}
                  onChange={(value) => {
                    setClearOverride(false);
                    setDraftStorefront(value);
                  }}
                  placeholder="Enter storefront price"
                />
              </Form.Item>
            </Form>

            <Alert
              className="mb-4"
              type={clearOverride ? "warning" : "info"}
              showIcon
              message="Derived markup"
              description={
                clearOverride
                  ? brandDefaultStorefront === null
                    ? "Reverting clears the override. Brand rate is not configured."
                    : `Will revert to brand rate → storefront ${formatNaira(brandDefaultStorefront)} · markup ${brand.commissionRate?.toFixed(2)}%`
                  : derivedMarkup === null
                    ? "Enter a storefront price at or above the product price."
                    : `${formatNaira(editingProduct.basePrice)} → ${formatNaira(draftStorefront!)} = ${derivedMarkup.toFixed(2)}% markup`
              }
            />

            <Button
              danger
              block
              disabled={editingProduct.commissionOverride === null && !clearOverride}
              onClick={() => {
                setClearOverride(true);
                setDraftStorefront(brandDefaultStorefront);
              }}
            >
              Remove override / revert to brand rate
            </Button>
          </>
        )}
      </Drawer>
    </div>
  );
}
