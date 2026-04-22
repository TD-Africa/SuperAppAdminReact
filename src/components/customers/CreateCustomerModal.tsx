import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  Switch,
  Skeleton,
  App as AntdApp,
  Row,
  Col,
} from "antd";
import { apiGet, apiPost } from "@/lib/api";
import type { CreateCustomerRequest, LocationReturnDTO } from "@/lib/types";
import { MultiSelect } from "@/components/MultiSelect";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type FormValues = CreateCustomerRequest;

export function CreateCustomerModal({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();

  const { data: warehouses, isLoading: loadingWarehouses } = useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load warehouses");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        isCreditTransactionEnabled: false,
        locationIds: [],
      });
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiPost<boolean>("User/CreateUser", values);
      if (!res.status) throw new Error(res.message ?? "Failed to create customer");
      return res;
    },
    onSuccess: (res) => {
      message.success(res.message ?? "Customer created");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  const warehouseOptions =
    warehouses?.map((w) => ({
      id: w.id,
      label: w.name,
      sublabel: w.dynamicsId ?? undefined,
    })) ?? [];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="New customer account"
      width={820}
      confirmLoading={mutation.isPending}
      okText="Create account"
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="firstName"
              label="First name"
              rules={[{ required: true, message: "First name is required" }]}
            >
              <Input placeholder="John" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="lastName"
              label="Last name"
              rules={[{ required: true, message: "Last name is required" }]}
            >
              <Input placeholder="Doe" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: "Username is required" }]}
        >
          <Input placeholder="johndoe" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input placeholder="john@example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="phoneNumber"
              label="Phone number"
              rules={[{ required: true, message: "Phone is required" }]}
            >
              <Input placeholder="+2349000008001" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="companyName"
          label="Company name"
          rules={[{ required: true, message: "Company name is required" }]}
        >
          <Input placeholder="John Doe Limited" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="addressLine"
              label="House number"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="34B" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="isCreditTransactionEnabled"
              label="Credit transactions"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="street"
          label="Invoice address street"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="Brown Drive" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="city"
              label="Invoice city"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="Lagos" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="state"
              label="Invoice state"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="Lagos State" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="dynamicsId"
          label="Dynamics ID"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="CUS-00011" />
        </Form.Item>
        <Form.Item
          name="locationIds"
          label="Warehouses"
          rules={[
            {
              validator: (_, value: string[] | undefined) =>
                (value?.length ?? 0) > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error("Select at least one warehouse")),
            },
          ]}
        >
          {loadingWarehouses ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <MultiSelect
              options={warehouseOptions}
              value={form.getFieldValue("locationIds") ?? []}
              onChange={(v) =>
                form.setFieldValue("locationIds", v)
              }
              placeholder="Assign warehouses"
            />
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}
