import { Alert, Button } from "antd";
import { analyticsError } from "@/lib/analytics";

/** Error banner for a failed analytics request, with an optional Retry button. */
export function AnalyticsError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Alert
      type="error"
      showIcon
      title={analyticsError(error)}
      action={retry && <Button onClick={retry}>Retry</Button>}
    />
  );
}
