import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App as AntdApp,
  Button,
  Empty,
  Input,
  Popconfirm,
  Skeleton,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { DealImageResponse, UpdateDealImageRequest } from "@/lib/types";

// Mirrors DealService's limits so a bad pick fails before it uploads.
const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
const ACCEPT = EXTENSIONS.map((e) => `.${e}`).join(",");

function validateFiles(files: File[], existing: number): string | null {
  if (existing + files.length > MAX_IMAGES)
    return `A deal can have at most ${MAX_IMAGES} pictures; it has ${existing}.`;
  for (const f of files) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONS.includes(ext))
      return `${f.name}: only ${EXTENSIONS.join(", ")} pictures are accepted.`;
    if (f.size === 0 || f.size > MAX_BYTES) return `${f.name}: pictures must be under 5 MB.`;
  }
  return null;
}

/**
 * Pictures for a saved deal. Every change goes straight to the API (upload,
 * on/off, caption, order, delete); none of it waits for the deal form's Save.
 */
export function DealImagesManager({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryKey = ["deal-images", dealId];
  const { data: images, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet<DealImageResponse[]>(`Deal/Images/${dealId}`);
      if (!res.status) throw new Error(res.message ?? "Failed to load pictures");
      return res.data ?? [];
    },
  });
  const list = images ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey });
    // Stale but not refetched: the open edit form re-seeds itself from this
    // query and would lose unsaved changes. The detail modal refetches on open.
    queryClient.invalidateQueries({ queryKey: ["deal", dealId], refetchType: "none" });
    queryClient.invalidateQueries({ queryKey: ["deals"] });
  }

  async function upload(files: File[]) {
    if (files.length === 0) return;
    const error = validateFiles(files, list.length);
    if (error) {
      message.error(error);
      return;
    }
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f, f.name));
    setUploading(true);
    const res = await apiPost<DealImageResponse[]>(`Deal/UploadImages/${dealId}`, fd);
    setUploading(false);
    if (!res.status) {
      message.error(res.message ?? "Upload failed");
      return;
    }
    message.success(files.length === 1 ? "Picture added" : `${files.length} pictures added`);
    refresh();
  }

  async function patch(image: DealImageResponse, body: UpdateDealImageRequest) {
    setBusyId(image.id);
    const res = await apiPatch<DealImageResponse>(
      `Deal/UpdateImage/${dealId}/${image.id}`,
      body,
    );
    setBusyId(null);
    if (!res.status) {
      message.error(res.message ?? "Update failed");
      return false;
    }
    refresh();
    return true;
  }

  // Renumbers the whole list 0..n-1 after the move, so pictures that share a
  // sortOrder still move, and only patches the ones whose number changed.
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const changed = next.flatMap((img, i) => (img.sortOrder === i ? [] : [{ img, i }]));
    setBusyId(list[index].id);
    const results = await Promise.all(
      changed.map(({ img, i }) =>
        apiPatch<DealImageResponse>(`Deal/UpdateImage/${dealId}/${img.id}`, {
          sortOrder: i,
        }),
      ),
    );
    setBusyId(null);
    const failed = results.find((r) => !r.status);
    if (failed) message.error(failed.message ?? "Reorder failed");
    refresh();
  }

  async function remove(image: DealImageResponse) {
    setBusyId(image.id);
    const res = await apiDelete<boolean>(`Deal/DeleteImage/${dealId}/${image.id}`);
    setBusyId(null);
    if (!res.status) {
      message.error(res.message ?? "Delete failed");
      return;
    }
    refresh();
  }

  const shown = list.filter((i) => i.isActive).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {list.length}/{MAX_IMAGES} pictures · {shown} shown to customers. Changes save
          immediately. Each one is a slide in the web shop's home-page banner slider
          that opens this deal. Slides are 2:1 and cropped to fill, as previewed here, so
          use wide pictures, e.g. 1600×800.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void upload(files);
          }}
        />
        <Button
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={list.length >= MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
        >
          Add pictures
        </Button>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : list.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No pictures yet. jpg, png, webp or gif, up to 5 MB each."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((img, i) => (
            <DealImageCard
              key={img.id}
              image={img}
              busy={busyId === img.id}
              isFirst={i === 0}
              isLast={i === list.length - 1}
              onToggle={(v) => patch(img, { isActive: v })}
              onCaption={(caption) => patch(img, { caption })}
              onMove={(d) => move(i, d)}
              onDelete={() => remove(img)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DealImageCard({
  image,
  busy,
  isFirst,
  isLast,
  onToggle,
  onCaption,
  onMove,
  onDelete,
}: {
  image: DealImageResponse;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (value: boolean) => void;
  onCaption: (caption: string) => Promise<boolean>;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(image.caption ?? "");
  useEffect(() => setCaption(image.caption ?? ""), [image.caption]);

  async function saveCaption() {
    if (caption.trim() === (image.caption ?? "")) return;
    // An empty string is how the API clears a caption.
    if (!(await onCaption(caption.trim()))) setCaption(image.caption ?? "");
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="relative bg-muted">
        <img
          src={image.url}
          alt={image.caption ?? ""}
          // Same crop as superappweb's CampaignBanners.
          className={`aspect-[2/1] w-full object-cover ${image.isActive ? "" : "opacity-40"}`}
        />
        {!image.isActive && <Tag className="!absolute left-2 top-2">Hidden</Tag>}
      </div>
      <div className="space-y-2 p-2">
        <Input
          size="small"
          placeholder="Caption (optional)"
          value={caption}
          maxLength={200}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
          onPressEnter={(e) => e.currentTarget.blur()}
        />
        <div className="flex items-center justify-between">
          <Tooltip title={image.isActive ? "Shown to customers" : "Hidden from customers"}>
            <Switch
              size="small"
              checked={image.isActive}
              loading={busy}
              onChange={onToggle}
            />
          </Tooltip>
          <div className="flex gap-1">
            <Button
              size="small"
              icon={<ArrowLeftOutlined />}
              disabled={isFirst || busy}
              onClick={() => onMove(-1)}
            />
            <Button
              size="small"
              icon={<ArrowRightOutlined />}
              disabled={isLast || busy}
              onClick={() => onMove(1)}
            />
            <Popconfirm title="Delete this picture?" okText="Delete" onConfirm={onDelete}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={busy} />
            </Popconfirm>
          </div>
        </div>
      </div>
    </div>
  );
}
