// Guards the single "is this the live storefront?" decision.
//
// WHY THIS SUITE EXISTS. The production host is what decides whether the
// analytics tags initialize, whether a page may be indexed, and which origin a
// canonical URL names. Every one of those is a SILENT failure when it is wrong:
// a preview host that still loads the tag looks healthy, and a production host
// that is wrongly treated as a preview simply stops being measured. So the
// predicate is pinned here rather than left to each call site.
import { describe, expect, it } from "vitest";
import { PRODUCTION_HOSTS, PRODUCTION_ORIGIN, isProductionHost } from "./production-host";

describe("isProductionHost", () => {
  it("accepts the canonical www host and the apex", () => {
    expect(isProductionHost("www.petparcel.store")).toBe(true);
    expect(isProductionHost("petparcel.store")).toBe(true);
  });

  it("is case-insensitive and tolerates a port", () => {
    expect(isProductionHost("WWW.PetParcel.Store")).toBe(true);
    expect(isProductionHost("www.petparcel.store:443")).toBe(true);
  });

  it("accepts a full URL and keeps only the hostname", () => {
    expect(isProductionHost("https://www.petparcel.store/shop?category=Dogs")).toBe(true);
    expect(isProductionHost("http://petparcel.store/")).toBe(true);
  });

  it("rejects Vercel preview and deployment hosts", () => {
    // The exact class of host that was being indexed and recorded by Clarity.
    expect(isProductionHost("petparcel-bpwf726dl-lipon.vercel.app")).toBe(false);
    expect(isProductionHost("petparcel-git-main-lipon.vercel.app")).toBe(false);
    expect(isProductionHost("petparcel.vercel.app")).toBe(false);
  });

  it("rejects localhost, IPs and empty values", () => {
    expect(isProductionHost("localhost")).toBe(false);
    expect(isProductionHost("localhost:3000")).toBe(false);
    expect(isProductionHost("127.0.0.1")).toBe(false);
    expect(isProductionHost("")).toBe(false);
    expect(isProductionHost(null)).toBe(false);
    expect(isProductionHost(undefined)).toBe(false);
  });

  it("does not treat a look-alike host as production", () => {
    // A suffix match would wrongly accept these; an exact match does not.
    expect(isProductionHost("www.petparcel.store.evil.com")).toBe(false);
    expect(isProductionHost("notpetparcel.store")).toBe(false);
    expect(isProductionHost("www.petparcel.store.vercel.app")).toBe(false);
  });

  it("exposes the canonical origin and the host list", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://www.petparcel.store");
    expect(PRODUCTION_HOSTS).toContain("www.petparcel.store");
  });
});
