import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Tooltip } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { apiPost } from "@/lib/api";
import type { ProvisionVaResultItem } from "@/lib/types";
import {
  PROVISION_VA_URL,
  provisionHint,
  vaBlockers,
  type VaFields,
} from "@/lib/virtualAccount";

/** The customer fields Paystack needs before it will assign a dedicated account. */
export type VaDraft = Required<{ [K in keyof VaFields]: string }>;

interface Props {
  customerId: string;
  /** Current form values — including unsaved edits — for the pre-flight check. */
  draft: VaDraft;
  /** True when the edit form has changes that have not been saved yet. */
  dirty: boolean;
  /** Persists pending edits; must reject if the save fails. */
  onSaveChanges: () => Promise<void>;
}

/**
 * Runs the single-customer virtual account provisioning and surfaces the exact
 * reason wallet creation is failing, so the admin can fix the offending field
 * in the same modal and retry.
 */
export function VirtualAccountPanel({
  customerId,
  draft,
  dirty,
  onSaveChanges,
}: Props) {
  const [result, setResult] = useState<ProvisionVaResultItem | null>(null);

  // A different customer's outcome must never be shown against this one.
  useEffect(() => setResult(null), [customerId]);

  const blockers = useMemo(() => vaBlockers(draft), [draft]);

  const provision = useMutation({
    mutationFn: async () => {
      // The endpoint reads the database, not the form, so unsaved edits have to
      // land first or the retry re-reports the same error.
      if (dirty) {
        try {
          await onSaveChanges();
        } catch (err) {
          throw new Error(
            `Could not save your changes: ${(err as Error).message}`,
          );
        }
      }

      // Always send an explicit id: an empty list makes the endpoint sweep
      // every user in the system that is missing a virtual account.
      const res = await apiPost<ProvisionVaResultItem[]>(PROVISION_VA_URL, {
        userIds: [customerId],
      });
      if (!res.status)
        throw new Error(res.message ?? "Provisioning request failed");

      // The envelope is 200/true even when provisioning failed — the real
      // outcome is on the per-user item.
      const item = res.data?.[0];
      if (!item) throw new Error("No provisioning result returned for this customer");
      return item;
    },
    onSuccess: setResult,
    onError: (err: Error) =>
      setResult({
        userId: customerId,
        email: null,
        success: false,
        message: err.message,
      }),
  });

  const hint = result && !result.success ? provisionHint(result.message) : null;

  return (
    <div className="space-y-2">
      <p className="!mb-0 text-xs text-muted-foreground">
        Creates the customer's dedicated Paystack account if they have none.
        Safe to re-run.
      </p>

      {blockers.length > 0 && !provision.isPending && (
        <Alert
          type="warning"
          showIcon
          message={
            <span className="text-xs font-medium">
              Paystack needs {blockers.join(", ").toLowerCase()}
            </span>
          }
          description={
            <span className="text-xs">
              Fill in the field(s), then use Save &amp; provision.
            </span>
          }
        />
      )}

      {result && (
        <Alert
          type={result.success ? "success" : "error"}
          showIcon
          closable
          onClose={() => setResult(null)}
          message={
            <span className="text-xs font-medium">
              {result.success ? "Account is in place" : "Could not create"}
            </span>
          }
          description={
            <div className="space-y-1">
              <div className="break-words text-xs">{result.message}</div>
              {hint && (
                <div className="break-words text-xs font-medium">{hint}</div>
              )}
            </div>
          }
        />
      )}

      <Tooltip
        title={dirty ? "Saves your changes first, then provisions" : undefined}
      >
        <Button
          block
          icon={<BankOutlined />}
          loading={provision.isPending}
          onClick={() => provision.mutate()}
        >
          {dirty ? "Save & provision" : "Provision account"}
        </Button>
      </Tooltip>
    </div>
  );
}
