import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Divider,
  InputNumber,
  Skeleton,
  Space,
  Typography,
} from "antd";
import { apiGet, apiPost } from "@/lib/api";
import type { PlatformSettingDto } from "@/lib/types";

// Local form state mirrors the DTO one-for-one, so adding a backend setting means
// adding the field to PlatformSettingDto plus a row in the card below.
type FormState = PlatformSettingDto;

const EMPTY: FormState = { splitTenderPercent: null };

function fromDto(dto: PlatformSettingDto | null): FormState {
  return { splitTenderPercent: dto?.splitTenderPercent ?? null };
}

export default function TransactionSettingsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [state, setState] = useState<FormState>(EMPTY);
  const [initial, setInitial] = useState<FormState>(EMPTY);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["transaction-settings"],
    queryFn: async () => {
      const res = await apiGet<PlatformSettingDto>(
        "Component/GetPlatformSettings",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load settings");
      return res.data;
    },
  });

  useEffect(() => {
    if (data !== undefined) {
      const fresh = fromDto(data);
      setState(fresh);
      setInitial(fresh);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost<boolean>(
        "Component/SavePlatformSettings",
        state,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to save settings");
      return res;
    },
    onSuccess: (res) => {
      message.success(res.message ?? "Settings saved");
      setInitial(state);
      queryClient.invalidateQueries({ queryKey: ["transaction-settings"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const dirty = state.splitTenderPercent !== initial.splitTenderPercent;

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Transaction Settings
        </Typography.Title>
        <Typography.Text type="secondary">
          Platform-wide transaction rules that apply to every customer and order.
        </Typography.Text>
      </div>

      <Card>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : isError ? (
          <Alert
            type="error"
            showIcon
            message="Could not load settings"
            description={(error as Error).message}
            action={
              <Button size="small" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-xl">
                <Typography.Text strong>Split tender percent</Typography.Text>
                <Typography.Paragraph type="secondary" className="!mb-0 !mt-1">
                  The share of an order total a customer may pay up front when
                  splitting payment.
                </Typography.Paragraph>
              </div>
              <InputNumber
                className="w-full md:w-40"
                min={0}
                max={100}
                step={1}
                precision={2}
                suffix="%"
                placeholder="Not set"
                value={state.splitTenderPercent}
                onChange={(v) => update("splitTenderPercent", v ?? null)}
              />
            </div>

            <Divider className="!my-0" />

            <Space>
              <Button
                type="primary"
                loading={mutation.isPending}
                disabled={!dirty || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Save changes
              </Button>
              <Button
                disabled={!dirty || mutation.isPending}
                onClick={() => setState(initial)}
              >
                Discard
              </Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
