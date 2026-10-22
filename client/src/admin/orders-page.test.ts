// Source-level wiring checks for the Orders page delete flow.
//
// vitest runs in a node environment here (no jsdom), so the component cannot be
// mounted. These read the .tsx as text and pin the contract that matters: every
// row carries a delete control, it opens a confirmation dialog that NAMES the
// order, the dialog is what actually calls the delete mutation, and the row's
// own click (which opens the order) is not triggered by the delete button.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "pages", "Orders.tsx"), "utf8");

describe("Orders page delete wiring", () => {
  it("renders a delete control on each row with an accessible label", () => {
    expect(src).toContain("Trash2");
    expect(src).toContain("aria-label={`Delete order ${o.orderNumber}`}");
  });

  it("stops the row click so deleting never opens the order", () => {
    expect(src).toContain("e.stopPropagation()");
  });

  it("opens a confirmation dialog that names the order and its email", () => {
    expect(src).toContain("ConfirmDialog");
    expect(src).toContain("Delete order ${pendingDelete.orderNumber}?");
    expect(src).toContain("pendingDelete.email");
  });

  it("only deletes from the dialog's confirm handler, through the data source", () => {
    expect(src).toContain("await data.deleteOrder(pendingDelete.id)");
    // The delete must not be reachable from the row's own click handler.
    expect(src).not.toMatch(/onRowClick[\s\S]{0,80}deleteOrder/);
  });

  it("refreshes the list after a delete so the row disappears immediately", () => {
    expect(src).toContain("refetch()");
  });
});
