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
import {
  getStorefrontCommissionSettings,
  updateStorefrontCommissionSettings,
} from "@/lib/storefrontApi";

const EMPTY: number | null = null;

export default function StorefrontCommissionsPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [value, setValue] = useState<number | null>(EMPTY);
  const [initial, setInitial] = useState<number | null>(EMPTY);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["storefront", "commission-settings"],
    queryFn: async () => {
      const res = await getStorefrontCommissionSettings();
      if (!res.status) {
        throw new Error(res.message ?? "Failed to load commission settings");
      }
      return res.data;
    },
  });

  useEffect(() => {
    if (data !== undefined) {
      const fresh = data?.oemCommissionPercent ?? null;
      setValue(fresh);
      setInitial(fresh);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await updateStorefrontCommissionSettings({
        oemCommissionPercent: value ?? 0,
      });
      if (!res.status) {
        throw new Error(res.message ?? "Failed to save commission settings");
      }
      return res;
    },
    onSuccess: (res) => {
      message.success(res.message ?? "Commission settings saved");
      setInitial(value);
      queryClient.invalidateQueries({
        queryKey: ["storefront", "commission-settings"],
      });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const dirty = value !== initial;

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Storefront Commissions
        </Typography.Title>
        <Typography.Text type="secondary">
          Configure the Global store front commission percentage applied to storefront orders.
        </Typography.Text>
      </div>

      <Card>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : isError ? (
          <Alert
            type="error"
            showIcon
            message="Could not load commission settings"
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
                <Typography.Text strong>Global store front commission percent</Typography.Text>
                <Typography.Paragraph type="secondary" className="!mb-0 !mt-1">
                  The percentage of each paid storefront order that is
                  attributed to the Global store front as commission.
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
                value={value}
                onChange={(v) => setValue(v ?? null)}
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
                onClick={() => setValue(initial)}
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
