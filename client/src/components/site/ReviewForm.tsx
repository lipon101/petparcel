// The review form on a product page. It is deliberately gated: only a signed-in
// customer who has a settled order containing this product sees the form. The
// gate is enforced on the SERVER (reviews.create rejects a non-buyer with
// FORBIDDEN); this component only mirrors that decision so the shopper gets a
// clear message instead of a failed submit. A submitted review starts pending -
// it is not shown until an admin approves it - so the success state says so.
//
// Photos are optional and real: the browser uploads each file straight to
// storage via a signed URL (the server never proxies the bytes), and only the
// resulting /app-storage path is sent with the review. The server re-validates
// every path, so this UI cannot smuggle an off-site URL onto the page.
import { useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Check, ImagePlus, Star, X } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { cn } from "@/lib/utils";

const field =
  "mt-1.5 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const MAX_PHOTOS = 5;

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "h-6 w-6",
              n <= shown ? "fill-amber-400 text-amber-400" : "text-line",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ productId }: { productId: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Public /app-storage paths of the photos already uploaded to storage.
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const gate = trpc.reviews.canReview.useQuery(
    { productId },
    { enabled: Boolean(user), retry: false },
  );

  const signUpload = trpc.reviews.photoUploadUrl.useMutation();
  const commitUpload = trpc.reviews.photoCommit.useMutation();

  const submit = trpc.reviews.create.useMutation({
    onSuccess: () => {
      setDone(true);
      setRating(0);
      setTitle("");
      setBody("");
      setPhotos([]);
      void utils.catalog.bySlug.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  /** Upload one file: ask for a signed PUT, send the bytes straight to storage,
   *  then index the object and keep its public path. Returns null on failure so
   *  one bad file does not lose the rest. */
  async function uploadOne(file: File): Promise<string | null> {
    const signed = await signUpload.mutateAsync({
      filename: file.name,
      contentType: file.type || "image/jpeg",
    });
    const put = await fetch(signed.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "image/jpeg" },
    });
    if (!put.ok) return null;
    const committed = await commitUpload.mutateAsync({ key: signed.key, name: file.name });
    return committed.url;
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const room = MAX_PHOTOS - photos.length;
      const chosen = Array.from(files).slice(0, Math.max(0, room));
      for (const file of chosen) {
        if (!file.type.startsWith("image/")) {
          setError("Photos only, please - a PNG, JPEG, GIF or WebP.");
          continue;
        }
        try {
          const url = await uploadOne(file);
          if (url) setPhotos((p) => [...p, url].slice(0, MAX_PHOTOS));
          else setError("That photo didn't upload. Try a smaller file.");
        } catch {
          setError("That photo didn't upload. Try a smaller file.");
        }
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    if (body.trim().length < 10) {
      setError("Tell us a little more - at least a sentence.");
      return;
    }
    submit.mutate({
      productId,
      rating,
      title: title.trim() || undefined,
      body: body.trim(),
      images: photos.length > 0 ? photos : undefined,
    });
  }

  // Not signed in: invite them to sign in, no form.
  if (!user) {
    return (
      <div className="card-soft p-6">
        <p className="text-[14.5px] font-semibold">Bought this? Share how it went.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray">
          Reviews come from real orders only. Sign in to review the products you have received.
        </p>
        <Link
          to="/login?next=/account"
          className="mt-4 inline-flex h-10 items-center rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Sign in to review
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card-soft flex items-start gap-3 p-6">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-deep">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[14.5px] font-semibold">Thanks - your review is in.</p>
          <p className="mt-1 text-sm leading-relaxed text-gray">
            It is pending a quick check and will appear here once it is approved.
          </p>
        </div>
      </div>
    );
  }

  if (gate.isLoading) {
    return <div className="card-soft h-24 animate-pulse p-6" aria-hidden="true" />;
  }

  // Signed in but not a verified buyer (or already reviewed): explain, no form.
  if (!gate.data?.canReview) {
    const reason = gate.data?.reason;
    return (
      <div className="card-soft p-6">
        <p className="text-[14.5px] font-semibold">
          {reason === "already_reviewed" ? "You have already reviewed this" : "Reviews are for verified buyers"}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray">
          {reason === "already_reviewed"
            ? "Thanks for weighing in. You can edit or remove it from your account."
            : "Once you have received an order for this product, you can review it here. That keeps every review tied to a real purchase."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-soft p-6">
      <p className="text-[14.5px] font-semibold">Write a Review</p>
      <p className="mt-1 text-sm text-gray">
        You bought this - your review will be marked as a verified purchase.
      </p>

      <div className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray">Your rating</span>
        <div className="mt-1.5">
          <StarPicker value={rating} onChange={setRating} />
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray">
        Headline (optional)
        <input
          className={cn(field, "h-11")}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sums it up in a few words"
        />
      </label>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray">
        Your review
        <textarea
          className={cn(field, "min-h-[110px] py-2.5")}
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you think? How did it hold up?"
        />
      </label>

      {/* Optional photos. */}
      <div className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray">
          Upload photos (max {MAX_PHOTOS}, optional)
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {photos.map((src) => (
            <span key={src} className="relative inline-flex">
              <img
                src={src}
                alt=""
                className="h-16 w-16 rounded-md border border-line-soft object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos((p) => p.filter((s) => s !== src))}
                className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="inline-flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-gray transition hover:border-primary hover:text-primary disabled:opacity-50"
              aria-label="Add photos"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{uploading ? "..." : "Add"}</span>
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onPickFiles(e.target.files)}
        />
        <p className="mt-1.5 text-xs text-gray">
          You can upload up to {MAX_PHOTOS} photos with your review.
        </p>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-coral-deep">{error}</p>}

      <button
        type="submit"
        disabled={submit.isPending || uploading}
        className="mt-4 inline-flex h-11 items-center rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {submit.isPending ? "Submitting..." : "Submit Review"}
      </button>
      <p className="mt-2 text-xs text-gray">Reviews are checked before they go live.</p>
    </form>
  );
}
