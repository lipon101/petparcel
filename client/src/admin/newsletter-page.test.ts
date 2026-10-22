// Source-level wiring checks for the Newsletter page's delete + pagination.
//
// vitest runs in a node environment here (no jsdom), so the component cannot be
// mounted. These read the .tsx as text and pin the contracts that matter - the
// same approach the repo already uses for the Orders page delete flow
// (`orders-page.test.ts`) and the Telegram status view (`db-telegram-status.test.ts`):
//
//   1. EVERY ROW CARRIES A DELETE CONTROL, reached only through a confirmation
//      dialog that NAMES the address - so a stray click cannot wipe a real
//      subscriber.
//   2. THE DELETE GOES THROUGH THE DATA SOURCE, which is the real tRPC client
//      bound to the real database. It must not be a local-state removal.
//   3. THE LIST IS PAGED ON THE SERVER. The page must ask the server for a page
//      and must NOT filter rows in the browser, which would silently search only
//      the page that happened to be loaded.
//   4. THE LIST IS REFRESHED AFTER A DELETE, so what is on screen is what is in
//      the database - and the page the server ACTUALLY served is adopted, so
//      deleting the last row on the last page does not strand the view.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "pages", "Newsletter.tsx"), "utf8");
const dataSource = readFileSync(join(__dirname, "data-source.tsx"), "utf8");
const liveSource = readFileSync(join(__dirname, "live-source.ts"), "utf8");
const types = readFileSync(join(__dirname, "types.ts"), "utf8");

describe("Newsletter page delete wiring", () => {
  it("renders a delete control on each row with an accessible label", () => {
    expect(src).toContain("Trash2");
    expect(src).toContain("aria-label={`Delete subscriber ${s.email}`}");
  });

  it("stops the row click so deleting never triggers a row action", () => {
    expect(src).toContain("e.stopPropagation()");
  });

  it("opens a confirmation dialog that names the subscriber", () => {
    expect(src).toContain("ConfirmDialog");
    expect(src).toContain("Delete ${pendingDelete.email}?");
    // The dialog must offer the non-destructive alternative, because "stop the
    // mailings" and "erase the record" are different wishes.
    expect(src).toContain("unsubscribed instead");
  });

  it("only deletes from the dialog's confirm handler, through the data source", () => {
    expect(src).toContain("await data.deleteSubscriber(pendingDelete.id)");
    // The delete must not be reachable from the row's own click handler.
    expect(src).not.toMatch(/onClick[\s\S]{0,200}deleteSubscriber/);
    expect(src).not.toMatch(/setPendingDelete[\s\S]{0,80}deleteSubscriber/);
  });

  it("refreshes the list after a delete so the row disappears immediately", () => {
    expect(src).toContain("refetch()");
  });
});

describe("Newsletter page server-side pagination", () => {
  it("asks the SERVER for a page and a size", () => {
    expect(src).toContain("data.listSubscribers({ page, pageSize: size, search })");
  });

  it("does not filter rows in the browser", () => {
    // Browser-side filtering would search only the loaded page and present that
    // as the whole list - the exact bug server paging is here to remove.
    expect(src).not.toContain("filterRows");
  });

  it("renders the shared pager with the total", () => {
    expect(src).toContain("Pagination");
    expect(src).toContain("total={total}");
  });

  it("renders exactly ONE pagination control", () => {
    // The list is paged on the server, so the table's OWN pager must be off and
    // the page must render a single shared `Pagination` from the server total.
    // Two controls on one screen is the bug this pins.
    expect(src.match(/<Pagination\b/g) ?? []).toHaveLength(1);
    expect(src).toContain("pagination={false}");
  });

  it("adopts the page the server actually served", () => {
    // Deleting the last row on the last page leaves the requested page empty;
    // the server answers with the previous page and this is what adopts it.
    expect(src).toContain("result.page !== page");
    expect(src).toContain("setPage(result.page)");
  });

  it("resets to the first page when the search or page size changes", () => {
    expect(src).toMatch(/setSearch\(query\.trim\(\)\);\s*\n\s*setPage\(1\)/);
    expect(src).toMatch(/setSize\(n\);[\s\S]{0,40}setPage\(1\)/);
  });
});

describe("newsletter data-source contract", () => {
  it("pages the list through the real server call", () => {
    expect(liveSource).toContain("caller.admin.newsletter.query(params)");
    expect(liveSource).toContain("caller.admin.deleteSubscriber.mutate({ id })");
  });

  it("types the paged result and the delete on the interface", () => {
    expect(types).toContain("listSubscribers(params?: AdminPageParams): Promise<AdminSubscriberPage>");
    expect(types).toContain("deleteSubscriber(id: string): Promise<void>");
  });

  it("keeps exactly one data source - the real one", () => {
    // No demo/mock source may be reintroduced; the panel reads the production
    // database.
    expect(dataSource).toContain("createLiveSource");
    expect(dataSource).not.toContain("demo-source");
  });
});
