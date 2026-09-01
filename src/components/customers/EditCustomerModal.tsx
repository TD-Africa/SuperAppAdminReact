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
  Button,
  Space,
} from "antd";
import { ApiOutlined } from "@ant-design/icons";
import { apiGet, apiPatch } from "@/lib/api";
import type {
  CustomerResponse,
  EditCustomerRequest,
  LocationReturnDTO,
} from "@/lib/types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { MultiSelect } from "@/components/MultiSelect";
import { DynamicsLinkModal } from "@/components/customers/DynamicsLinkModal";
import { VirtualAccountPanel } from "@/components/customers/VirtualAccountPanel";
import {
  CustomerIdentity,
  SectionLabel,
  StatRow,
  statusColor,
} from "@/components/customers/customerUi";
import { Permission } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";

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

export function EditCustomerModal({
  customerId,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  // Matches the HasPermission attribute on VirtualAccountController.provision.
  const canProvisionVa = useAuthStore((s) =>
    s.hasPermission(Permission.CanEditOrders),
  );
  const [state, setState] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [dynamicsOpen, setDynamicsOpen] = useState(false);

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

  // Saves the pending diff without closing the modal, so virtual account
  // provisioning can flush the admin's fixes before it re-reads the database.
  async function persist(): Promise<string | null> {
    if (!customer || !state || !initial) throw new Error("Not ready");
    const payload = diffPayload(state, initial);
    if (Object.keys(payload).length === 0) return null;
    const res = await apiPatch<boolean>(
      `User/EditCustomerAccount/${customer.id}`,
      payload,
    );
    if (!res.status) throw new Error(res.message ?? "Update failed");
    setInitial(state);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    onUpdated?.();
    return res.message ?? null;
  }

  const mutation = useMutation({
    mutationFn: persist,
    onSuccess: (msg) => {
      message.success(msg ?? "Customer updated");
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

  // Track the form rather than the saved record, so the rail reflects a company
  // name as it is being typed.
  const heading =
    (state
      ? state.companyName ||
        [state.firstName, state.lastName].filter(Boolean).join(" ") ||
        state.email
      : customer?.companyName) || "Customer";

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={null}
      width={980}
      styles={{ body: { paddingTop: 8 } }}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {dirty && (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </>
            )}
          </span>
          <Space>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={mutation.isPending}
              disabled={!dirty || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Save changes
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      {loadingCustomer || !customer || !state ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Summary rail — identity, figures and the integrations that act on
              the record as a whole rather than on a single field. */}
          <aside className="space-y-5 lg:border-r lg:border-border lg:pr-6">
            <div className="space-y-3">
              <CustomerIdentity
                name={heading}
                size="sm"
                subtitle={
                  customer.userName ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {customer.userName}
                    </div>
                  ) : undefined
                }
              />
              <div className="flex flex-wrap gap-1.5">
                <Tag color={statusColor[customer.userStatus] ?? "default"}>
                  {customer.userStatus}
                </Tag>
                {customer.userType && <Tag>{customer.userType}</Tag>}
                {customer.isSuspended && <Tag color="error">Suspended</Tag>}
                {customer.isExistingPartner && <Tag>Existing partner</Tag>}
              </div>
            </div>

            <div>
              <SectionLabel>At a glance</SectionLabel>
              <div className="divide-y divide-border rounded-lg border border-border bg-muted/40">
                <StatRow
                  label="Wallet"
                  value={formatCurrency(customer.walletBalance ?? 0, "NGN")}
                />
                <StatRow
                  label="Credit"
                  value={formatCurrency(customer.creditBalance ?? 0, "NGN")}
                />
                <StatRow
                  label="Orders"
                  value={formatNumber(
                    customer.numberOfOrders ?? customer.totalOrders ?? 0,
                  )}
                />
                <StatRow
                  label="Joined"
                  value={
                    customer.dateCreated ? formatDate(customer.dateCreated) : "—"
                  }
                />
              </div>
            </div>

            <div>
              <SectionLabel>Dynamics</SectionLabel>
              <div className="space-y-2">
                {customer.dynamicsId ? (
                  <div className="truncate rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm tabular-nums">
                    {customer.dynamicsId}
                  </div>
                ) : (
                  <Tag color="warning">Not linked</Tag>
                )}
                <Button
                  block
                  icon={<ApiOutlined />}
                  type={customer.dynamicsId ? "default" : "primary"}
                  onClick={() => setDynamicsOpen(true)}
                >
                  {customer.dynamicsId ? "Manage link" : "Link to Dynamics"}
                </Button>
              </div>
            </div>

            {canProvisionVa && (
              <div>
                <SectionLabel>Virtual account</SectionLabel>
                <VirtualAccountPanel
                  customerId={customer.id}
                  draft={{
                    email: state.email,
                    phoneNumber: state.phoneNumber,
                    firstName: state.firstName,
                    companyName: state.companyName,
                  }}
                  dirty={dirty}
                  onSaveChanges={async () => {
                    await persist();
                  }}
                />
              </div>
            )}
          </aside>

          {/* Editable fields. Form.Item margins are dropped in favour of the
              grid's own gaps so the two columns line up. */}
          <Form layout="vertical" requiredMark={false} className="space-y-6">
            <section>
              <SectionLabel>Identity</SectionLabel>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                <Form.Item className="!mb-0" label="First name">
                  <Input
                    value={state.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                </Form.Item>
                <Form.Item className="!mb-0" label="Last name">
                  <Input
                    value={state.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                </Form.Item>
                <Form.Item className="!mb-0 sm:col-span-2" label="Company name">
                  <Input
                    value={state.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                  />
                </Form.Item>
              </div>
            </section>

            <section>
              <SectionLabel>Contact</SectionLabel>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                <Form.Item className="!mb-0" label="Email">
                  <Input
                    type="email"
                    value={state.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Form.Item>
                <Form.Item className="!mb-0" label="Phone number">
                  <Input
                    value={state.phoneNumber}
                    onChange={(e) => update("phoneNumber", e.target.value)}
                  />
                </Form.Item>
              </div>
            </section>

            <section>
              <SectionLabel>Invoice address</SectionLabel>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                <Form.Item className="!mb-0" label="House number">
                  <Input
                    value={state.houseNumber}
                    onChange={(e) => update("houseNumber", e.target.value)}
                  />
                </Form.Item>
                <Form.Item className="!mb-0" label="Street">
                  <Input
                    value={state.street}
                    onChange={(e) => update("street", e.target.value)}
                  />
                </Form.Item>
                <Form.Item className="!mb-0" label="City">
                  <Input
                    value={state.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </Form.Item>
                <Form.Item className="!mb-0" label="State">
                  <Input
                    value={state.state}
                    onChange={(e) => update("state", e.target.value)}
                  />
                </Form.Item>
              </div>
            </section>

            <section>
              <SectionLabel>Access &amp; credit</SectionLabel>
              <div className="space-y-4">
                <Form.Item className="!mb-0" label="Warehouses">
                  {loadingWarehouses ? (
                    <Skeleton active paragraph={{ rows: 2 }} title={false} />
                  ) : (
                    <MultiSelect
                      options={warehouseOptions}
                      value={state.locationIds}
                      onChange={(v) => update("locationIds", v)}
                      placeholder="Assign warehouses"
                    />
                  )}
                </Form.Item>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      Credit transactions
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Lets this customer place orders against their credit limit.
                    </div>
                  </div>
                  <Switch
                    checked={state.enableCreditTransactions}
                    onChange={(v) => update("enableCreditTransactions", v)}
                  />
                </div>
              </div>
            </section>
          </Form>
        </div>
      )}

      {customer && (
        <DynamicsLinkModal
          customer={customer}
          open={dynamicsOpen}
          onOpenChange={setDynamicsOpen}
          onLinked={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
            onUpdated?.();
          }}
        />
      )}
    </Modal>
  );
}
