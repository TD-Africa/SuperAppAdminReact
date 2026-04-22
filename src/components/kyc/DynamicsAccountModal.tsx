import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  App as AntdApp,
  Row,
  Col,
} from "antd";
import { http } from "@/lib/api";
import type { CustomerResponse } from "@/lib/types";

const DEFAULT_VALUES = {
  dataAreaId: "TDL",
  customerGroupId: "GBA",
  partyType: "Organization",
  salesCurrencyCode: "USD",
  invoiceAddressCountry: "NG",
  invoiceAddressDescription: "TEST",
} as const;

interface FormValues {
  dataAreaId: string;
  customerGroupId: string;
  partyType: string;
  organizationName: string;
  salesCurrencyCode: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  invoiceAddressStreet: string;
  invoiceAddressCity: string;
  invoiceAddressState: string;
  invoiceAddressCountry: string;
  invoiceAddressDescription: string;
}

interface Props {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
}

export function DynamicsAccountModal({
  customer,
  open,
  onOpenChange,
  onApproved,
}: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (open && customer) {
      form.resetFields();
      form.setFieldsValue({
        ...DEFAULT_VALUES,
        organizationName: customer.companyName ?? "",
        primaryContactEmail: customer.email ?? "",
        primaryContactPhone: customer.phoneNumber ?? "",
        invoiceAddressStreet: customer.street ?? "",
        invoiceAddressCity: customer.city ?? "",
        invoiceAddressState: customer.state ?? "",
      });
    }
  }, [open, customer, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!customer) throw new Error("No customer selected");
      // Hand-build the body so the Pascal-cased JSON wire names from the Blazor
      // UserCreationDTO [JsonPropertyName] attributes are preserved.
      const body = {
        dataAreaId: values.dataAreaId,
        CustomerGroupId: values.customerGroupId,
        PartyType: values.partyType,
        OrganizationName: values.organizationName,
        SalesCurrencyCode: values.salesCurrencyCode,
        InvoiceAddressState: values.invoiceAddressState,
        PrimaryContactPhone: values.primaryContactPhone,
        PrimaryContactEmail: values.primaryContactEmail,
        InvoiceAddressCity: values.invoiceAddressCity,
        InvoiceAddressDescription: values.invoiceAddressDescription,
        InvoiceAddressStreet: values.invoiceAddressStreet,
        InvoiceAddressCountry: values.invoiceAddressCountry,
      };
      const res = await http.post(`User/ConfirmUserAccount/${customer.id}`, body);
      const payload = res.data as { status?: boolean; message?: string };
      if (payload && payload.status === false) {
        throw new Error(payload.message ?? "Failed to create Dynamics account");
      }
      return payload?.message ?? "Customer approved and account created";
    },
    onSuccess: (msg) => {
      message.success(msg);
      queryClient.invalidateQueries({ queryKey: ["kyc-customers"] });
      onApproved?.();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="Create account on Dynamics"
      width={820}
      confirmLoading={mutation.isPending}
      okText="Create account"
      onOk={() => form.submit()}
      destroyOnClose
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Finalize approval by provisioning {customer?.companyName ?? "this customer"} in
        Dynamics.
      </p>
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="dataAreaId"
              label="Data area ID"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="customerGroupId"
              label="Customer group ID"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="salesCurrencyCode"
              label="Sales currency"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="partyType"
              label="Party type"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="organizationName"
              label="Organization name"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="primaryContactEmail"
              label="Primary contact email"
              rules={[
                { required: true, message: "Required" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="primaryContactPhone"
              label="Primary contact phone"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="invoiceAddressStreet"
          label="Invoice address street"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="invoiceAddressCity"
              label="Invoice city"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="invoiceAddressState"
              label="Invoice state"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="invoiceAddressCountry"
              label="Invoice country"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="invoiceAddressDescription"
          label="Invoice address description"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
