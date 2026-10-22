// Source-level wiring checks for the return-from-payment fix on /checkout.
//
// vitest runs in a node environment here (no jsdom), so the page cannot be
// mounted. These read Checkout.tsx as text and pin the contract that matters,
// the way admin/orders-page.test.ts does for the Orders page:
//
//   * the empty cart is NO LONGER a dead end when an order was just placed;
//   * the order reference is written BEFORE the browser leaves for the
//     payment provider (otherwise the return trip has nothing to recover);
//   * the redirect uses `replace`, so the back button does not bounce;
//   * a genuinely empty cart with no remembered order keeps the normal message.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The source is read as TEXT and searched for "\n"-delimited anchors, so the
// line endings are normalised to LF first. A checkout that rewrote them to CRLF
// (Git's `core.autocrlf=true` on Windows, before .gitattributes pinned them)
// failed these checks for a reason that had nothing to do with the behaviour
// they guard.
const src = readFileSync(join(__dirname, "Checkout.tsx"), "utf8").replace(/\r\n/g, "\n");

/** The body of the `lines.length === 0` branch, up to the main render. */
function emptyCartBranch(): string {
  const start = src.indexOf("if (lines.length === 0 && !placeOrder.isPending)");
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf("return (\n    <Section className=\"!pt-8\">\n      <Breadcrumbs\n        trail={[", start) + 1);
}

describe("Checkout - returning from the payment provider", () => {
  it("remembers the order BEFORE the redirect to the provider", () => {
    // The pointer must exist before `clear()` and before `window.location.href`
    // is set, or a shopper who never reaches the order page has nothing to
    // recover on the way back.
    const onSuccess = src.slice(
      src.indexOf("onSuccess: (result) =>"),
      src.indexOf("onError: (err) =>"),
    );
    const remembered = onSuccess.indexOf("rememberLastOrder(result.orderNumber, email)");
    const cleared = onSuccess.indexOf("clear();");
    const redirected = onSuccess.indexOf("window.location.href = result.redirectUrl");
    expect(remembered).toBeGreaterThan(-1);
    expect(cleared).toBeGreaterThan(-1);
    expect(redirected).toBeGreaterThan(-1);
    expect(remembered).toBeLessThan(cleared);
    expect(remembered).toBeLessThan(redirected);
  });

  it("still clears the cart once the order exists", () => {
    // Clearing is correct - the items belong to the order now. The fix is the
    // recovery pointer, NOT keeping a stale cart around.
    expect(src).toContain("clear();");
  });

  it("reads the remembered order on mount", () => {
    expect(src).toContain("readLastOrder()");
    expect(src).toMatch(/const \[recentOrder, setRecentOrder\] = useState<LastOrder \| null>\(null\)/);
  });

  it("redirects to the ORDER STATUS page when the cart is empty but an order was placed", () => {
    // This is the bug fix: empty cart + remembered order must reach
    // /order/:orderNumber instead of dead-ending on the checkout page.
    expect(src).toContain("navigate(lastOrderPath(recentOrder.orderNumber), { replace: true })");
  });

  it("uses `replace` so the back button does not bounce between the two pages", () => {
    // A push would leave /checkout in history, and going back would redirect
    // forward again - an unescapable loop for the shopper.
    //
    // The slice ends at the REDIRECT STATEMENT's own terminator rather than at a
    // dependency-array shape. It used to anchor on `}, [cartLoading`, which other
    // effects in this file now also open with - the anchor then landed BEFORE the
    // navigate call and the slice came back empty, failing a test for a reason
    // that had nothing to do with the behaviour it guards.
    const start = src.indexOf("navigate(lastOrderPath(");
    const redirect = src.slice(start, src.indexOf("]);", start));
    expect(redirect).toContain("{ replace: true }");
  });

  it("only redirects when there is nothing to check out - never mid-checkout", () => {
    // The effect sits just after the place-order mutation it reads from.
    const effect = src.slice(
      src.indexOf("// Take the returning shopper to their order"),
      src.indexOf("const submit = (e: React.FormEvent)"),
    );
    expect(effect).toContain("if (cartLoading || placeOrder.isPending) return;");
    expect(effect).toContain("if (lines.length > 0) return;");
    expect(effect).toContain("if (!recentOrder) return;");
  });

  it("shows a recovery state (with the order number) rather than 'nothing to check out'", () => {
    const branch = emptyCartBranch();
    expect(branch).toContain("if (recentOrder)");
    expect(branch).toContain("Taking you back to your order");
    expect(branch).toContain("recentOrder.orderNumber");
    // The link to the order page is present even if the redirect is blocked.
    expect(branch).toContain("lastOrderPath(recentOrder.orderNumber)");
  });

  it("keeps the normal empty-cart message for a genuinely empty cart with no order", () => {
    const branch = emptyCartBranch();
    // The original copy survives as the fallback, unchanged.
    expect(branch).toContain("There's nothing to check out");
    expect(branch).toContain(
      "Your cart is empty, so there's no order to place yet. Add a few items and come back.",
    );
    // The fallback is reached only when there is no remembered order.
    const recovery = branch.indexOf("if (recentOrder)");
    const fallback = branch.indexOf("There's nothing to check out");
    expect(recovery).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(recovery);
  });
});
