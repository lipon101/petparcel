import { useState } from "react";
import { ArrowLeft, ArrowRight, Film, ImageIcon, Link2, Loader2, Trash2 } from "lucide-react";
import {
  MAX_PRODUCT_MEDIA,
  describeSourceProblem,
  type ProductMedia,
} from "@shared/media";
import { useAdminData } from "@/admin/data-source";
import { Btn, Field, TextInput, useToast } from "@/admin/ui";
import { ImageUploader } from "@/components/site/ImageUploader";

/**
 * The product gallery: images AND videos, up to MAX_PRODUCT_MEDIA assets.
 *
 * Two ways in. Files and direct uploads go through the existing ImageUploader
 * (presigned put to our own storage). A third-party LINK (an upstream supplier
 * image or video) goes through `admin.ingestMedia`, which fetches it ONCE,
 * validates it and stores OUR copy - so the supplier URL is never stored on the
 * product, never sent to a browser, and a video becomes possible at all.
 */
export function MediaUploader({
  media,
  onChange,
}: {
  media: ProductMedia[];
  onChange: (media: ProductMedia[]) => void;
}) {
  const data = useAdminData();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const images = media.filter((m) => m.kind === "image").map((m) => m.url);

  // A file/URL upload replaces only the IMAGES; videos already in the gallery
  // are preserved and stay after them.
  const onImagesChange = (next: string[]) => {
    const videos = media.filter((m) => m.kind === "video");
    onChange([...next.map((u) => ({ url: u, kind: "image" as const })), ...videos]);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  };

  const remove = (index: number) => onChange(media.filter((_, i) => i !== index));

  const addFromLink = async () => {
    const problem = describeSourceProblem(url);
    if (problem) {
      toast.push(problem, "error");
      return;
    }
    if (media.length >= MAX_PRODUCT_MEDIA) {
      toast.push(`Up to ${MAX_PRODUCT_MEDIA} assets per product. Remove one first.`, "error");
      return;
    }
    setBusy(true);
    try {
      const item = await data.ingestMedia(url.trim());
      onChange([...media, item]);
      setUrl("");
      toast.push(
        item.kind === "video"
          ? "Video imported and self-hosted - it no longer depends on the supplier."
          : "Image imported and self-hosted - the source link is no longer exposed.",
      );
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not import that link.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {media.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {media.map((m, i) => (
            <li key={`${m.url}-${i}`} className="group relative overflow-hidden rounded-lg border border-border">
              <div className="relative aspect-square bg-muted">
                {m.kind === "video" ? (
                  <video
                    src={m.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {m.kind === "video" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  {m.kind}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-border bg-card px-1 py-1">
                <div className="flex">
                  <button
                    type="button"
                    aria-label="Move earlier"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="rounded px-1 text-xs text-muted-foreground hover:text-ink disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    disabled={i === media.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded px-1 text-xs text-muted-foreground hover:text-ink disabled:opacity-30"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Remove asset"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImageUploader images={images} onChange={onImagesChange} />

      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-3">
        <Field
          label="Import from a supplier link"
          hint="Paste an image or video URL. We fetch it once, validate it and host our own copy - the source link is never stored or shown."
        >
          <div className="flex flex-wrap items-start gap-2">
            <TextInput
              value={url}
              onChange={setUrl}
              placeholder="https://…/photo.jpg or …/clip.mp4"
            />
          </div>
        </Field>
        <div className="mt-2 flex items-center gap-2">
          <Btn size="sm" variant="outline" onClick={addFromLink} disabled={busy || !url.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {busy ? "Importing…" : "Import link"}
          </Btn>
          <span className="text-xs text-muted-foreground">
            {media.length}/{MAX_PRODUCT_MEDIA} assets
          </span>
        </div>
      </div>
    </div>
  );
}
