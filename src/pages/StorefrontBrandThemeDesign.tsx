import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Modal,
  Radio,
  Skeleton,
  Space,
  Switch,
  Typography,
  Upload,
} from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  deleteStorefrontBrandTheme,
  getStorefrontBrandTheme,
  setStorefrontBrandTheme,
} from "@/lib/storefrontApi";

const THEME_PRESETS = [{ value: "samsung", label: "Samsung" }] as const;
type ThemePreset = (typeof THEME_PRESETS)[number]["value"];

const DEFAULT_PRESET: ThemePreset = "samsung";
const DEFAULT_THEME_NAME = "Samsung";
const MAX_HERO_BYTES = 1.5 * 1024 * 1024;

type ThemeConfig = { preset: ThemePreset; heroImageUrl: string | null };

function parseThemeJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseThemeConfig(raw: string | null | undefined): ThemeConfig {
  const obj = parseThemeJsonObject(raw);
  const preset = THEME_PRESETS.some((p) => p.value === obj.preset)
    ? (obj.preset as ThemePreset)
    : DEFAULT_PRESET;
  const heroImageUrl = typeof obj.heroImageUrl === "string" ? obj.heroImageUrl : null;
  return { preset, heroImageUrl };
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const DEFAULT_THEME_JSON = JSON.stringify({ preset: DEFAULT_PRESET, heroImageUrl: null });

export default function StorefrontBrandThemeDesignPage() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));

  const { storefrontBrandId } = useParams();

  const [preset, setPreset] = useState<ThemePreset>(DEFAULT_PRESET);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
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

  const resetFromServer = () => {
    const theme = themeQuery.data?.theme;
    if (!theme) return;
    const cfg = parseThemeConfig(theme.themeJson);
    setPreset(cfg.preset);
    setHeroImageUrl(cfg.heroImageUrl);
    setIsActive(theme.isActive);
  };

  useEffect(resetFromServer, [themeQuery.data]);

  const dirty = useMemo(() => {
    const base = themeQuery.data?.theme;
    if (!base) return false;
    const cfg = parseThemeConfig(base.themeJson);
    return (
      preset !== cfg.preset || heroImageUrl !== cfg.heroImageUrl || isActive !== base.isActive
    );
  }, [preset, heroImageUrl, isActive, themeQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!storefrontBrandId) throw new Error("Missing storefrontBrandId");
      // themeJson is the only storage the backend offers; keep unknown keys intact.
      const existing = parseThemeJsonObject(themeQuery.data?.theme.themeJson);
      const presetLabel = THEME_PRESETS.find((p) => p.value === preset)?.label ?? DEFAULT_THEME_NAME;
      const res = await setStorefrontBrandTheme(storefrontBrandId, {
        themeName: presetLabel,
        themeJson: JSON.stringify({ ...existing, preset, heroImageUrl }),
        isActive,
      });
      if (!res.status || !res.data) throw new Error(res.message ?? "Failed to save theme");
      return res.data;
    },
    onSuccess: () => {
      message.success("Theme saved");
      void queryClient.invalidateQueries({ queryKey: themeQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brand-themes"] });
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
      message.success("Theme removed. You can now create a new theme for this brand.");
      if (storefrontBrandId) {
        queryClient.setQueryData(themeQueryKey, {
          theme: {
            storefrontBrandId,
            themeName: DEFAULT_THEME_NAME,
            themeJson: DEFAULT_THEME_JSON,
            isActive: false,
          },
          exists: false,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["storefront", "brand-themes"] });
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
          Pick a theme and upload a hero image for this storefront brand.
        </Typography.Text>
        {!themeQuery.data?.exists ? (
          <Typography.Paragraph type="secondary" className="!mb-0 !mt-2">
            No theme has been saved for this brand yet. Choose a theme, upload a hero image, and
            save to create it.
          </Typography.Paragraph>
        ) : null}
      </div>

      <Card>
        <div className="space-y-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div>
                <Typography.Text strong>Theme</Typography.Text>
              </div>
              <Radio.Group
                value={preset}
                disabled={!canEdit}
                onChange={(e) => setPreset(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                options={THEME_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
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

          <div className="space-y-2">
            <div>
              <Typography.Text strong>Hero image</Typography.Text>
            </div>
            {heroImageUrl ? (
              <div className="overflow-hidden rounded-md border">
                <img src={heroImageUrl} alt="Hero" className="max-h-72 w-full object-cover" />
              </div>
            ) : (
              <Upload.Dragger
                accept="image/*"
                showUploadList={false}
                disabled={!canEdit}
                beforeUpload={async (file) => {
                  if (file.size > MAX_HERO_BYTES) {
                    message.error("Image is too large. Maximum size is 1.5 MB.");
                    return Upload.LIST_IGNORE;
                  }
                  setHeroImageUrl(await readAsDataUrl(file));
                  return false;
                }}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">Click or drag an image here to upload</p>
                <p className="ant-upload-hint">Wide image recommended (e.g. 1920×600), max 1.5 MB.</p>
              </Upload.Dragger>
            )}
            {heroImageUrl ? (
              <Space>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  disabled={!canEdit}
                  beforeUpload={async (file) => {
                    if (file.size > MAX_HERO_BYTES) {
                      message.error("Image is too large. Maximum size is 1.5 MB.");
                      return Upload.LIST_IGNORE;
                    }
                    setHeroImageUrl(await readAsDataUrl(file));
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} disabled={!canEdit}>
                    Replace image
                  </Button>
                </Upload>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!canEdit}
                  onClick={() => setHeroImageUrl(null)}
                >
                  Remove image
                </Button>
              </Space>
            ) : null}
          </div>

          <Space>
            <Button
              type="primary"
              loading={mutation.isPending}
              disabled={!canEdit || !dirty || mutation.isPending}
              onClick={() => void mutation.mutate()}
            >
              {themeQuery.data?.exists ? "Save changes" : "Create theme"}
            </Button>
            <Button
              disabled={!canEdit || mutation.isPending || deleteMutation.isPending}
              onClick={resetFromServer}
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
