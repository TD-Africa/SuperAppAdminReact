import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App as AntdApp, Button, Card, Input, Modal, Skeleton, Space, Switch, Typography } from "antd";
import { useAuthStore } from "@/stores/auth";
import { Permission } from "@/lib/permissions";
import {
  createStorefrontTheme,
  deleteStorefrontTheme,
  getStorefrontTheme,
  updateStorefrontTheme,
} from "@/lib/storefrontApi";
import ImageUploadField from "@/components/storefront/ImageUploadField";

function parseThemeJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readHeroImageUrl(raw: string | null | undefined) {
  const value = parseThemeJson(raw).heroImageUrl;
  return typeof value === "string" && value ? value : null;
}

export default function StorefrontThemeDesignPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));
  const { themeId } = useParams();
  const isNew = !themeId || themeId === "new";
  const [themeName, setThemeName] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const query = useQuery({
    queryKey: ["storefront", "theme", themeId],
    enabled: !isNew,
    queryFn: async () => {
      const res = await getStorefrontTheme(themeId!);
      if (!res.status || !res.data) throw new Error(res.message ?? "Failed to load storefront theme");
      return res.data;
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setThemeName(query.data.themeName ?? "");
    setHeroImageUrl(readHeroImageUrl(query.data.themeJson));
    setIsActive(query.data.isActive);
  }, [query.data]);

  const dirty = isNew || !query.data || themeName !== (query.data.themeName ?? "")
    || heroImageUrl !== readHeroImageUrl(query.data.themeJson) || isActive !== query.data.isActive;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!themeName.trim()) throw new Error("Theme name is required");
      // themeJson may carry keys this page does not edit; keep them intact.
      const { heroImageUrl: _previous, ...rest } = parseThemeJson(query.data?.themeJson);
      const themeJson = JSON.stringify(heroImageUrl ? { ...rest, heroImageUrl } : rest);
      const body = { themeName: themeName.trim(), themeJson, isActive };
      const res = isNew
        ? await createStorefrontTheme(body)
        : await updateStorefrontTheme(themeId!, body);
      if (!res.status || !res.data) throw new Error(res.message ?? "Failed to save storefront theme");
      return res.data;
    },
    onSuccess: () => {
      message.success(isNew ? "Theme created" : "Theme updated");
      void queryClient.invalidateQueries({ queryKey: ["storefront", "themes"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront", "theme", themeId] });
      navigate("/storefront-themes");
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "Failed to save theme"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!themeId) throw new Error("Missing theme ID");
      const res = await deleteStorefrontTheme(themeId);
      if (!res.status) throw new Error(res.message ?? "Failed to remove theme");
      return res;
    },
    onSuccess: () => {
      message.success("Theme removed");
      void queryClient.invalidateQueries({ queryKey: ["storefront", "themes"] });
      navigate("/storefront-themes");
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "Failed to remove theme"),
  });

  if (!isNew && query.isLoading) return <div className="flex justify-center py-20"><Skeleton active /></div>;
  if (!isNew && (query.isError || !query.data)) {
    return <Alert type="error" showIcon message="Could not load theme"
      description={query.error instanceof Error ? query.error.message : "Unknown error"}
      action={<Button size="small" onClick={() => query.refetch()}>Retry</Button>} />;
  }

  const confirmDelete = () => Modal.confirm({
    title: "Remove this theme?",
    content: "The theme will be removed from the standalone theme library.",
    okText: "Remove theme",
    okButtonProps: { danger: true },
    onOk: () => deleteMutation.mutateAsync(),
  });

  return (
    <div className="space-y-6">
      <div>
        <Typography.Title level={3} className="!m-0">{isNew ? "Create storefront theme" : "Edit storefront theme"}</Typography.Title>
        <Typography.Text type="secondary">Themes are standalone configuration records and do not depend on active brands.</Typography.Text>
      </div>
      <Card>
        <div className="space-y-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-[240px] flex-1 space-y-2">
              <Typography.Text strong>Theme name</Typography.Text>
              <Input value={themeName} disabled={!canEdit} onChange={(e) => setThemeName(e.target.value)} placeholder="Theme name" />
            </div>
            <div className="min-w-[200px] space-y-2">
              <Typography.Text strong>Active</Typography.Text>
              <div><Switch checked={isActive} disabled={!canEdit} onChange={setIsActive} checkedChildren="Active" unCheckedChildren="Inactive" /></div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Typography.Text strong>Hero image</Typography.Text>
              <Typography.Text type="secondary"> (optional)</Typography.Text>
            </div>
            <ImageUploadField
              variant="hero"
              value={heroImageUrl}
              onChange={setHeroImageUrl}
              onUploadingChange={setUploadingHero}
              disabled={!canEdit}
              hint="Wide image recommended (e.g. 1920×600), max 1.5 MB."
            />
          </div>
          <Space>
            <Button type="primary" loading={saveMutation.isPending} disabled={!canEdit || !dirty || uploadingHero || !themeName.trim()} onClick={() => void saveMutation.mutate()}>{isNew ? "Create theme" : "Save changes"}</Button>
            <Button disabled={saveMutation.isPending || deleteMutation.isPending} onClick={() => navigate("/storefront-themes")}>Cancel</Button>
            {!isNew ? <Button danger loading={deleteMutation.isPending} disabled={!canEdit || saveMutation.isPending} onClick={confirmDelete}>Remove theme</Button> : null}
          </Space>
        </div>
      </Card>
    </div>
  );
}
