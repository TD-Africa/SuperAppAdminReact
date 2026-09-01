import { useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  Modal,
  Segmented,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import type { ProvisionVaResultItem } from "@/lib/types";
import { provisionHint } from "@/lib/virtualAccount";

/** A provisioning result joined back to the customer row it came from. */
export interface ProvisionOutcome extends ProvisionVaResultItem {
  label: string;
}

interface Props {
  results: ProvisionOutcome[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View = "failed" | "all";

/**
 * Per-customer report for a bulk virtual account sweep. Failures carry the
 * service's own message plus the fix, since every one of them is resolved by
 * editing the customer rather than by retrying.
 */
export function ProvisionResultsModal({ results, open, onOpenChange }: Props) {
  const { message } = AntdApp.useApp();
  const [view, setView] = useState<View>("failed");

  const failed = useMemo(
    () => (results ?? []).filter((r) => !r.success),
    [results],
  );

  // A clean run has nothing to review, so don't open on an empty list.
  useEffect(() => {
    if (open) setView(failed.length > 0 ? "failed" : "all");
  }, [open, failed.length]);

  const rows = view === "failed" ? failed : (results ?? []);
  const total = results?.length ?? 0;
  const ok = total - failed.length;

  async function copyFailedEmails() {
    const emails = failed
      .map((r) => r.email)
      .filter((e): e is string => !!e)
      .join(", ");
    if (!emails) {
      message.info("No email addresses to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails);
      message.success(`Copied ${failed.length} email address(es).`);
    } catch {
      message.error("Could not access the clipboard.");
    }
  }

  const columns: TableColumnsType<ProvisionOutcome> = [
    {
      title: "Customer",
      dataIndex: "label",
      render: (v: string, r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{v}</div>
          <div className="truncate text-xs text-muted-foreground">
            {r.email ?? "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Result",
      dataIndex: "success",
      width: 110,
      render: (v: boolean) => (
        <Tag color={v ? "success" : "error"}>{v ? "Provisioned" : "Failed"}</Tag>
      ),
    },
    {
      title: "Details",
      dataIndex: "message",
      render: (v: string, r) => {
        const hint = r.success ? null : provisionHint(v);
        return (
          <div className="space-y-0.5">
            <div className="break-words text-xs">{v}</div>
            {hint && (
              <div className="break-words text-xs font-medium">{hint}</div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title="Virtual account provisioning results"
      width={840}
      footer={
        <Button type="primary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
      destroyOnClose
    >
      <div className="space-y-3">
        <Typography.Text type="secondary">
          {ok} of {total} provisioned
          {failed.length > 0 &&
            ` — ${failed.length} need a fix on the customer record.`}
        </Typography.Text>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: "failed", label: `Failed (${failed.length})` },
              { value: "all", label: `All (${total})` },
            ]}
          />
          {failed.length > 0 && (
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={copyFailedEmails}
            >
              Copy failed emails
            </Button>
          )}
        </div>

        <Table<ProvisionOutcome>
          rowKey="userId"
          size="small"
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{
            emptyText:
              view === "failed"
                ? "Every selected customer was provisioned."
                : "No results.",
          }}
        />
      </div>
    </Modal>
  );
}
