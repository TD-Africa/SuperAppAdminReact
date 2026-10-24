import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_THEME_JSON = "{}";

export default function StorefrontThemeDesignPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const canEdit = useAuthStore((s) => s.hasPermission(Permission.CanEditBrands));
  const { themeId } = useParams();
  const isNew = !themeId || themeId === "new";
  const [themeName, setThemeName] = useState("");
  const [themeJson, setThemeJson] = useState(DEFAULT_THEME_JSON);
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
    setThemeJson(query.data.themeJson ?? DEFAULT_THEME_JSON);
    setIsActive(query.data.isActive);
  }, [query.data]);

  const jsonParseError = useMemo(() => {
    try {
      JSON.parse(themeJson);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }, [themeJson]);

  const dirty = isNew || !query.data || themeName !== (query.data.themeName ?? "")
    || themeJson !== (query.data.themeJson ?? DEFAULT_THEME_JSON) || isActive !== query.data.isActive;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!themeName.trim()) throw new Error("Theme name is required");
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
          {jsonParseError ? <Alert type="warning" showIcon message="themeJson is not valid JSON" description={jsonParseError} /> : null}
          <div className="space-y-2">
            <Typography.Text strong>themeJson</Typography.Text>
            <Input.TextArea value={themeJson} disabled={!canEdit} onChange={(e) => setThemeJson(e.target.value)} rows={16} className="font-mono" placeholder='Paste theme JSON here…' />
          </div>
          <Space>
            <Button type="primary" loading={saveMutation.isPending} disabled={!canEdit || !dirty || Boolean(jsonParseError)} onClick={() => void saveMutation.mutate()}>{isNew ? "Create theme" : "Save changes"}</Button>
            <Button disabled={saveMutation.isPending || deleteMutation.isPending} onClick={() => navigate("/storefront-themes")}>Cancel</Button>
            {!isNew ? <Button danger loading={deleteMutation.isPending} disabled={!canEdit || saveMutation.isPending} onClick={confirmDelete}>Remove theme</Button> : null}
          </Space>
        </div>
      </Card>
    </div>
  );
}
