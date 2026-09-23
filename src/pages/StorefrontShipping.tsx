import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Alert,
  AutoComplete,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CalculatorOutlined,
  CarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  addStorefrontShippingRate,
  deleteStorefrontShippingRate,
  getStorefrontShippingQuote,
  getStorefrontShippingRates,
  updateStorefrontShippingRate,
} from "@/lib/storefrontApi";
import { useStorefrontShippingOptions } from "@/hooks/useStorefrontShippingOptions";
import type {
  StorefrontShippingQuoteDto,
  StorefrontShippingQuoteRequest,
  StorefrontShippingRateDto,
  StorefrontShippingRateRequest,
} from "@/lib/storefrontTypes";
import { formatCurrency, formatDate } from "@/lib/utils";

interface QuoteFormValues {
  originRegion: string;
  destinationRegion: string;
  paymentMode: string;
  weightKg: number;
}

const CURRENCY_OPTIONS = [
  { value: "NGN", label: "NGN" },
  { value: "USD", label: "USD" },
];

export default function StorefrontShippingPage() {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<QuoteFormValues>();
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<StorefrontShippingQuoteDto | null>(null);

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<StorefrontShippingRateDto | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const optionsQuery = useStorefrontShippingOptions();

  const options = optionsQuery.data;

  const ratesQuery = useQuery({
    queryKey: ["storefront", "shipping-rates"],
    queryFn: async () => {
      const res = await getStorefrontShippingRates();
      if (!res.status) throw new Error(res.message ?? "Failed to load shipping rates");
      return res.data ?? [];
    },
  });

  const watched = Form.useWatch([], form) as Partial<QuoteFormValues> | undefined;
  const canQuote = Boolean(
    watched?.originRegion &&
      watched?.destinationRegion &&
      watched?.paymentMode &&
      (watched?.weightKg ?? 0) > 0,
  );

  const originOptions = useMemo(
    () => (options?.originRegions ?? []).map((r) => ({ value: r, label: r })),
    [options?.originRegions],
  );
  const destinationOptions = useMemo(
    () => (options?.destinationRegions ?? []).map((r) => ({ value: r, label: r })),
    [options?.destinationRegions],
  );
  const paymentModeOptions = useMemo(
    () => (options?.paymentModes ?? []).map((m) => ({ value: m, label: m })),
    [options?.paymentModes],
  );

  // Prefill sensible defaults once the options load.
  useEffect(() => {
    if (!options) return;
    form.setFieldsValue({
      originRegion: options.defaultOriginRegion ?? options.originRegions?.[0] ?? undefined,
      paymentMode: options.defaultPaymentMode ?? options.paymentModes?.[0] ?? undefined,
    });
  }, [options, form]);

  async function handleQuote() {
    let values: QuoteFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setQuoting(true);
    setQuote(null);
    try {
      const body: StorefrontShippingQuoteRequest = {
        originRegion: values.originRegion,
        destinationRegion: values.destinationRegion,
        paymentMode: values.paymentMode,
        weightKg: values.weightKg,
      };
      const res = await getStorefrontShippingQuote(body);
      if (!res.status || !res.data) {
        message.error(res.message ?? "Quote failed");
        return;
      }
      setQuote(res.data);
    } finally {
      setQuoting(false);
    }
  }

  async function handleDelete(rateId: string) {
    setDeletingId(rateId);
    try {
      const res = await deleteStorefrontShippingRate(rateId);
      if (!res.status) {
        message.error(res.message ?? "Delete failed");
        return;
      }
      message.success("Shipping rate deleted");
      queryClient.invalidateQueries({ queryKey: ["storefront", "shipping-rates"] });
      queryClient.invalidateQueries({ queryKey: ["storefront", "shipping-options"] });
    } finally {
      setDeletingId(null);
    }
  }

  const columns: TableColumnsType<StorefrontShippingRateDto> = [
    {
      title: "Route",
      key: "route",
      render: (_, r) => (
        <span>
          {r.originRegion ?? "—"} <span className="text-muted-foreground">→</span>{" "}
          {r.destinationRegion ?? "—"}
        </span>
      ),
    },
    {
      title: "Payment mode",
      dataIndex: "paymentMode",
      render: (v) => v ?? "—",
    },
    {
      title: "Base fee",
      dataIndex: "baseFee",
      align: "right",
      render: (v, r) => formatCurrency(v, (r.currency as "USD" | "NGN") ?? "NGN"),
    },
    {
      title: "Extra kg fee",
      dataIndex: "extraKgFee",
      align: "right",
      render: (v, r) => formatCurrency(v, (r.currency as "USD" | "NGN") ?? "NGN"),
    },
    {
      title: "Active",
      dataIndex: "isActive",
      width: 90,
      render: (v) => (v ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>),
    },
    {
      title: "Created",
      dataIndex: "dateCreated",
      width: 140,
      render: (v) => <span className="text-xs">{formatDate(v)}</span>,
    },
    {
      title: "",
      key: "actions",
      width: 100,
      align: "right",
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRate(r);
              setRateModalOpen(true);
            }}
          />
          <Popconfirm
            title="Delete this shipping rate?"
            description="This cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deletingId === r.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const currency = (quote?.currency as "USD" | "NGN") ?? "NGN";

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Storefront Shipping
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage shipping rates and quote delivery fees by origin, destination,
          payment mode, and weight.
        </Typography.Text>
      </div>

      {/* Shipping rates */}
      <Card
        title={
          <Space>
            <CarOutlined />
            <span>Shipping rates</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              onClick={() => {
                setImportModalOpen(true);
              }}
            >
              Import CSV
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRate(null);
                setRateModalOpen(true);
              }}
            >
              Add rate
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table<StorefrontShippingRateDto>
          rowKey="id"
          columns={columns}
          dataSource={ratesQuery.data ?? []}
          loading={ratesQuery.isLoading}
          scroll={{ x: 800 }}
          pagination={false}
          locale={{ emptyText: <Empty description="No shipping rates configured" /> }}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Options overview */}
        <Card
          className="lg:col-span-5"
          title={
            <Space>
              <CarOutlined />
              <span>Shipping options</span>
            </Space>
          }
        >
          {optionsQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : optionsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load shipping options"
              description={(optionsQuery.error as Error).message}
              action={
                <Button size="small" onClick={() => optionsQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : !options ? (
            <Empty description="No shipping options configured." />
          ) : (
            <div className="space-y-4">
              <Statistic
                title="Base weight"
                value={options.baseWeightKg}
                suffix="kg"
                precision={2}
              />
              <div>
                <Typography.Text type="secondary" className="text-xs uppercase">
                  Origin regions
                </Typography.Text>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(options.originRegions ?? []).length === 0 ? (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ) : (
                    options.originRegions?.map((r) => <Tag key={r}>{r}</Tag>)
                  )}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary" className="text-xs uppercase">
                  Destination regions
                </Typography.Text>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(options.destinationRegions ?? []).length === 0 ? (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ) : (
                    options.destinationRegions?.map((r) => <Tag key={r}>{r}</Tag>)
                  )}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary" className="text-xs uppercase">
                  Payment modes
                </Typography.Text>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(options.paymentModes ?? []).length === 0 ? (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ) : (
                    options.paymentModes?.map((m) => <Tag key={m}>{m}</Tag>)
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Quote tool */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title={
              <Space>
                <CalculatorOutlined />
                <span>Get a shipping quote</span>
              </Space>
            }
          >
            <Form
              form={form}
              layout="vertical"
              onValuesChange={() => setQuote(null)}
            >
              <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
                <Form.Item
                  name="originRegion"
                  label="Origin region"
                  rules={[{ required: true, message: "Select an origin region" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Origin region"
                    options={originOptions}
                    disabled={optionsQuery.isLoading}
                  />
                </Form.Item>
                <Form.Item
                  name="destinationRegion"
                  label="Destination region"
                  rules={[{ required: true, message: "Select a destination region" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Destination region"
                    options={destinationOptions}
                    disabled={optionsQuery.isLoading}
                  />
                </Form.Item>
                <Form.Item
                  name="paymentMode"
                  label="Payment mode"
                  rules={[{ required: true, message: "Select a payment mode" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Payment mode"
                    options={paymentModeOptions}
                    disabled={optionsQuery.isLoading}
                  />
                </Form.Item>
                <Form.Item
                  name="weightKg"
                  label="Weight (kg)"
                  rules={[{ required: true, message: "Enter a weight" }]}
                >
                  <InputNumber
                    className="!w-full"
                    min={0.01}
                    max={2000000}
                    step={0.01}
                    precision={2}
                    placeholder="Weight in kilograms"
                  />
                </Form.Item>
              </div>
              <Button
                type="primary"
                icon={<CalculatorOutlined />}
                loading={quoting}
                onClick={handleQuote}
                disabled={optionsQuery.isLoading || optionsQuery.isError || !canQuote}
              >
                Get quote
              </Button>
            </Form>
          </Card>

          {quote && (
            <Card title="Quote result">
              <Descriptions
                column={{ xs: 1, sm: 2 }}
                items={[
                  {
                    key: "route",
                    label: "Route",
                    children: `${quote.originRegion ?? "—"} → ${quote.destinationRegion ?? "—"}`,
                  },
                  {
                    key: "paymentMode",
                    label: "Payment mode",
                    children: quote.paymentMode ?? "—",
                  },
                  {
                    key: "weight",
                    label: "Weight",
                    children: `${quote.weightKg} kg`,
                  },
                  {
                    key: "total",
                    label: "Total fee",
                    children: (
                      <span className="font-semibold">
                        {formatCurrency(quote.totalFee, currency)}
                      </span>
                    ),
                  },
                  {
                    key: "base",
                    label: "Base fee",
                    children: formatCurrency(quote.baseFee, currency),
                  },
                  {
                    key: "extra",
                    label: "Extra weight fee",
                    children: `${formatCurrency(quote.extraKgFee, currency)} (${quote.extraKgCount} extra kg)`,
                  },
                ]}
              />
            </Card>
          )}
        </div>
      </div>

      <ShippingRateModal
        open={rateModalOpen}
        rate={editingRate}
        onOpenChange={(v) => {
          setRateModalOpen(v);
          if (!v) setEditingRate(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["storefront", "shipping-rates"] });
          queryClient.invalidateQueries({ queryKey: ["storefront", "shipping-options"] });
        }}
      />

      <ShippingRatesImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["storefront", "shipping-rates"] });
          queryClient.invalidateQueries({ queryKey: ["storefront", "shipping-options"] });
        }}
      />
    </div>
  );
}

type RateFormValues = StorefrontShippingRateRequest;

function ShippingRateModal({
  open,
  rate,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  rate: StorefrontShippingRateDto | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<RateFormValues>();
  const [saving, setSaving] = useState(false);
  const optionsQuery = useStorefrontShippingOptions();

  useEffect(() => {
    if (!open) return;
    if (rate) {
      form.setFieldsValue({
        originRegion: rate.originRegion ?? "",
        destinationRegion: rate.destinationRegion ?? "",
        paymentMode: rate.paymentMode ?? "",
        baseFee: rate.baseFee,
        extraKgFee: rate.extraKgFee,
        currency: rate.currency ?? "NGN",
        isActive: rate.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ currency: "NGN", isActive: true, extraKgFee: 0 });
    }
  }, [open, rate, form]);

  async function handleOk() {
    let values: RateFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const body: StorefrontShippingRateRequest = {
        originRegion: values.originRegion.trim(),
        destinationRegion: values.destinationRegion.trim(),
        paymentMode: values.paymentMode.trim(),
        baseFee: values.baseFee,
        extraKgFee: values.extraKgFee,
        currency: values.currency,
        isActive: values.isActive,
      };
      const res = rate
        ? await updateStorefrontShippingRate(rate.id, body)
        : await addStorefrontShippingRate(body);
      if (!res.status) {
        message.error(res.message ?? "Save failed");
        return;
      }
      message.success(res.message ?? (rate ? "Shipping rate updated" : "Shipping rate added"));
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={rate ? "Edit shipping rate" : "Add shipping rate"}
      okText={rate ? "Save changes" : "Add rate"}
      confirmLoading={saving}
      onCancel={() => onOpenChange(false)}
      onOk={handleOk}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
          <Form.Item
            name="originRegion"
            label="Origin region"
            rules={[{ required: true, message: "Enter an origin region" }]}
          >
            <AutoComplete
              placeholder="e.g. Lagos"
              options={(optionsQuery.data?.originRegions ?? []).map((r) => ({ value: r }))}
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="destinationRegion"
            label="Destination region"
            rules={[{ required: true, message: "Enter a destination region" }]}
          >
            <AutoComplete
              placeholder="e.g. Abuja"
              options={(optionsQuery.data?.destinationRegions ?? []).map((r) => ({ value: r }))}
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="paymentMode"
            label="Payment mode"
            rules={[{ required: true, message: "Enter a payment mode" }]}
          >
            <AutoComplete
              placeholder="e.g. Prepaid"
              options={(optionsQuery.data?.paymentModes ?? []).map((m) => ({ value: m }))}
              filterOption={(input, option) =>
                (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="currency"
            label="Currency"
            rules={[{ required: true, message: "Select a currency" }]}
          >
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="baseFee"
            label="Base fee"
            rules={[
              { required: true, message: "Base fee is required" },
              { type: "number", min: 0, message: "Cannot be negative" },
            ]}
          >
            <InputNumber className="!w-full" min={0} precision={2} />
          </Form.Item>
          <Form.Item
            name="extraKgFee"
            label="Extra kg fee"
            rules={[{ type: "number", min: 0, message: "Cannot be negative" }]}
          >
            <InputNumber className="!w-full" min={0} precision={2} />
          </Form.Item>
        </div>
        <Form.Item
          name="isActive"
          label="Active"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ShippingRatesImportModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [rows, setRows] = useState<StorefrontShippingRateRequest[]>([]);
  const [importing, setImporting] = useState(false);

  function resetState() {
    setFileName(null);
    setParsingError(null);
    setRows([]);
    setImporting(false);
  }

  function handleClose() {
    if (importing) return;
    resetState();
    onOpenChange(false);
  }

  function parseCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV must include a header row and at least one data row.");
    }

    const headerLine = lines[0];
    const headers = headerLine
      .split(",")
      .map((h) => h.trim().toLowerCase());

    function idx(name: string) {
      return headers.indexOf(name);
    }

    const originIdx = idx("originregion");
    const destIdx = idx("destinationregion");
    const modeIdx = idx("paymentmode");
    const baseIdx = idx("basefee");
    const extraIdx = idx("extrakgfee");
    const currencyIdx = idx("currency");
    const activeIdx = idx("isactive");

    if (originIdx === -1 || destIdx === -1 || modeIdx === -1 || baseIdx === -1) {
      throw new Error(
        "Header must include at least: originRegion,destinationRegion,paymentMode,baseFee.",
      );
    }

    const parsed: StorefrontShippingRateRequest[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const raw = lines[i];
      if (!raw) continue;
      const cells = raw.split(",").map((c) => c.trim());

      const originRegion = cells[originIdx] ?? "";
      const destinationRegion = cells[destIdx] ?? "";
      const paymentMode = cells[modeIdx] ?? "";
      const baseRaw = cells[baseIdx] ?? "";
      const extraRaw = extraIdx >= 0 ? cells[extraIdx] ?? "" : "";
      const currencyRaw = currencyIdx >= 0 ? cells[currencyIdx] ?? "" : "";
      const activeRaw = activeIdx >= 0 ? cells[activeIdx] ?? "" : "";

      if (!originRegion || !destinationRegion || !paymentMode) {
        throw new Error(
          `Row ${i + 1}: originRegion, destinationRegion, and paymentMode are required.`,
        );
      }

      const baseFee = Number(baseRaw);
      if (!Number.isFinite(baseFee)) {
        throw new Error(`Row ${i + 1}: baseFee must be a valid number.`);
      }

      let extraKgFee = 0;
      if (extraRaw) {
        const parsedExtra = Number(extraRaw);
        if (!Number.isFinite(parsedExtra)) {
          throw new Error(`Row ${i + 1}: extraKgFee must be a valid number when provided.`);
        }
        extraKgFee = parsedExtra;
      }

      const currency = (currencyRaw || "NGN").toUpperCase();

      let isActive = true;
      if (activeRaw) {
        const v = activeRaw.toLowerCase();
        if (["true", "1", "yes", "y"].includes(v)) isActive = true;
        else if (["false", "0", "no", "n"].includes(v)) isActive = false;
        else {
          throw new Error(
            `Row ${i + 1}: isActive must be true/false (or 1/0, yes/no, y/n).`,
          );
        }
      }

      parsed.push({
        originRegion,
        destinationRegion,
        paymentMode,
        baseFee,
        extraKgFee,
        currency,
        isActive,
      });
    }

    return parsed;
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseCsv(text);
        setRows(parsed);
        setFileName(file.name);
        setParsingError(null);
        message.success(`Parsed ${parsed.length} row(s) from ${file.name}`);
      } catch (err) {
        setRows([]);
        setParsingError(err instanceof Error ? err.message : "Failed to parse CSV file.");
      }
    };
    reader.onerror = () => {
      setRows([]);
      setParsingError("Could not read file.");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (rows.length === 0) {
      message.error("Please choose a CSV file with at least one valid row.");
      return;
    }
    setImporting(true);
    try {
      const results = await Promise.allSettled(
        rows.map((r) => addStorefrontShippingRate(r)),
      );

      let successCount = 0;
      let failCount = 0;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.status) {
          successCount += 1;
        } else {
          failCount += 1;
        }
      }

      if (successCount > 0) {
        message.success(
          `Imported ${successCount} shipping rate${successCount === 1 ? "" : "s"}${
            failCount ? ` (${failCount} failed)` : ""
          }.`,
        );
        onImported();
        resetState();
        onOpenChange(false);
      } else {
        message.error("All rows failed to import. Please check your CSV and try again.");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Import shipping rates from CSV"
      okText="Import"
      confirmLoading={importing}
      onCancel={handleClose}
      onOk={handleImport}
      destroyOnClose
    >
      <div className="space-y-3">
        <Typography.Paragraph type="secondary">
          Upload a CSV file with columns:{" "}
          <code>
            originRegion,destinationRegion,paymentMode,baseFee,extraKgFee,currency,isActive
          </code>
          . Extra kg fee and isActive are optional.
        </Typography.Paragraph>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          disabled={importing}
        />

        {fileName && (
          <Typography.Text type="secondary">
            Selected file: <strong>{fileName}</strong> ({rows.length} row
            {rows.length === 1 ? "" : "s"} parsed)
          </Typography.Text>
        )}

        {parsingError && (
          <Alert
            type="error"
            showIcon
            message="Could not parse CSV"
            description={parsingError}
          />
        )}
      </div>
    </Modal>
  );
}
