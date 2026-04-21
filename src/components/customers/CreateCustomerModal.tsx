import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect, type MultiSelectOption } from "@/components/MultiSelect";
import { apiGet, apiPost } from "@/lib/api";
import type { CreateCustomerRequest, LocationReturnDTO } from "@/lib/types";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Enter a valid email"),
  companyName: z.string().min(1, "Company name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  addressLine: z.string().min(1, "House number is required"),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  dynamicsId: z.string().min(1, "Dynamics ID is required"),
  isCreditTransactionEnabled: z.boolean(),
  locationIds: z.array(z.string()).min(1, "Select at least one warehouse"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateCustomerModal({ open, onOpenChange, onCreated }: Props) {
  const queryClient = useQueryClient();

  const { data: warehouses, isLoading: loadingWarehouses } = useQuery({
    queryKey: ["locations-all"],
    queryFn: async () => {
      const res = await apiGet<LocationReturnDTO[]>("Location/GetLocations");
      if (!res.status) throw new Error(res.message ?? "Failed to load warehouses");
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      companyName: "",
      phoneNumber: "",
      addressLine: "",
      street: "",
      city: "",
      state: "",
      dynamicsId: "",
      isCreditTransactionEnabled: false,
      locationIds: [],
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const selectedWarehouses = watch("locationIds");
  const creditToggle = watch("isCreditTransactionEnabled");

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CreateCustomerRequest = values;
      const res = await apiPost<boolean>("User/CreateUser", payload);
      if (!res.status) throw new Error(res.message ?? "Failed to create customer");
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message ?? "Customer created");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const warehouseOptions: MultiSelectOption[] =
    warehouses?.map((w) => ({
      id: w.id,
      label: w.name,
      sublabel: w.dynamicsId ?? undefined,
    })) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New customer account</DialogTitle>
          <DialogDescription>
            Create a reseller account and assign warehouses.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="First name" error={errors.firstName?.message}>
              <Input {...register("firstName")} placeholder="John" />
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message}>
              <Input {...register("lastName")} placeholder="Doe" />
            </FormField>
          </div>

          <FormField label="Username" error={errors.username?.message}>
            <Input {...register("username")} placeholder="johndoe" />
          </FormField>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Email" error={errors.email?.message}>
              <Input type="email" {...register("email")} placeholder="john@example.com" />
            </FormField>
            <FormField label="Phone number" error={errors.phoneNumber?.message}>
              <Input {...register("phoneNumber")} placeholder="+2349000008001" />
            </FormField>
          </div>

          <FormField label="Company name" error={errors.companyName?.message}>
            <Input {...register("companyName")} placeholder="John Doe Limited" />
          </FormField>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="House number" error={errors.addressLine?.message}>
              <Input {...register("addressLine")} placeholder="34B" />
            </FormField>
            <div>
              <Label>Credit transactions</Label>
              <div className="mt-2 flex h-10 items-center gap-2 rounded-md border px-3">
                <Switch
                  checked={creditToggle}
                  onCheckedChange={(v) =>
                    setValue("isCreditTransactionEnabled", v, { shouldDirty: true })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {creditToggle ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          <FormField label="Invoice address street" error={errors.street?.message}>
            <Input {...register("street")} placeholder="Brown Drive" />
          </FormField>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Invoice city" error={errors.city?.message}>
              <Input {...register("city")} placeholder="Lagos" />
            </FormField>
            <FormField label="Invoice state" error={errors.state?.message}>
              <Input {...register("state")} placeholder="Lagos State" />
            </FormField>
          </div>

          <FormField label="Dynamics ID" error={errors.dynamicsId?.message}>
            <Input {...register("dynamicsId")} placeholder="CUS-00011" />
          </FormField>

          <div>
            <Label>Warehouses</Label>
            {loadingWarehouses ? (
              <Skeleton className="mt-2 h-40 w-full" />
            ) : (
              <>
                <MultiSelect
                  className="mt-2"
                  options={warehouseOptions}
                  value={selectedWarehouses}
                  onChange={(v) =>
                    setValue("locationIds", v, { shouldValidate: true, shouldDirty: true })
                  }
                  placeholder="Assign warehouses to this customer"
                  searchPlaceholder="Search warehouses…"
                />
                {errors.locationIds && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.locationIds.message}
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
