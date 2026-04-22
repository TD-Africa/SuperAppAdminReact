import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  Switch,
  Skeleton,
  App as AntdApp,
  Tag,
  Divider,
  Row,
  Col,
} from "antd";
import { apiGet, apiPatch } from "@/lib/api";
import type {
  CustomerResponse,
  EditCustomerRequest,
  LocationReturnDTO,
} from "@/lib/types";
import { MultiSelect } from "@/components/MultiSelect";

interface Props {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  houseNumber: string;
  street: string;
  city: string;
  state: string;
  enableCreditTransactions: boolean;
  locationIds: string[];
}

function fromCustomer(c: CustomerResponse): FormState {
  return {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    email: c.email ?? "",
    phoneNumber: c.phoneNumber ?? "",
    companyName: c.companyName ?? "",
    houseNumber: c.addressLine ?? "",
    street: c.street ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    enableCreditTransactions: c.isCreditTransactionEnabled,
    locationIds: c.userWarehouses?.map((w) => w.id) ?? [],
  };
}

function diffPayload(state: FormState, initial: FormState): EditCustomerRequest {
  const payload: EditCustomerRequest = {};
  (
    [
      "firstName",
      "lastName",
      "email",
      "phoneNumber",
      "companyName",
      "houseNumber",
      "street",
      "city",
      "state",
    ] as const
  ).forEach((field) => {
    if (state[field] !== initial[field]) {
      (payload as Record<string, unknown>)[field] = state[field];
    }
  });
  if (state.enableCreditTransactions !== initial.enableCreditTransactions) {
    payload.enableCreditTransactions = state.enableCreditTransactions;
  }
  const a = [...state.locationIds].sort();
  const b = [...initial.locationIds].sort();
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
    payload.locationIds = state.locationIds;
  }
  return payload;
}

const statusColor: Record<string, "success" | "warning" | "error" | "default"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "error",
  Rejected: "error",
  Incomplete: "default",
};

export function EditCustomerModal({
  customerId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [state, setState] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const res = await apiGet<CustomerResponse>(`User/GetUser/${customerId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load customer");
      return res.data;
    },
    enabled: !!customerId && open,
  });

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
    if (customer) {
      const fresh = fromCustomer(customer);
      setState(fresh);
      setInitial(fresh);
    } else if (!open) {
      setState(null);
      setInitial(null);
    }
  }, [customer, open]);

  const warehouseOptions = useMemo(
    () =>
      warehouses?.map((w) => ({
        id: w.id,
        label: w.name,
        sublabel: w.dynamicsId ?? undefined,
      })) ?? [],
    [warehouses],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!customer || !state || !initial) throw new Error("Not ready");
      const payload = diffPayload(state, initial);
      const res = await apiPatch<boolean>(
        `User/EditCustomerAccount/${customer.id}`,
        payload,
      );
      if (!res.status) throw new Error(res.message ?? "Update failed");
      return res;
    },
    onSuccess: (res) => {
      message.success(res.message ?? "Customer updated");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onUpdated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => message.error(err.message),
  });

  const dirty =
    !!state &&
    !!initial &&
    Object.keys(diffPayload(state, initial)).length > 0;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={customer?.companyName ?? "Customer"}
      width={820}
      confirmLoading={mutation.isPending}
      okText="Save changes"
      okButtonProps={{ disabled: !dirty || mutation.isPending }}
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      {loadingCustomer || !customer || !state ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Tag color={statusColor[customer.userStatus] ?? "default"}>
              {customer.userStatus}
            </Tag>
            {customer.isSuspended && <Tag color="error">Suspended</Tag>}
            {customer.isExistingPartner && <Tag>Existing partner</Tag>}
          </div>

          <Form layout="vertical" requiredMark={false}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="First name">
                  <Input
                    value={state.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Last name">
                  <Input
                    value={state.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Username (read-only)">
              <Input value={customer.userName ?? ""} disabled />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Email">
                  <Input
                    type="email"
                    value={state.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Phone number">
                  <Input
                    value={state.phoneNumber}
                    onChange={(e) => update("phoneNumber", e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Company name">
              <Input
                value={state.companyName}
                onChange={(e) => update("companyName", e.target.value)}
              />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="House number">
                  <Input
                    value={state.houseNumber}
                    onChange={(e) => update("houseNumber", e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Credit transactions">
                  <Switch
                    checked={state.enableCreditTransactions}
                    onChange={(v) => update("enableCreditTransactions", v)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Invoice address street">
              <Input
                value={state.street}
                onChange={(e) => update("street", e.target.value)}
              />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Invoice city">
                  <Input
                    value={state.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Invoice state">
                  <Input
                    value={state.state}
                    onChange={(e) => update("state", e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Dynamics ID (read-only)">
              <Input value={customer.dynamicsId ?? ""} disabled />
            </Form.Item>

            <Divider />

            <Form.Item label="Warehouses">
              {loadingWarehouses ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <MultiSelect
                  options={warehouseOptions}
                  value={state.locationIds}
                  onChange={(v) => update("locationIds", v)}
                  placeholder="Assign warehouses"
                />
              )}
            </Form.Item>
          </Form>
        </div>
      )}
    </Modal>
  );
}
