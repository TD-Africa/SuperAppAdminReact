import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, ImageOff } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  url: string | null | undefined;
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

function isImage(url: string | null | undefined) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return IMAGE_EXTS.some((ext) => clean.endsWith(ext));
}

export function ImageViewerModal({ open, onOpenChange, title, subtitle, url }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-[400px] overflow-hidden rounded-md bg-muted">
          {!url ? (
            <div className="flex h-[500px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              <span className="text-sm">No document on file</span>
            </div>
          ) : isImage(url) ? (
            <img
              src={url}
              alt={title}
              className="mx-auto max-h-[70vh] w-auto object-contain"
            />
          ) : (
            <iframe src={url} title={title} className="h-[70vh] w-full border-0" />
          )}
        </div>
        <DialogFooter>
          {url && (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Open in new tab
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
