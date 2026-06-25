import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Button,
  Radio,
  Space,
  Tag,
  Empty,
  Skeleton,
  Alert,
  App as AntdApp,
} from "antd";
import {
  ApiOutlined,
  LinkOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { apiGet, apiPost } from "@/lib/api";
import type {
  CustomerResponse,
  CustomerSearchResponse,
  DynamicsSyncResponse,
  LinkDynamicsRequest,
} from "@/lib/types";

interface Props {
  customer: CustomerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

export function DynamicsLinkModal({
  customer,
  open,
  onOpenChange,
  onLinked,
}: Props) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const [selected, setSelected] = useState<string | null>(null);

  const alreadyLinked = !!customer?.dynamicsId;

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const {
    data: candidates,
    isLoading: loadingCandidates,
    isFetching: refetchingCandidates,
    refetch,
  } = useQuery({
    queryKey: ["dynamics-candidates", customer?.id],
    queryFn: async () => {
      if (!customer) return [];
      const res = await apiGet<CustomerSearchResponse[]>(
        `User/GetDynamicsCandidates/${customer.id}/dynamics-candidates`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load candidates");
      return res.data ?? [];
    },
    enabled: !!customer && open && !alreadyLinked,
  });

  function onSynced(action: "linked" | "created", res: DynamicsSyncResponse | null) {
    message.success(
      res?.message ??
        (action === "linked"
          ? "Customer linked to Dynamics"
          : "Customer created in Dynamics"),
    );
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    if (customer) {
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
    }
    onLinked?.();
    onOpenChange(false);
  }

  const linkMutation = useMutation({
    mutationFn: async (dynamicsId: string) => {
      if (!customer) throw new Error("No customer selected");
      const body: LinkDynamicsRequest = { dynamicsId };
      const res = await apiPost<DynamicsSyncResponse>(
        `User/LinkDynamics/${customer.id}/link-dynamics`,
        body,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to link Dynamics record");
      return res.data;
    },
    onSuccess: (res) => onSynced("linked", res),
    onError: (err: Error) => message.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error("No customer selected");
      const res = await apiPost<DynamicsSyncResponse>(
        `User/CreateInDynamics/${customer.id}/create-in-dynamics`,
      );
      if (!res.status) throw new Error(res.message ?? "Failed to create in Dynamics");
      return res.data;
    },
    onSuccess: (res) => onSynced("created", res),
    onError: (err: Error) => message.error(err.message),
  });

  const busy = linkMutation.isPending || createMutation.isPending;
  // Linking is only ever driven by a selected candidate from the search results.
  // Customers that already have a Dynamics ID need nothing from us.
  const dynamicsIdToLink = (selected ?? "").trim();

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={
        <Space>
          <ApiOutlined />
          Dynamics ID for {customer?.companyName ?? "customer"}
        </Space>
      }
      width={680}
      footer={[
        <Button key="close" onClick={() => onOpenChange(false)} disabled={busy}>
          Close
        </Button>,
        <Button
          key="create"
          icon={<PlusCircleOutlined />}
          loading={createMutation.isPending}
          disabled={busy || alreadyLinked}
          onClick={() => createMutation.mutate()}
        >
          Create new ID on Dynamics
        </Button>,
        <Button
          key="link"
          type="primary"
          icon={<LinkOutlined />}
          loading={linkMutation.isPending}
          disabled={busy || alreadyLinked || !dynamicsIdToLink}
          onClick={() => linkMutation.mutate(dynamicsIdToLink)}
        >
          Link
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4">
        {alreadyLinked ? (
          <Alert
            type="success"
            showIcon
            message="Already linked to Dynamics"
            description={
              <span>
                This customer is already linked with Dynamics ID{" "}
                <Tag>{customer?.dynamicsId}</Tag> — no action is needed.
              </span>
            }
          />
        ) : (
          <>
            <Alert
              type="warning"
              showIcon
              message="Not linked to Dynamics"
              description="Select a matching Dynamics record below and click Link, or create a new record on Dynamics."
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Matching Dynamics records</span>
                <Button
                  size="small"
                  type="text"
                  icon={<ReloadOutlined />}
                  loading={refetchingCandidates}
                  onClick={() => refetch()}
                >
                  Refresh
                </Button>
              </div>

              {loadingCandidates ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : !candidates || candidates.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No matching Dynamics records found"
                />
              ) : (
                <Radio.Group
                  className="w-full"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <Space direction="vertical" className="w-full">
                    {candidates.map((c, i) => (
                      <Radio
                        key={c.customerAccount ?? `${c.name ?? "candidate"}-${i}`}
                        value={c.customerAccount}
                        disabled={!c.customerAccount}
                        className="!flex w-full items-center rounded border border-solid border-gray-200 !px-3 !py-2"
                      >
                        <span className="font-medium">{c.name ?? "—"}</span>
                        <Tag className="ml-2">{c.customerAccount ?? "no account"}</Tag>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
