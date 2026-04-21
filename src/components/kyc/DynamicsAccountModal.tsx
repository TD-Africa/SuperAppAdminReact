import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { http } from "@/lib/api";
import type { CustomerResponse } from "@/lib/types";

const schema = z.object({
  dataAreaId: z.string().min(1, "Required"),
  customerGroupId: z.string().min(1, "Required"),
  partyType: z.string().min(1, "Required"),
  organizationName: z.string().min(1, "Required"),
  salesCurrencyCode: z.string().min(1, "Required"),
  primaryContactEmail: z.string().email("Valid email required"),
  primaryContactPhone: z.string().min(1, "Required"),
  invoiceAddressStreet: z.string().min(1, "Required"),
  invoiceAddressCity: z.string().min(1, "Required"),
  invoiceAddressState: z.string().min(1, "Required"),
  invoiceAddressCountry: z.string().min(1, "Required"),
  invoiceAddressDescription: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
}

function defaultsFor(customer: CustomerResponse | null): FormValues {
  return {
    dataAreaId: "TDL",
    customerGroupId: "GBA",
    partyType: "Organization",
    organizationName: customer?.companyName ?? "",
    salesCurrencyCode: "USD",
    primaryContactEmail: customer?.email ?? "",
    primaryContactPhone: customer?.phoneNumber ?? "",
    invoiceAddressStreet: customer?.street ?? "",
    invoiceAddressCity: customer?.city ?? "",
    invoiceAddressState: customer?.state ?? "",
    invoiceAddressCountry: "NG",
    invoiceAddressDescription: "TEST",
  };
}

export function DynamicsAccountModal({
  customer,
  open,
  onOpenChange,
  onApproved,
}: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(customer),
  });

  useEffect(() => {
    if (open) reset(defaultsFor(customer));
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!customer) throw new Error("No customer selected");
      // Hand-build the body so the Pascal-cased JSON wire names from the Blazor
      // UserCreationDTO [JsonPropertyName] attributes are preserved exactly.
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
    onSuccess: (message) => {
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["kyc-customers"] });
      onApproved?.();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create account on Dynamics</DialogTitle>
          <DialogDescription>
            Finalize approval by provisioning {customer?.companyName ?? "this customer"}
            {" "}in Dynamics.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormField label="Data area ID" error={errors.dataAreaId?.message}>
              <Input {...register("dataAreaId")} />
            </FormField>
            <FormField label="Customer group ID" error={errors.customerGroupId?.message}>
              <Input {...register("customerGroupId")} />
            </FormField>
            <FormField label="Sales currency" error={errors.salesCurrencyCode?.message}>
              <Input {...register("salesCurrencyCode")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Party type" error={errors.partyType?.message}>
              <Input {...register("partyType")} />
            </FormField>
            <FormField label="Organization name" error={errors.organizationName?.message}>
              <Input {...register("organizationName")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Primary contact email" error={errors.primaryContactEmail?.message}>
              <Input type="email" {...register("primaryContactEmail")} />
            </FormField>
            <FormField label="Primary contact phone" error={errors.primaryContactPhone?.message}>
              <Input {...register("primaryContactPhone")} />
            </FormField>
          </div>

          <FormField label="Invoice address street" error={errors.invoiceAddressStreet?.message}>
            <Input {...register("invoiceAddressStreet")} />
          </FormField>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormField label="Invoice city" error={errors.invoiceAddressCity?.message}>
              <Input {...register("invoiceAddressCity")} />
            </FormField>
            <FormField label="Invoice state" error={errors.invoiceAddressState?.message}>
              <Input {...register("invoiceAddressState")} />
            </FormField>
            <FormField label="Invoice country" error={errors.invoiceAddressCountry?.message}>
              <Input {...register("invoiceAddressCountry")} />
            </FormField>
          </div>

          <FormField label="Invoice address description" error={errors.invoiceAddressDescription?.message}>
            <Input {...register("invoiceAddressDescription")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
