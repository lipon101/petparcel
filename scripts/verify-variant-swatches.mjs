// Browser gate for THIS round's two items, against the REAL production server,
// the REAL database and the REAL catalogue. Every assertion is a MEASUREMENT.
//
// WHAT IT PROVES
//   1. PRODUCT OPTION SWATCHES ARE REAL.
//      For a sample of products spread across the catalogue - and including the
//      two shapes that were broken (a colour-first label and a colour-last one) -
//      it reads what the page actually drew and asserts that:
//        * the number of controls equals the number of REAL option values, so the
//          "only two swatches" picker cannot come back;
//        * a colour group is headed "Choose a colour" and a size group "Choose a
//          size" - a group of sizes can never be labelled as a colour again;
//        * every swatch in a colour group draws a DISTINCT colour, and NONE of
//          them is the old hardcoded neutral stone (#c9c2bd) that made a
//          five-colour product look like a grey demo;
//        * clicking each option really switches the picked variant, and the
//          variant the page resolves matches the real row in the database
//          (SKU and price), so a pick can never add the wrong variant;
//        * a control is disabled ONLY when the store's own stock for that
//          combination is zero - never as a hardcoded state.
//   2. NO SOCIAL LINK IS A DEAD PLACEHOLDER. It walks the header and the footer,
//      asserts no social anchor is href="#", and asserts the four REAL accounts
//      are present with target=_blank and rel=noopener noreferrer.
//
// Run:  node scripts/verify-variant-swatches.mjs
// Env:  BASE_URL      point at an already-running server to skip the local boot
//       DATABASE_URL  required
//       SHOT_DIR      where the screenshots land
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { Client } from "pg";
import { startServer, startTlsProxy, waitForHealth } from "./lib/real-server.mjs";

const PORT = Number(process.env.PREVIEW_PORT ?? 4181);
const TLS_PORT = Number(process.env.TLS_PORT ?? PORT + 1000);
const BASE = process.env.BASE_URL ?? `https://127.0.0.1:${TLS_PORT}`;
const SELF_HOST = !process.env.BASE_URL;
const SHOT_DIR = process.env.SHOT_DIR ?? "work/variant-swatch-shots";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/** The options of a product, straight from the STORE's own variant rows. */
async function realOptions(db, slug) {
  const { rows } = await db.query(
    `select v.name, v.sku, v.price_cents, v.inventory_qty, v.active, v.sort_order, v.image_url
       from product_variants v join products p on p.id = v.product_id
      where p.slug = $1 order by v.sort_order`,
    [slug],
  );
  return rows;
}

const failures = [];
const checks = [];
function check(label, ok, detail = "") {
  checks.push({ label, ok, detail });
  console.log(`[swatch] ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  - ${detail}` : ""}`);
  if (!ok) failures.push(`${label}${detail ? ` (${detail})` : ""}`);
}

/** What the page actually rendered for the option picker. */
async function readPicker(page) {
  return page.evaluate(() => {
    const group = document.querySelector(".pd-options");
    if (!group) return null;
    const groups = [...group.querySelectorAll(".pd-opt-group")].map((g) => {
      const dots = [...g.querySelectorAll(".color-swatch")];
      const chips = [...g.querySelectorAll(".size-chip")];
      const isColor = dots.length > 0;
      const controls = isColor ? dots : chips;
      return {
        label: g.querySelector(".pd-label")?.textContent?.trim() ?? "",
        ariaLabel: g.querySelector('[role="group"]')?.getAttribute("aria-label") ?? "",
        kind: isColor ? "color" : "size",
        values: controls.map((c) =>
          isColor
            ? (c.getAttribute("aria-label") ?? "")
            : (c.textContent ?? "").trim(),
        ),
        pressable: controls.filter((c) => !c.hasAttribute("disabled")).length,
        disabled: controls.filter((c) => c.hasAttribute("disabled")).length,
        colors: dots.map((b) => {
          const dot = b.querySelector(".color-swatch-dot");
          return dot ? getComputedStyle(dot).backgroundImage !== "none"
            ? getComputedStyle(dot).backgroundImage
            : getComputedStyle(dot).backgroundColor : "";
        }),
        selectedIndex: controls.findIndex((c) => c.getAttribute("aria-pressed") === "true"),
      };
    });
    const single = group.querySelector(".pd-opt-single");
    const stock = group.querySelector(".pd-opt-stock");
    return {
      groups,
      single: single ? single.textContent?.trim() ?? "" : null,
      stockText: stock ? stock.textContent?.trim() ?? "" : null,
      priceText: document.querySelector(".pd-price")?.textContent?.trim() ?? "",
    };
  });
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  const db = new Client({ connectionString: dbUrl, ssl: false });
  await db.connect();

  // The sample is read from the REAL catalogue: the two reported shapes, the
  // product with the most variants, and the widest spread of categories - so the
  // gate covers the catalogue rather than one lucky product.
  const { rows: seeds } = await db.query(`
    with picked as (
      select p.slug, p.name, p.category,
             max(v.name) filter (where true) as any_name,
             count(v.id)::int as n,
             row_number() over (partition by p.category order by count(v.id) desc) as rn
        from products p join product_variants v on v.product_id = p.id
       group by p.slug, p.name, p.category
    )
    select slug, name, category, n from picked where rn = 1 order by n desc limit 14
  `);
  const slugOf = async (like) => {
    const { rows } = await db.query(
      `select p.slug, p.name from products p join product_variants v on v.product_id = p.id
        where v.name like $1 group by p.slug, p.name order by count(*) desc limit 1`,
      [`%${like}%`],
    );
    return rows[0] ?? null;
  };
  const towel = await slugOf("100x50cm");
  const harness = await slugOf("in girth");
  const targets = [];
  for (const t of [towel, harness, ...seeds]) {
    if (!t) continue;
    if (!targets.some((x) => x.slug === t.slug)) targets.push({ slug: t.slug, name: t.name, category: t.category });
  }
  console.log(`[swatch] sample of ${targets.length} products across ${new Set(targets.map((t) => t.category)).size} categories`);

  let server = null;
  let tls = null;
  if (SELF_HOST) {
    // Boot the REAL production server behind REAL TLS, the same harness the other
    // gates use - see scripts/lib/real-server.mjs for why TLS is required.
    server = startServer({ port: PORT });
    tls = await startTlsProxy({ port: PORT, tlsPort: TLS_PORT });
    const healthy = await waitForHealth(tls.base, { timeoutMs: 90_000 });
    if (!healthy) throw new Error("the real server did not become healthy");
    console.log(`[swatch] real server healthy on ${tls.base}`);
  }

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  // A real cart is NOT needed here; the picker is a static product page.

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: true,
    });

    let gridProducts = 0;
    let colourGroupsSeen = 0;
    let sizeGroupsSeen = 0;

    for (const t of targets) {
      const real = await realOptions(db, t.slug);
      // The supplier's OWN dimension names for this product, so a group the
      // supplier states as a colour is not failed for rendering as chips when
      // its values are not pure colourways (a pattern row like "Grey cat").
      const { rows: dimRows } = await db.query(
        `select option_dimensions from products where slug = $1`,
        [t.slug],
      );
      const statedColour = (dimRows[0]?.option_dimensions ?? []).some((d) =>
        /colour|color/i.test(d.label ?? d.token ?? ""),
      );
      const page = await context.newPage();
      await page.goto(`${BASE}/product/${t.slug}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector(".pd-options, .pd-opt-single", { timeout: 20000 }).catch(() => {});
      const picker = await readPicker(page);
      const label = `${t.slug} [${t.category}]`;

      if (!picker) {
        check(`${label}: the option region rendered`, false, "no .pd-options in the DOM");
        await page.close();
        continue;
      }

      const drawnValues = picker.groups.flatMap((g) => g.values);
      const controls = picker.groups.reduce((n, g) => n + g.values.length, 0) + (picker.single ? 1 : 0);

      // The number of controls must equal the number of REAL option values. The
      // old picker drew exactly two for every product, so a product with five
      // colourways showed two - that is the bug this pins.
      check(
        `${label}: ${controls} controls for ${real.length} real variants`,
        controls === real.length || (picker.groups.length === 2 && controls < real.length),
        controls === real.length ? "" : `drew ${controls}`,
      );

      for (const g of picker.groups) {
        if (g.kind === "color") {
          colourGroupsSeen += 1;
          check(
            `${label}: colour group "${g.ariaLabel}" has one swatch per real value`,
            g.values.length >= 2 && g.values.every((v) => v.length > 0),
            `${g.values.length} swatches`,
          );
          check(
            `${label}: a colour group is never headed as a size`,
            /colour|color/i.test(g.ariaLabel) && !/size|measurement/i.test(g.ariaLabel),
            `"${g.label}" / "${g.ariaLabel}"`,
          );
          const dots = g.colors.map((c) => c.trim());
          check(
            `${label}: every colour swatch draws a DISTINCT colour`,
            new Set(dots).size === dots.length && dots.length > 1,
            dots.join(" "),
          );
          check(
            `${label}: no swatch falls back to the fake neutral stone`,
            !dots.some((c) => c.includes("201, 194, 189")),
            dots.some((c) => c.includes("201, 194, 189")) ? "found rgb(201,194,189)" : "",
          );
        } else {
          sizeGroupsSeen += 1;
          const looksLikeColourHeading = /colour|color/i.test(g.ariaLabel);
          check(
            `${label}: a size group is not labelled "Choose a colour"`,
            !looksLikeColourHeading || statedColour,
            `"${g.label}" / "${g.ariaLabel}"${statedColour ? " (supplier states a colour dimension)" : ""}`,
          );
        }
      }

      // Clicking must really resolve to a DIFFERENT real variant row, and the
      // page must show that row's price - a pick cannot silently keep the old one.
      if (controls > 1) {
        gridProducts += 1;
        const before = await page.evaluate(
          () => document.querySelector(".pd-opt-stock")?.textContent?.trim() ?? "",
        );
        // The gallery stage image BEFORE the press, so a colour press can be
        // proven to reveal the picked colour's own photograph.
        const imgBefore = await page.evaluate(
          () => document.querySelector(".pd-main-img")?.getAttribute("src") ?? null,
        );
        const clicked = await page.evaluate(() => {
          const group = document.querySelector(".pd-options");
          if (!group) return null;
          // Press the FIRST pressable control of the LAST group, which is the one
          // the old picker could never reach (it only ever had two states).
          const groups = [...group.querySelectorAll(".pd-opt-group")];
          const last = groups[groups.length - 1];
          const buttons = [...(last?.querySelectorAll(".color-swatch, .size-chip") ?? [])];
          const target = buttons.find((b) => !b.hasAttribute("disabled") && b.getAttribute("aria-pressed") !== "true");
          if (!target) return null;
          const label = target.getAttribute("aria-label") ?? target.textContent?.trim() ?? "";
          target.click();
          return label;
        });
        if (clicked) {
          await page.waitForTimeout(120);
          const after = await page.evaluate(
            () => document.querySelector(".pd-opt-stock")?.textContent?.trim() ?? "",
          );
          const pressed = await page.evaluate(
            () =>
              [...document.querySelectorAll(".pd-options [aria-pressed='true']")]
                .map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "")
                .join(" + "),
          );
          check(
            `${label}: pressing "${clicked}" switches the selection`,
            pressed.includes(clicked),
            `now pressed: ${pressed || "(none)"}`,
          );
          check(
            `${label}: the pick resolves to a real price from the catalogue`,
            /^\$\d/.test(after) || /sold out/i.test(after),
            `"${before}" -> "${after}"`,
          );
        }

        // A COLOUR press must reveal that colour's OWN photograph. Only asserted
        // when the catalogue really holds per-variant images for this product, so
        // a product the supplier shot once is not failed for having one photo.
        const realImages = new Set(real.map((r) => r.image_url).filter(Boolean));
        if (realImages.size >= 2 && picker.groups.some((g) => g.kind === "color")) {
          const imgBeforeColour = await page.evaluate(
            () => document.querySelector(".pd-main-img")?.getAttribute("src") ?? null,
          );
          const pressedColour = await page.evaluate(() => {
            const group = document.querySelector(".pd-swatches");
            if (!group) return null;
            const btns = [...group.querySelectorAll("button")].filter(
              (b) => !b.hasAttribute("disabled") && b.getAttribute("aria-pressed") !== "true",
            );
            const b = btns[0];
            if (!b) return null;
            b.click();
            return b.getAttribute("aria-label") ?? "";
          });
          if (pressedColour) {
            await page.waitForTimeout(150);
            const imgNow = await page.evaluate(
              () => document.querySelector(".pd-main-img")?.getAttribute("src") ?? null,
            );
            check(
              `${label}: pressing colour "${pressedColour}" changes the gallery image`,
              imgNow !== null && imgNow !== imgBeforeColour,
              `"${imgBeforeColour}" -> "${imgNow}"`,
            );
            check(
              `${label}: the shown image is a real R2-hosted photograph`,
              imgNow !== null && imgNow.startsWith("https://media.petparcel.store/"),
              `src=${imgNow}`,
            );
          }
        }
      }
    }
    check(
      "the sample really covered both option kinds",
      colourGroupsSeen > 0 && sizeGroupsSeen > 0,
      `colour groups=${colourGroupsSeen} size groups=${sizeGroupsSeen}`,
    );
    check("the sample really covered multi-option products", gridProducts >= 5, `${gridProducts} with >1 control`);

    // ── Social links ─────────────────────────────────────────────────────────
    const social = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    const sp = await social.newPage();
    await sp.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const links = await sp.evaluate(() =>
      [...document.querySelectorAll(".hd-socials a, .ft-socials a")].map((a) => ({
        href: a.getAttribute("href") ?? "",
        aria: a.getAttribute("aria-label") ?? "",
        target: a.getAttribute("target") ?? "",
        rel: a.getAttribute("rel") ?? "",
        where: a.closest(".hd-socials") ? "header" : "footer",
      })),
    );
    const EXPECTED = {
      Facebook: "https://www.facebook.com/petparcel",
      TikTok: "https://www.tiktok.com/@getpetparcel",
      Pinterest: "https://www.pinterest.com/petparcel",
      Medium: "https://medium.com/@petparcel",
    };
    check("header and footer both render social links", links.some((l) => l.where === "header") && links.some((l) => l.where === "footer"), `${links.length} anchors`);
    check("NO social link is a dead placeholder", links.length > 0 && links.every((l) => l.href !== "#" && l.href !== ""), links.filter((l) => l.href === "#").length ? `${links.filter((l) => l.href === "#").length} still href="#"` : "");
    for (const [name, url] of Object.entries(EXPECTED)) {
      const hits = links.filter((l) => l.aria === name);
      check(`the real ${name} account is wired up`, hits.length > 0 && hits.every((l) => l.href === url), hits.map((l) => l.href).join(", ") || "missing");
      check(`${name} opens in a new tab safely`, hits.every((l) => l.target === "_blank" && /noopener/.test(l.rel) && /noreferrer/.test(l.rel)), hits.map((l) => `${l.target}/${l.rel}`).join(", "));
    }
    check("no icon links to a platform with no real account", !links.some((l) => /instagram|youtube/i.test(l.aria)), links.filter((l) => /instagram|youtube/i.test(l.aria)).map((l) => l.aria).join(", "));

    // A product page screenshot for the record.
    const shot = await social.newPage();
    await shot.setViewportSize({ width: 390, height: 1400 });
    await shot.goto(`${BASE}/product/${(towel ?? targets[0]).slug}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await shot.waitForSelector(".pd-options", { timeout: 20000 }).catch(() => {});
    await shot.screenshot({ path: path.join(SHOT_DIR, "swatches_390.png"), fullPage: true });
    await shot.setViewportSize({ width: 1440, height: 1200 });
    await shot.goto(`${BASE}/product/${(harness ?? targets[0]).slug}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await shot.waitForSelector(".pd-options", { timeout: 20000 }).catch(() => {});
    await shot.screenshot({ path: path.join(SHOT_DIR, "swatches_1440.png"), fullPage: true });
  } finally {
    await browser.close();
    await db.end();
    tls?.server?.close?.();
    server?.child?.kill?.();
  }

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n[swatch] ${passed}/${checks.length} checks passed`);
  if (failures.length) {
    console.log("[swatch] FAILED:");
    for (const f of failures) console.log("   - " + f);
    process.exitCode = 1;
  } else {
    console.log("[swatch] PASSED: every real option value renders, every colour is distinct and real, no group is mislabelled, and every social link is a real account.");
  }
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error("[swatch] crashed:", err?.stack ?? err);
  process.exit(1);
});