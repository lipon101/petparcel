// Product image manager for the admin editor.
//
// Uploads go BROWSER-DIRECT to storage: this asks the API for a signed PUT URL,
// PUTs the file, then commits it so the object is indexed. The server never
// handles the bytes. Uploaded files land on `/app-storage/<key>`, which is the
// app's own public read path — so the same URL renders in the admin preview and
// on the storefront.
//
// The gallery is a plain string[] the parent owns (these ARE the product's
// `images`), so reorder and delete are just array moves — no separate state to
// drift. Pasting URLs still works: the bulk box merges into the same array.
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif";

export function ImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busyCount, setBusyCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const uploadImage = trpc.admin.uploadImage.useMutation();
  const commitImage = trpc.admin.commitImage.useMutation();

  const busy = busyCount > 0;

  const pushUnique = (urls: string[]) => {
    const next = [...images];
    for (const u of urls) if (u && !next.includes(u)) next.push(u);
    if (next.length !== images.length) onChange(next);
  };

  /** Upload an array of files, one at a time so a single bad file does not take
   *  the whole batch with it. */
  const handleFiles = async (files: File[] | FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError(null);
    setBusyCount(list.length);
    const uploaded: string[] = [];
    const problems: string[] = [];

    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        problems.push(`"${file.name}" isn't an image (PNG, JPEG, GIF, WebP or AVIF only).`);
        setBusyCount((n) => n - 1);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        problems.push(`"${file.name}" is over 8 MB — please resize it first.`);
        setBusyCount((n) => n - 1);
        continue;
      }
      try {
        const { uploadUrl, key } = await uploadImage.mutateAsync({
          filename: file.name,
          contentType: file.type,
        });
        // Step 2: the browser PUTs straight to object storage.
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Storage rejected the upload (HTTP ${res.status}).`);
        // Step 3: index it, and take back the readable URL.
        const { url } = await commitImage.mutateAsync({ key, name: file.name });
        uploaded.push(url);
      } catch (e) {
        problems.push(`"${file.name}": ${(e as Error).message}`);
      } finally {
        setBusyCount((n) => n - 1);
      }
    }

    if (uploaded.length) pushUnique(uploaded);
    if (problems.length) setError(problems.join(" "));
    if (inputRef.current) inputRef.current.value = "";
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const removeAt = (index: number) => onChange(images.filter((_, i) => i !== index));

  const commitDraft = () => {
    const lines = urlDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    pushUnique(lines);
    setUrlDraft("");
  };

  return (
    <div className="space-y-3">
      {/* Drop zone / file picker */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-2xl border-2 border-dashed p-5 text-center transition",
          dragging ? "border-primary bg-secondary/70" : "border-border bg-card/60 hover:border-primary/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
          }}
        />
        {busy ? (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading {busyCount} image{busyCount === 1 ? "" : "s"}…
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 text-sm font-semibold">Drag images here, or</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 inline-flex h-9 items-center rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Choose files
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              PNG, JPEG, GIF, WebP or AVIF · up to 8 MB each · several at once
            </p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/5 p-3 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}

      {/* Gallery */}
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, i) => (
            <li
              key={`${url}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border bg-muted",
                dragIndex === i && "opacity-50",
              )}
            >
              <div className="aspect-square">
                {broken[url] ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                    Can't load
                  </div>
                ) : (
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setBroken((b) => ({ ...b, [url]: true }))}
                  />
                )}
              </div>

              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  Main
                </span>
              )}

              <span className="absolute right-1.5 top-1.5 flex items-center gap-1">
                <button
                  type="button"
                  title="Move left"
                  aria-label="Move image left"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75 disabled:opacity-30"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Move right"
                  aria-label="Move image right"
                  disabled={i === images.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75 disabled:opacity-30"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Remove image"
                  aria-label="Remove image"
                  onClick={() => removeAt(i)}
                  className="grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white transition hover:bg-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>

              <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <GripVertical className="h-2.5 w-2.5" /> drag
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No images yet. The first image you add becomes the main catalog photo.
        </p>
      )}

      {/* Keep the paste-by-URL option working alongside uploads. */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground" htmlFor="p-image-urls">
          Add images by URL <span className="font-normal">(one per line)</span>
        </label>
        <div className="mt-1.5 flex items-start gap-2">
          <textarea
            id="p-image-urls"
            rows={2}
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={commitDraft}
            placeholder={"https://…/photo.jpg\n/sites/…/photo-2.jpg"}
            className="w-full rounded-xl border border-input bg-card p-3 font-mono text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={commitDraft}
            disabled={!urlDraft.trim()}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-input px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {images.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" /> Clear all images
          </button>
        )}
      </div>
    </div>
  );
}
