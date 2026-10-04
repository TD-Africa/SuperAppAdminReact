import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Typography,
  App as AntdApp,
} from "antd";
import { PlusOutlined, CalculatorOutlined } from "@ant-design/icons";
import { apiGet } from "@/lib/api";
import type { DeliveryMethodReturnDTO, LocationReturnDTO } from "@/lib/types";
import {
  createStorefrontOrder,
  createStorefrontSettlementOrder,
  getStorefrontShippingQuote,
  quoteStorefront,
} from "@/lib/storefrontApi";
import { useStorefrontShippingOptions } from "@/hooks/useStorefrontShippingOptions";
import type {
  StorefrontPaidOrderRequest,
  StorefrontProductQuantity,
  StorefrontShippingQuoteRequest,
} from "@/lib/storefrontTypes";
import { formatCurrency } from "@/lib/utils";

interface Props {
  open: boolean;
  ownerId: string;
  mode: "order" | "settlement";
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type FormValues = StorefrontPaidOrderRequest & {
  products?: Array<{
    productId: string;
    variantId?: string;
    locationId?: string;
    quantity: number;
  }>;
};

export function RecordStorefrontOrderModal({
  open,
  ownerId,
  mode,
  onOpenChange,
  onSuccess,
}: Props) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const [quoting, setQuoting] = useState(false);
  const [lastQuoteTotal, setLastQuoteTotal] = useState<number | null>(null);
  const [shippingQuoting, setShippingQuoting] = useState(false);
  const [lastShippingQuote, setLastShippingQuote] = useState<{
    totalFee: number;
    currency: string;
  } | null>(null);

  const { data: deliveryMethods } = useQuery({
    queryKey: ["delivery-methods"],
    queryFn: async () => {
      const res = await apiGet<DeliveryMethodReturnDTO[]>(
        "Component/GetDeliveryMethods",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load delivery methods");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load locations");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const { data: shippingOptions } = useStorefrontShippingOptions(open);
  
  useEffect(() => {
    if (open) {
      setLastQuoteTotal(null);
      setLastShippingQuote(null);
      form.setFieldsValue({
        storefrontOwnerId: ownerId,
        currency: "NGN",
        fees: 0,
        products: [],
      });
    }
  }, [open, ownerId, form]);

  // Prefill shipping defaults once options load.
  useEffect(() => {
    if (open && shippingOptions) {
      form.setFieldsValue({
        shippingOriginRegion:
          shippingOptions.defaultOriginRegion ??
          shippingOptions.originRegions?.[0] ??
          undefined,
        shippingPaymentMode:
          shippingOptions.defaultPaymentMode ??
          shippingOptions.paymentModes?.[0] ??
          undefined,
      });
    }
  }, [open, shippingOptions, form]);

  async function handleQuote() {
    const values = form.getFieldsValue();
    const lines = (values.products ?? []).filter(
      (p): p is NonNullable<typeof p> =>
        Boolean(p?.productId && p?.variantId && p?.locationId && (p?.quantity ?? 0) > 0),
    );
    if (lines.length === 0) {
      message.warning(
        "Add at least one product line with product, variant, location, and quantity.",
      );
      return;
    }
    setQuoting(true);
    try {
      const res = await quoteStorefront({
        products: lines.map((p) => ({
          productId: p.productId,
          variantId: p.variantId!,
          locationId: p.locationId!,
          quantity: p.quantity,
        })),
      });
      if (!res.status || !res.data) {
        message.error(res.message ?? "Quote failed");
        return;
      }
      setLastQuoteTotal(res.data.totalInNaira);
      form.setFieldsValue({
        amountPaid: res.data.totalInNaira,
        currency: "NGN",
      });
      message.success(
        `Quote total ${formatCurrency(res.data.totalInNaira, "NGN")} applied to amount paid.`,
      );
    } finally {
      setQuoting(false);
    }
  }

  async function handleShippingQuote() {
    const values = form.getFieldsValue();
    if (
      !values.shippingOriginRegion ||
      !values.shippingDestinationRegion ||
      !values.shippingPaymentMode ||
      !values.shippingWeightKg ||
      values.shippingWeightKg <= 0
    ) {
      message.warning("Select origin, destination, payment mode, and weight first.");
      return;
    }
    setShippingQuoting(true);
    try {
      const body: StorefrontShippingQuoteRequest = {
        originRegion: values.shippingOriginRegion,
        destinationRegion: values.shippingDestinationRegion,
        paymentMode: values.shippingPaymentMode,
        weightKg: values.shippingWeightKg,
      };
      const res = await getStorefrontShippingQuote(body);
      if (!res.status || !res.data) {
        message.error(res.message ?? "Shipping quote failed");
        return;
      }
      setLastShippingQuote({
        totalFee: res.data.totalFee,
        currency: res.data.currency ?? "NGN",
      });
      form.setFieldsValue({ shippingFee: res.data.totalFee });
      message.success(
        `Shipping quote ${formatCurrency(res.data.totalFee, (res.data.currency as "NGN" | "USD") ?? "NGN")} applied to shipping fee.`,
      );
    } finally {
      setShippingQuoting(false);
    }
  }

  async function handleOk() {
    try {
      const values = await form.validateFields();
      const products: StorefrontProductQuantity[] | undefined = (values.products ?? [])
        .filter((p) => p?.productId && p.quantity > 0)
        .map((p) => ({
          productId: p.productId,
          variantId: p.variantId || undefined,
          locationId: p.locationId || undefined,
          quantity: p.quantity,
        }));

      const body: StorefrontPaidOrderRequest = {
        ...values,
        products: products?.length ? products : null,
      };

      const fn =
        mode === "settlement"
          ? createStorefrontSettlementOrder
          : createStorefrontOrder;
      const res = await fn(body);
      if (!res.status) {
        message.error(res.message ?? "Failed to record order");
        return;
      }
      message.success(
        mode === "settlement"
          ? "Settlement order recorded"
          : "Storefront order recorded",
      );
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // validation
    }
  }

  return (
    <Modal
      open={open}
      title={mode === "settlement" ? "Record settlement order" : "Record storefront order"}
      onCancel={() => onOpenChange(false)}
      onOk={handleOk}
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item name="storefrontOwnerId" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          name="externalOrderId"
          label="External order ID"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="paymentReference"
          label="Payment reference"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
          <Form.Item name="amountPaid" label="Amount paid">
            <InputNumber className="!w-full" min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="fees" label="Fees">
            <InputNumber className="!w-full" min={0} precision={2} />
          </Form.Item>
        </div>
        {lastQuoteTotal != null ? (
          <Typography.Text type="secondary" className="mb-3 block text-xs">
            Last quote: {formatCurrency(lastQuoteTotal, "NGN")}
          </Typography.Text>
        ) : null}
        <Form.Item
          name="currency"
          label="Currency"
          rules={[{ required: true, len: 3 }]}
        >
          <Input maxLength={3} />
        </Form.Item>
        <Form.Item
          name="deliveryMethodId"
          label="Delivery method"
          rules={[{ required: true, message: "Select a delivery method" }]}
        >
          <Select
            placeholder="Select delivery method"
            options={(deliveryMethods ?? []).map((m) => ({
              value: m.id,
              label: m.method ?? m.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="locationId" label="Order location (optional)">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Warehouse / location"
            options={(locations ?? []).map((l) => ({
              value: l.id,
              label: l.name ?? l.id,
            }))}
          />
        </Form.Item>

        <div className="mb-2 flex items-center justify-between gap-2">
          <Typography.Text strong>Shipping</Typography.Text>
          <Button
            size="small"
            icon={<CalculatorOutlined />}
            loading={shippingQuoting}
            onClick={handleShippingQuote}
          >
            Quote shipping
          </Button>
        </div>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
          <Form.Item name="shippingOriginRegion" label="Origin region">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Origin region"
              options={(shippingOptions?.originRegions ?? []).map((r) => ({
                value: r,
                label: r,
              }))}
            />
          </Form.Item>
          <Form.Item name="shippingDestinationRegion" label="Destination region">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Destination region"
              options={(shippingOptions?.destinationRegions ?? []).map((r) => ({
                value: r,
                label: r,
              }))}
            />
          </Form.Item>
          <Form.Item name="shippingPaymentMode" label="Payment mode">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Payment mode"
              options={(shippingOptions?.paymentModes ?? []).map((m) => ({
                value: m,
                label: m,
              }))}
            />
          </Form.Item>
          <Form.Item name="shippingWeightKg" label="Weight (kg)">
            <InputNumber className="!w-full" min={0.01} max={2000000} step={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="shippingFee" label="Shipping fee">
            <InputNumber className="!w-full" min={0} precision={2} />
          </Form.Item>
        </div>
        {lastShippingQuote != null ? (
          <Typography.Text type="secondary" className="mb-3 block text-xs">
            Last shipping quote:{" "}
            {formatCurrency(
              lastShippingQuote.totalFee,
              lastShippingQuote.currency as "USD" | "NGN",
            )}
          </Typography.Text>
        ) : null}

        <div className="mb-2 flex items-center justify-between gap-2">
          <Typography.Text strong>Products (optional)</Typography.Text>
          <Button
            size="small"
            icon={<CalculatorOutlined />}
            loading={quoting}
            onClick={handleQuote}
          >
            Quote (Storefront/Quote)
          </Button>
        </div>
        <Form.List name="products">
          {(fields, { add, remove }) => (
            <div className="mb-4 space-y-3">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className="grid gap-2 rounded border border-border p-3 sm:grid-cols-12"
                >
                  <Form.Item
                    className="!mb-0 sm:col-span-4"
                    name={[field.name, "productId"]}
                    rules={[{ required: true, message: "Product ID" }]}
                    label="Product ID"
                  >
                    <Input placeholder="product UUID" />
                  </Form.Item>
                  <Form.Item
                    className="!mb-0 sm:col-span-3"
                    name={[field.name, "variantId"]}
                    label="Variant ID"
                    rules={[{ required: true, message: "Required for quote" }]}
                  >
                    <Input placeholder="variant UUID" />
                  </Form.Item>
                  <Form.Item
                    className="!mb-0 sm:col-span-3"
                    name={[field.name, "locationId"]}
                    label="Location"
                    rules={[{ required: true, message: "Required for quote" }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Location"
                      options={(locations ?? []).map((l) => ({
                        value: l.id,
                        label: l.name ?? l.id,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    className="!mb-0 sm:col-span-1"
                    name={[field.name, "quantity"]}
                    label="Qty"
                    rules={[{ required: true }]}
                    initialValue={1}
                  >
                    <InputNumber className="!w-full" min={1} />
                  </Form.Item>
                  <div className="flex items-end sm:col-span-1">
                    <Button type="link" danger onClick={() => remove(field.name)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>
                Add product line
              </Button>
            </div>
          )}
        </Form.List>

        <Form.Item name="name" label="Customer name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="phoneNumber"
          label="Phone"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email">
          <Input type="email" />
        </Form.Item>
        <Form.Item name="deliveryAddress" label="Delivery address">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Space className="text-xs text-muted-foreground">
          Product quote uses <code>Storefront/Quote</code>; shipping quote uses{" "}
          <code>Storefront/GetShippingQuote</code>.
        </Space>
      </Form>
    </Modal>
  );
}
