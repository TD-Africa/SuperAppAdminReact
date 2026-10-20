import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Input,
  Modal,
  Skeleton,
  Space,
  Switch,
  Typography,
} from "antd";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  deleteStorefrontBrandTheme,
  getStorefrontBrandTheme,
  setStorefrontBrandTheme,
} from "@/lib/storefrontApi";

const DEFAULT_THEME_NAME = "brand-default";
const DEFAULT_THEME_JSON = "{}";

export default function StorefrontBrandThemeDesignPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const { storefrontBrandId } = useParams();

  const [themeName, setThemeName] = useState("");
  const [themeJson, setThemeJson] = useState("");
  const [isActive, setIsActive] = useState(true);

  const themeQueryKey = useMemo(
    () => ["storefront", "brand-theme", storefrontBrandId] as const,
    [storefrontBrandId],
  );

  const themeQuery = useQuery({
    queryKey: themeQueryKey,
    enabled: Boolean(storefrontBrandId),
    queryFn: async () => {
      if (!storefrontBrandId) return null;
      const res = await getStorefrontBrandTheme(storefrontBrandId);
      if (res.status && res.data) return { theme: res.data, exists: true };

      // A theme is optional until an admin saves one. The backend's 404 is
      // therefore a valid first-load state, not a page error. Keep the draft
      // local; SetStorefrontBrandTheme creates the record on the first save.
      if (res.message?.toLowerCase().includes("storefront brand theme not found")) {
        return {
          theme: {
            storefrontBrandId,
            themeName: DEFAULT_THEME_NAME,
            themeJson: DEFAULT_THEME_JSON,
            isActive: false,
          },
          exists: false,
        };
      }

      throw new Error(res.message ?? "Failed to load theme");
    },
  });

  // Load the “backend truth” into our local draft.
  useEffect(() => {
    const theme = themeQuery.data?.theme;
    if (!theme) return;
    setThemeName(theme.themeName ?? "");
    setThemeJson(theme.themeJson ?? "");
    setIsActive(theme.isActive);
  }, [themeQuery.data]);

  const jsonParseError = useMemo(() => {
    const raw = themeJson.trim();
    if (!raw) return null;
    try {
      JSON.parse(raw);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [themeJson]);

  const dirty = useMemo(() => {
    const base = themeQuery.data?.theme;
    if (!base) return false;
    return (
      themeName !== (base.themeName ?? "") ||
      themeJson !== (base.themeJson ?? "") ||
      isActive !== base.isActive
    );
  }, [themeName, themeJson, isActive, themeQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!storefrontBrandId) throw new Error("Missing storefrontBrandId");
      const body = {
        themeName: themeName.trim() || "Untitled",
        themeJson,
        // Backend expects a boolean “isActive”; keep the switch synced to this.
        isActive,
      };
      const res = await setStorefrontBrandTheme(storefrontBrandId, body);
      if (!res.status || !res.data) throw new Error(res.message ?? "Failed to save theme");
      return res.data;
    },
    onSuccess: () => {
      message.success("Theme saved");
      void queryClient.invalidateQueries({ queryKey: themeQueryKey });
    },
    onError: (err) => message.error(err instanceof Error ? err.message : "Failed to save theme"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!storefrontBrandId) throw new Error("Missing storefrontBrandId");
      const res = await deleteStorefrontBrandTheme(storefrontBrandId);
      if (!res.status) throw new Error(res.message ?? "Failed to remove theme");
      return res;
    },
    onSuccess: () => {
      message.success("Theme removed");
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brand-themes"] });
      navigate("/franchise-brand-themes");
    },
    onError: (err) => message.error(err instanceof Error ? err.message : "Failed to remove theme"),
  });

  const confirmDelete = () => {
    Modal.confirm({
      title: "Remove this theme?",
      content: "The theme will no longer be used by this storefront brand. You can add it again later.",
      okText: "Remove theme",
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutateAsync(),
    });
  };

  if (themeQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Skeleton active />
      </div>
    );
  }

  if (themeQuery.isError || !themeQuery.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Could not load theme"
        description={
          themeQuery.error instanceof Error ? themeQuery.error.message : "Unknown error"
        }
        action={
          <Button size="small" onClick={() => themeQuery.refetch()} disabled={mutation.isPending}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">
          Storefront brand theme
        </Typography.Title>
        <Typography.Text type="secondary">
          Edit the theme JSON for this storefront brand. Toggle activation with “isActive”.
        </Typography.Text>
        {!themeQuery.data?.exists ? (
          <Typography.Paragraph type="secondary" className="!mb-0 !mt-2">
            No theme has been saved for this brand yet. Update the draft and save it to create
            the brand theme.
          </Typography.Paragraph>
        ) : null}
      </div>

      <Card>
        <div className="space-y-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-[240px] flex-1 space-y-2">
              <div>
                <Typography.Text strong>Theme name</Typography.Text>
              </div>
              <Input
                value={themeName}
                disabled={!canEdit}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="Theme name"
              />
            </div>

            <div className="min-w-[200px] space-y-2">
              <div>
                <Typography.Text strong>Active</Typography.Text>
              </div>
              <Switch
                checked={isActive}
                disabled={!canEdit}
                onChange={setIsActive}
                checkedChildren="Active"
                unCheckedChildren="Inactive"
              />
            </div>
          </div>

          {jsonParseError ? (
            <Alert
              type="warning"
              showIcon
              message="themeJson is not valid JSON"
              description="This UI treats themeJson as an opaque string, but JSON parsing failed. If your backend expects a raw serialized payload, keep it as-is; otherwise fix the JSON."
            />
          ) : null}

          <div className="space-y-2">
            <Typography.Text strong>themeJson</Typography.Text>
            <Input.TextArea
              value={themeJson}
              disabled={!canEdit}
              onChange={(e) => setThemeJson(e.target.value)}
              rows={16}
              className="font-mono"
              placeholder='Paste theme JSON here...'
            />
          </div>

          <Space>
            <Button
              type="primary"
              loading={mutation.isPending}
              disabled={!canEdit || !dirty || mutation.isPending}
              onClick={() => void mutation.mutate()}
            >
              Save changes
            </Button>
            <Button
              disabled={!canEdit || mutation.isPending || deleteMutation.isPending}
              onClick={() => {
                setThemeName(themeQuery.data?.theme.themeName ?? "");
                setThemeJson(themeQuery.data?.theme.themeJson ?? "");
                setIsActive(themeQuery.data?.theme.isActive ?? true);
              }}
            >
              Discard
            </Button>
            {themeQuery.data?.exists ? (
              <Button
                danger
                disabled={!canEdit || mutation.isPending || deleteMutation.isPending}
                loading={deleteMutation.isPending}
                onClick={confirmDelete}
              >
                Remove theme
              </Button>
            ) : null}
          </Space>
        </div>
      </Card>
    </div>
  );
}
