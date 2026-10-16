// Newsletter subscribers: the mailing list, with source and status.
//
// SERVER-SIDE PAGED, and each row can be deleted.
//
// WHY PAGED ON THE SERVER. The list only ever grows - every footer signup
// appends a row - so the page never loads it whole. It asks the server for one
// page and gets that page plus the TOTAL, and the search box is applied in SQL
// so it searches the whole list rather than the page that happened to be
// loaded. (The old shape loaded everything and filtered in the browser, which
// silently searched only what was already downloaded.)
//
// WHY A ROW CAN BE DELETED. A newsletter list collects junk: a typo, a bot, a
// deliberately fake address. Suppressing an address (the status pill) keeps its
// record on purpose, but a bogus one should leave no trace - so this page also
// carries a real DELETE, behind a confirmation that names the address.
import { useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { formatDate } from "@shared/store";
import { ADMIN_PAGE_SIZE_DEFAULT } from "@shared/admin-paging";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminSubscriber, AdminSubscriberStatus } from "../types";
import {
  AdminPageHeader,
  Btn,
  Column,
  ConfirmDialog,
  DataTable,
  ErrorPanel,
  Pagination,
  Pill,
  SearchInput,
  TableSkeleton,
  useToast,
} from "../ui";

/** How long the search box waits before it queries, so typing does not fire a
 *  request per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

/** The most rows one CSV export will walk. The export pages through the whole
 *  matching list, so this is the ceiling on how much work one click can cause;
 *  hitting it is reported rather than silently truncating the file. */
const EXPORT_MAX_ROWS = 5000;
const EXPORT_PAGE_SIZE = 100;

export function NewsletterPage() {
  const data = useAdminData();
  const toast = useToast();

  // The page/size/search the panel is asking the SERVER for. These drive the
  // query, so the list on screen is always what the database returned for this
  // exact request - never a client-side slice of a stale load.
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(ADMIN_PAGE_SIZE_DEFAULT);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data: result, isLoading, error, refetch } = useAsync(
    () => data.listSubscribers({ page, pageSize: size, search }),
    [data, page, size, search],
  );

  const [pendingDelete, setPendingDelete] = useState<AdminSubscriber | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Debounce the search box into the term that is actually queried.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1); // A new search is a new list; page 3 of the old one is meaningless.
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Adopt the page the server ACTUALLY served. It differs from the one requested
  // in exactly one case that matters: the requested page no longer exists
  // because its last rows were just deleted. The server then answers with the
  // last real page rather than an empty one - so the panel lands on data that
  // exists instead of a blank table, and the controls agree with it. Guarded on
  // inequality so this settles after one hop instead of looping.
  useEffect(() => {
    if (result && result.page !== page) setPage(result.page);
  }, [result, page]);

  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const servedPage = result?.page ?? page;

  const setStatus = async (s: AdminSubscriber, status: AdminSubscriberStatus) => {
    try {
      await data.setSubscriberStatus(s.id, status);
      toast.push(status === "unsubscribed" ? "Marked unsubscribed." : "Marked subscribed.");
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Update failed.", "error");
    }
  };

  const columns: Column<AdminSubscriber>[] = useMemo(
    () => [
      {
        key: "email",
        header: "Email",
        sortable: true,
        render: (s) => <span className="font-semibold text-ink">{s.email}</span>,
      },
      {
        key: "source",
        header: "Source",
        sortable: true,
        render: (s) => <span className="capitalize text-muted-foreground">{s.source}</span>,
      },
      {
        key: "status",
        header: "Status",
        align: "center",
        sortValue: (s) => s.status,
        render: (s) => (
          <button
            type="button"
            onClick={() => setStatus(s, s.status === "subscribed" ? "unsubscribed" : "subscribed")}
            className="inline-flex items-center rounded-full transition hover:opacity-80"
            title={s.status === "subscribed" ? "Mark unsubscribed" : "Mark subscribed"}
          >
            <Pill tone={s.status === "subscribed" ? "green" : "slate"}>{s.status}</Pill>
          </button>
        ),
      },
      {
        key: "createdAt",
        header: "Joined",
        sortable: true,
        align: "right",
        render: (s) => <span className="text-muted-foreground">{formatDate(s.createdAt)}</span>,
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (s) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(s);
            }}
            aria-label={`Delete subscriber ${s.email}`}
            title={`Delete ${s.email}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ),
      },
    ],
    // `setStatus` closes over `data`, the toast and `refetch`, all of which are
    // stable for the page's lifetime; rebuilding the columns when the toast
    // context object changes identity would be pointless churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, toast],
  );

  /**
   * The delete itself, reached ONLY from the confirmation dialog's confirm
   * button - never from the row's own click - so an accidental tap cannot wipe a
   * real subscriber.
   *
   * The refetch is what makes the list reflect the database: the row is gone
   * from Postgres after `deleteSubscriber` resolves, and re-querying is what
   * removes it from the screen and re-fetches the true total. If the delete
   * emptied the last page, the server answers with the previous page and the
   * effect above adopts it - so the view never strands on a blank page.
   */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await data.deleteSubscriber(pendingDelete.id);
      toast.push(`${pendingDelete.email} deleted.`);
      setPendingDelete(null);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not delete the subscriber.", "error");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Export the WHOLE matching list, not just the page on screen.
   *
   * The export walks the server in pages of `EXPORT_PAGE_SIZE` until it has
   * every row the current search matches. It does not simply dump `rows`, which
   * would silently export one page and look complete; and it stops at
   * `EXPORT_MAX_ROWS`, saying so, rather than quietly truncating a huge file.
   */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: AdminSubscriber[] = [];
      let offsetPage = 1;
      let reported = 0;
      for (;;) {
        const res = await data.listSubscribers({
          page: offsetPage,
          pageSize: EXPORT_PAGE_SIZE,
          search,
        });
        all.push(...res.rows);
        reported = res.total;
        if (res.rows.length === 0 || all.length >= res.total) break;
        if (all.length >= EXPORT_MAX_ROWS) break;
        offsetPage += 1;
      }
      const capped = all.length < reported;
      const header = "email,source,status,createdAt";
      const body = all
        .map((s) =>
          [s.email, s.source, s.status, s.createdAt]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "petparcel-subscribers.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.push(
        capped
          ? `Exported the first ${all.length} of ${reported} (limit ${EXPORT_MAX_ROWS}). Narrow the search to export the rest.`
          : `Exported ${all.length} subscriber${all.length === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Newsletter"
        subtitle={
          total === 1
            ? "1 person has opted in to store emails."
            : `${total} people have opted in to store emails.`
        }
        actions={
          <Btn variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </Btn>
        }
      />
      <div className="mb-5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search subscribers…" />
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        // An empty page is a real, honest state: either the list is empty, or the
        // search matched nothing. Rendering the pager here would show "0 of 0",
        // which reads as broken.
        <DataTable
          rows={rows}
          columns={columns}
          emptyTitle={search ? "No subscribers match" : "No subscribers yet"}
          emptyBody={
            search
              ? "Try a different search term."
              : "People who opt in from the storefront will appear here."
          }
        />
      ) : (
        <>
          <DataTable
            // The table renders exactly the page the server returned, and its
            // OWN pager is switched off: the server has already paged the list,
            // and the single `Pagination` below reports that server page. Left
            // on, the table's pager would draw a SECOND control reading "1 of 1"
            // over the page it was handed - two pagers stacked on one screen.
            rows={rows}
            columns={columns}
            pageSize={rows.length}
            pagination={false}
            emptyTitle={search ? "No subscribers match" : "No subscribers yet"}
            emptyBody={
              search
                ? "Try a different search term."
                : "People who opt in from the storefront will appear here."
            }
          />
          <Pagination
            page={servedPage}
            pageCount={result?.pageCount ?? 1}
            from={total === 0 ? 0 : (servedPage - 1) * size + 1}
            to={Math.min(total, servedPage * size)}
            total={total}
            onPage={setPage}
            pageSize={size}
            onPageSize={(n) => {
              setSize(n);
              setPage(1);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete ${pendingDelete.email}?` : "Delete subscriber?"}
        body={
          pendingDelete
            ? `This permanently removes ${pendingDelete.email} (joined ${formatDate(
                pendingDelete.createdAt,
              )}) from the newsletter list. They will no longer appear here or in an export. This cannot be undone. To keep the record but stop mailings, cancel and mark them unsubscribed instead.`
            : ""
        }
        confirmLabel={busy ? "Deleting…" : "Delete subscriber"}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
