// Reviews moderation: approve / reject / hide / delete. Nothing is public on the
// storefront until a review is approved, so this is the gate that keeps the
// catalog clean.
import { useMemo, useState } from "react";
import { Eye, EyeOff, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { formatDateTime } from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminReview, AdminReviewStatus } from "../types";
import {
  AdminPageHeader,
  Btn,
  Card,
  ConfirmDialog,
  ErrorPanel,
  Pill,
  TableSkeleton,
  useToast,
} from "../ui";
import { cn } from "@/lib/utils";

type Filter = "pending" | "approved" | "rejected" | "all";

export function ReviewsPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: reviews, isLoading, error, refetch } = useAsync(() => data.listReviews(), [data]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [pendingDelete, setPendingDelete] = useState<AdminReview | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => (reviews ?? []).filter((r) => filter === "all" || r.status === filter),
    [reviews, filter],
  );
  const pendingCount = (reviews ?? []).filter((r) => r.status === "pending").length;

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.push(message);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (r: AdminReview, status: AdminReviewStatus) =>
    act(() => data.setReviewStatus(r.id, status), `Review ${status}.`);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await act(() => data.deleteReview(pendingDelete.id), "Review deleted.");
    setPendingDelete(null);
  };

  return (
    <>
      <AdminPageHeader
        title="Reviews"
        subtitle="Approve, reject or hide customer reviews. Nothing is public until you approve it."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold capitalize transition",
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-xs font-bold text-amber-950">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="text-2xl">🐾</span>
          <h3 className="text-lg font-medium text-ink">
            {filter === "pending" ? "No reviews waiting" : "Nothing here"}
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {filter === "pending"
              ? "New customer reviews will appear here for approval."
              : "No reviews match this filter yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={r.status === "approved" ? "green" : r.status === "rejected" ? "rose" : "amber"}>
                  {r.status}
                </Pill>
                {r.verified && <Pill tone="teal">Verified purchase</Pill>}
                {r.status === "approved" && !r.isPublic && <Pill tone="slate">Hidden</Pill>}
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">{r.rating}/5</span>
                <span className="text-sm font-semibold text-ink">{r.authorName}</span>
                <span className="text-xs text-muted-foreground">
                  {r.productName ? `on ${r.productName}` : "store testimonial"}
                </span>
              </div>
              {r.title && <p className="mt-2 text-sm font-semibold text-ink">{r.title}</p>}
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {r.status !== "approved" && (
                  <Btn size="sm" variant="primary" disabled={busy} onClick={() => setStatus(r, "approved")}>
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                    Approve
                  </Btn>
                )}
                {r.status !== "rejected" && (
                  <Btn size="sm" variant="outline" disabled={busy} onClick={() => setStatus(r, "rejected")}>
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                    Reject
                  </Btn>
                )}
                {r.status === "approved" && (
                  <Btn
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => act(() => data.setReviewVisibility(r.id, !r.isPublic), r.isPublic ? "Review hidden." : "Review shown.")}
                  >
                    {r.isPublic ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                    {r.isPublic ? "Hide" : "Show"}
                  </Btn>
                )}
                <Btn size="sm" variant="danger" disabled={busy} onClick={() => setPendingDelete(r)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete review?"
        body="This review will be permanently removed. This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
