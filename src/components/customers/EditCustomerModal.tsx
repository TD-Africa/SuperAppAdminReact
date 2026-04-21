import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MultiSelect, type MultiSelectOption } from "@/components/MultiSelect";
import { apiGet, apiPatch } from "@/lib/api";
import type {
  CustomerResponse,
  EditCustomerRequest,
  LocationReturnDTO,
} from "@/lib/types";

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

function initialFromCustomer(c: CustomerResponse): FormState {
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

function diffPayload(
  state: FormState,
  initial: FormState,
): EditCustomerRequest {
  const payload: EditCustomerRequest = {};
  (["firstName", "lastName", "email", "phoneNumber", "companyName", "houseNumber", "street", "city", "state"] as const).forEach(
    (field) => {
      if (state[field] !== initial[field]) {
        (payload as Record<string, unknown>)[field] = state[field];
      }
    },
  );
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
      const fresh = initialFromCustomer(customer);
      setState(fresh);
      setInitial(fresh);
    } else if (!open) {
      setState(null);
      setInitial(null);
    }
  }, [customer, open]);

  const warehouseOptions: MultiSelectOption[] = useMemo(
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
      toast.success(res.message ?? "Customer updated");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onUpdated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dirty = !!state && !!initial &&
    Object.keys(diffPayload(state, initial)).length > 0;

  const statusVariant: Record<
    string,
    "success" | "warning" | "destructive" | "secondary"
  > = {
    Active: "success",
    Pending: "warning",
    Suspended: "destructive",
    Rejected: "destructive",
    Incomplete: "secondary",
  };

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer?.companyName ?? "Customer"}</DialogTitle>
          <DialogDescription>
            {customer?.email ?? (customerId ? `#${customerId.slice(0, 8)}` : "Loading…")}
          </DialogDescription>
        </DialogHeader>

        {loadingCustomer || !customer || !state ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant[customer.userStatus] ?? "default"}>
                {customer.userStatus}
              </Badge>
              {customer.isSuspended && (
                <Badge variant="destructive">Suspended</Badge>
              )}
              {customer.isExistingPartner && (
                <Badge variant="outline">Existing partner</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="First name">
                <Input
                  value={state.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  placeholder="John"
                />
              </Field>
              <Field label="Last name">
                <Input
                  value={state.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  placeholder="Doe"
                />
              </Field>
            </div>
            <Field label="Username (read-only)">
              <Input value={customer.userName ?? ""} disabled />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={state.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </Field>
              <Field label="Phone number">
                <Input
                  value={state.phoneNumber}
                  onChange={(e) => update("phoneNumber", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Company name">
              <Input
                value={state.companyName}
                onChange={(e) => update("companyName", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="House number">
                <Input
                  value={state.houseNumber}
                  onChange={(e) => update("houseNumber", e.target.value)}
                />
              </Field>
              <div>
                <Label>Credit transactions</Label>
                <div className="mt-2 flex h-10 items-center gap-2 rounded-md border px-3">
                  <Switch
                    checked={state.enableCreditTransactions}
                    onCheckedChange={(v) =>
                      update("enableCreditTransactions", v)
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {state.enableCreditTransactions ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
            <Field label="Invoice address street">
              <Input
                value={state.street}
                onChange={(e) => update("street", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Invoice city">
                <Input
                  value={state.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </Field>
              <Field label="Invoice state">
                <Input
                  value={state.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Dynamics ID (read-only)">
              <Input value={customer.dynamicsId ?? ""} disabled />
            </Field>

            <Separator />
            <div>
              <Label>Warehouses</Label>
              {loadingWarehouses ? (
                <Skeleton className="mt-2 h-40 w-full" />
              ) : (
                <MultiSelect
                  className="mt-2"
                  options={warehouseOptions}
                  value={state.locationIds}
                  onChange={(v) => update("locationIds", v)}
                  placeholder="Assign warehouses"
                  searchPlaceholder="Search warehouses…"
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!dirty || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
