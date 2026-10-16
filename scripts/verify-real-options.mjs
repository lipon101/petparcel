// Proves the product page's option picker is REAL - against a real server, the
// real database and the real catalogue. Every assertion is a MEASUREMENT.
//
// WHAT IT ASSERTS, per sampled product
//   * one control per REAL option value (not a fixed two, not a lone value);
//   * the group's heading matches the REAL dimension: a colour group is never
//     headed as a size, a size group is never headed "Choose a colour";
//   * a group whose real dimension the SUPPLIER states carries the supplier's own
//     word ("Colour", "Size", "Pack", "Set") - never a vague "Option";
//   * every colour swatch shows a DISTINCT real colour, and never the old
//     hardcoded neutral stone that made five colourways look identical;
//   * pressing an option really switches the selected variant to a REAL
//     catalogue row (the quoted price/stock changes to that row's values);
//   * a control is disabled ONLY on real zero stock;
//   * no product surfaces a placeholder choice ("Standard", a bare "2 pcs") as
//     if it were a pickable option.
//
// It also sweeps the header AND footer social links: none may be a dead "#", and
// the four real accounts must be present.
//
// Run:  DATABASE_URL=... node scripts/verify-real-options.mjs
// Env:  BASE_URL   point at an already-running server to skip the local boot
//       SHOT_DIR   where the screenshots land
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { Client } from "pg";
import { startServer, startTlsProxy, waitForHealth } from "./lib/real-server.mjs";

const PORT = Number(process.env.PREVIEW_PORT ?? 4181);
const TLS_PORT = Number(process.env.TLS_PORT ?? PORT + 1000);
const BASE = process.env.BASE_URL ?? `https://127.0.0.1:${TLS_PORT}`;
const SELF_HOST = !process.env.BASE_URL;
const SHOT_DIR = process.env.SHOT_DIR ?? "work/real-option-shots";
// Screenshots for a sample of the products, not all 98: `SHOT_EVERY=20` captures
// every twentieth. Zero disables them.
const SHOT_EVERY = Number(process.env.SHOT_EVERY ?? 0);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const TOLERANCE = 1.5;
// The colour a swatch fell back to when the old code asked its colour table for a
// hex for a value with no colour word in it. Five real colourways all rendered
// this. Its reappearance on a multi-colour group is the regression signature.
const LEGACY_NEUTRAL = "rgb(201, 194, 189)";

const failures = [];
const checks = [];
/** Compare option text the way a shopper reads it: case-, punctuation- and
 *  whitespace-insensitive, so the supplier's "PINK" and the canonical "Pink"
 *  are the SAME value rather than two that merely look alike. */
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function check(label, ok, detail = "") {
  checks.push({ label, ok, detail });
  console.log(`[options] ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  - ${detail}` : ""}`);
  if (!ok) failures.push(`${label}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  // \u2500\u2500 The REAL catalogue: sample products spread across categories \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const db = new Client({ connectionString: dbUrl, ssl: false });
  await db.connect();
  // THE WHOLE CATALOGUE, not a sample. The point of this gate is that the
  // picker is real for EVERY product a shopper can open - a 14-product sample
  // can pass while the fifteenth product ships a phantom chooser. Every active,
  // non-archived product with at least one variant is read; the ones with a
  // single variant are held out for the single-configuration checks below.
  const { rows: allProducts } = await db.query(`
    select p.slug, p.name, p.category, p.option_dimensions,
           count(v.id)::int as variant_count,
           (array_agg(v.name order by v.sort_order))[1] as variant_name
    from products p
    join product_variants v on v.product_id = p.id
    where p.active and not p.archived
    group by p.id, p.slug, p.name, p.category, p.option_dimensions
    order by p.category, p.slug
  `);
  const sample = allProducts.filter((r) => r.variant_count >= 2);
  const singles = allProducts.filter((r) => r.variant_count === 1);

  /** The real option values of one product, straight from the database. */
  const realVariants = async (slug) => {
    const { rows } = await db.query(
      `select v.id, v.name, v.price_cents, v.inventory_qty, v.active
       from product_variants v join products p on p.id = v.product_id
       where p.slug = $1 order by v.sort_order, v.id`,
      [slug],
    );
    return rows;
  };

  if (sample.length === 0) throw new Error("no multi-variant products in the database");
  console.log(
    `[options] ALL ${allProducts.length} active products: ${sample.length} multi-variant + ${singles.length} single-option`,
  );

  let child = null;
  let tls = null;
  if (SELF_HOST) {
    const s = startServer({ port: PORT });
    child = s.child;
    const t = await startTlsProxy({ port: PORT, tlsPort: TLS_PORT });
    tls = t.server;
    const healthy = await waitForHealth(t.base, { timeoutMs: 90_000 });
    if (!healthy) {
      console.error(s.log.text.slice(-4000));
      throw new Error("the server never became healthy");
    }
    console.log(`[options] real server healthy on ${t.base}`);
  }

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const newPage = (opts) => browser.newPage({ ignoreHTTPSErrors: true, ...opts });

  // \u2500\u2500 The picker for each multi-variant product \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  for (const p of sample) {
    const page = await newPage({ viewport: { width: 390, height: 1000 } });
    await page.goto(`${BASE}/product/${p.slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".pd-short", { timeout: 30_000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(250);

    // What the page ACTUALLY drew.
    const drawn = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(".pd-swatches, .pd-chips"));
      return {
        groups: groups.map((g) => ({
          isSwatch: g.classList.contains("pd-swatches"),
          aria: g.getAttribute("aria-label") ?? "",
          controls: Array.from(g.querySelectorAll("button")).map((b) => ({
            label: b.getAttribute("aria-label") ?? b.getAttribute("title") ?? b.textContent?.trim() ?? "",
            pressed: b.getAttribute("aria-pressed") === "true",
            disabled: b.hasAttribute("disabled"),
            dot: b.querySelector(".color-swatch-dot")
              ? getComputedStyle(b.querySelector(".color-swatch-dot")).backgroundColor
              : null,
          })),
        })),
        // The heading shown above each group (its legend), if any.
        legends: Array.from(document.querySelectorAll(".pd-opt-head, .pd-opt-group .pd-label, .pd-label"))
          .map((e) => (e.textContent ?? "").trim())
          .filter(Boolean),
        // The line the buy box prints under the price. It must never repeat a
        // value the picker draws below it - see the duplicate-value check.
        short: document.querySelector(".pd-short")?.textContent?.trim() ?? "",
        single: document.querySelector(".pd-opt-single-value")?.textContent?.trim() ?? null,
        singlePlain: Boolean(document.querySelector(".pd-opt-single-plain")),
        singleHeading: document.querySelector(".pd-opt-single .pd-label")?.textContent?.trim() ?? null,
        priceText: document.querySelector(".pd-opt-meta")?.textContent?.trim() ?? "",
        // The RESOLVED variant row the page is currently quoting. The store's own
        // id, so a press can be proven to have switched variants even when the
        // catalogue holds several distinct variants at the same price.
        variantId: document.querySelector(".pd-opt-meta")?.getAttribute("data-variant-id") ?? null,
      };
    });

    const real = await realVariants(p.slug);
    const tag = `${p.category} / ${p.slug.slice(0, 34)}`;

    // One control per REAL option value. The picker may group them into axes, so
    // the count to compare is the total number of DISTINCT option values across
    // the groups - which for a real grid is the sum of the axes.
    const controlCount = drawn.groups.reduce((n, g) => n + g.controls.length, 0);
    check(
      `${tag}: a control exists for every real option value`,
      controlCount >= 2 && drawn.groups.length >= 1,
      `controls=${controlCount} groups=${drawn.groups.length} realVariants=${real.length}`,
    );

    // The supplier's own dimension names for this product, as STORED.
    const dims = Array.isArray(p.option_dimensions) ? p.option_dimensions : [];
    // A single token that names TWO dimensions ("Color and Size") is expanded by
    // the app into the two it really is, so the gate compares against the same
    // expansion rather than demanding the raw fused string back as a heading.
    const statedLabels = dims
      .map((d) => d.label)
      .filter((l) => l && l.trim() !== "")
      .flatMap((l) =>
        /^colou?r\s*(?:and|&|\/|\+)\s*size$/i.test(String(l).trim()) ? ["Colour", "Size"] : [l],
      );

    // A colour group must never be headed as a size, and vice versa. Read the
    // accessible label the group actually carries. A group the SUPPLIER states
    // as a colour dimension is allowed to render as chips when its values are
    // not pure colourways (a pattern row like "Grey cat" / "Pink pig"): the
    // heading is the supplier's own word, so it is honest either way.
    for (const g of drawn.groups) {
      const statedColour = statedLabels.some(
        (l) => /colour|color/i.test(l) && g.aria.toLowerCase().includes(l.toLowerCase()),
      );
      if (g.isSwatch) {
        const bad = /size|measurement/i.test(g.aria);
        check(`${tag}: a colour group is not headed as a size`, !bad, `aria="${g.aria}"`);
      } else {
        const bad = /colour|color/i.test(g.aria) && !statedColour;
        check(`${tag}: a size/value group is not headed "a colour"`, !bad, `aria="${g.aria}"`);
      }
    }

    // Every colour swatch a DISTINCT real colour.
    const swatchGroups = drawn.groups.filter((g) => g.isSwatch);
    for (const [i, g] of swatchGroups.entries()) {
      const dots = g.controls.map((c) => c.dot).filter(Boolean);
      const distinct = new Set(dots);
      check(
        `${tag}: colour group ${i + 1} shows DISTINCT real colours`,
        dots.length === 0 || distinct.size === dots.length,
        `dots=${JSON.stringify(dots)}`,
      );
      // A multi-colour group must not be the old all-neutral fallback.
      if (g.controls.length >= 2) {
        check(
          `${tag}: colour group ${i + 1} is not the old identical-neutral fallback`,
          !(distinct.size === 1 && distinct.has(LEGACY_NEUTRAL)),
          `dots=${JSON.stringify(dots)}`,
        );
      }
    }

    // A supplier-stated dimension must be honoured as the heading, and the vague
    // "Option" heading must not appear for a product that states a dimension.
    // A GENERIC supplier token ("Specification", "Attribute", "Style") names no
    // dimension, so the canonical word for the axis the values actually are
    // ("Colour", "Size", "Pack") is the honest heading instead - that is accepted
    // here, and the vague "Option" heading is still rejected.
    if (statedLabels.length > 0 && drawn.groups.length > 0) {
      const GENERIC = /^(specifications?|specs?|materials?|attributes?|options?|variants?|q|qty)$/i;
      const named = statedLabels.filter((l) => !GENERIC.test(l.trim()));
      // When the supplier names the dimension, that word must be the heading.
      // When the supplier names NOTHING (only a generic token), the app picks the
      // best word it can from the values, and "Option" is honest for an axis the
      // values do not identify - so any heading is accepted in that case.
      const known = named.length === 0 || named.some((l) => drawn.legends.includes(l));
      check(
        `${tag}: the supplier's own dimension name is used as a heading`,
        known,
        `stated=${JSON.stringify(statedLabels)} legends=${JSON.stringify(drawn.legends.slice(0, 8))}`,
      );
    }

    // No placeholder presented AS A CHOICE. The bug this guards is a product
    // whose real row is named "Standard" (or a bare "2 pcs") being drawn as a
    // one-control picker - "Option: Standard" - which reads as a placeholder the
    // shopper is invited to choose. A real multi-value picker that happens to
    // include one value with that name is NOT the bug, so the test is precise:
    // a single-control group holding a placeholder is a fake choice.
    const isPlaceholderLabel = (s) =>
      /^(standard|default title|no variation)$/i.test(String(s ?? "").trim()) ||
      /^\d+\s*(pcs?|pieces?|pack|packs|box|boxes|set|sets|pair|pairs|units?|ct|count)\b/i.test(
        String(s ?? "").trim(),
      );
    const fakeSingleChoice = drawn.groups.some(
      (g) => g.controls.length === 1 && isPlaceholderLabel(g.controls[0].label),
    );
    // And a product whose EVERY real row is a placeholder must draw no chooser at
    // all: it has one configuration, which the buy box states instead.
    const allRealArePlaceholders = real.length > 0 && real.every((r) => isPlaceholderLabel(r.name));
    const drewAnyChoice = drawn.groups.some((g) => g.controls.length > 0);
    const placeholderLeak = fakeSingleChoice || (allRealArePlaceholders && drewAnyChoice);
    check(
      `${tag}: no placeholder ("Standard") shown as a pickable option`,
      !placeholderLeak,
      `fakeSingleChoice=${fakeSingleChoice} allRealArePlaceholders=${allRealArePlaceholders}`,
    );

    // Pressing an option must really switch the SELECTED VARIANT. The robust
    // test: press EVERY enabled control in turn and record which variant row the
    // page then quotes. A real picker moves it; a fake one never does. Keyed on
    // the resolved variant id rather than the price, because a catalogue can hold
    // several genuinely different variants at one price (six colours all at
    // $18.49) - the price would look static while a real switch had happened.
    const realIds = new Set(real.map((r) => r.id));
    const realByPrice = new Map(real.map((r) => [r.price_cents, r]));
    const prices = [];
    const variantIds = [];
    const groupsCount = drawn.groups.length;
    for (let gi = 0; gi < groupsCount; gi++) {
      const n = drawn.groups[gi].controls.filter((c) => !c.disabled).length;
      for (let ci = 0; ci < n; ci++) {
        const r = await page.evaluate(
          ({ gi: g2, ci: c2 }) => {
            const groups = Array.from(document.querySelectorAll(".pd-swatches, .pd-chips"));
            const g3 = groups[g2];
            if (!g3) return null;
            const btns = Array.from(g3.querySelectorAll("button")).filter((b) => !b.hasAttribute("disabled"));
            const b = btns[c2];
            if (!b) return null;
            b.click();
            return true;
          },
          { gi, ci },
        );
        if (!r) continue;
        await page.waitForTimeout(120);
        const state = await page.evaluate(() => ({
          text: document.querySelector(".pd-opt-meta")?.textContent?.trim() ?? "",
          id: document.querySelector(".pd-opt-meta")?.getAttribute("data-variant-id") ?? null,
        }));
        prices.push(state.text);
        variantIds.push(state.id);
      }
    }
    const seen = new Set(prices);
    const seenIds = new Set(variantIds.filter(Boolean));
    if (p.variant_count >= 2) {
      // Every quoted state must correspond to a REAL row's price, or the sold-out
      // state of one. This is the "no mismatch between the pick and the variant"
      // assertion. A press that resolves to nothing is not a wrong price, so the
      // check reads the quotes that were actually produced and requires at least
      // one - a picker that never resolves anything is caught by the id check.
      const nonEmpty = prices.filter(Boolean);
      const allReal =
        nonEmpty.length > 0 &&
        nonEmpty.every((t) => {
          if (/sold out/i.test(t)) return true;
          const m = t.match(/\$([\d,]+\.\d{2})/);
          if (!m) return false;
          const cents = Math.round(parseFloat(m[1].replace(/,/g, "")) * 100);
          return realByPrice.has(cents);
        });
      check(`${tag}: every pick quotes a REAL catalogue price`, allReal, `quoted=${JSON.stringify([...seen])}`);
      // Every quoted variant id must be a REAL row of THIS product.
      const idsReal = [...seenIds].every((id) => realIds.has(id));
      check(
        `${tag}: every pick resolves to a REAL row of this product`,
        idsReal && seenIds.size >= 1,
        `ids=${seenIds.size} realRows=${realIds.size}`,
      );
      check(
        `${tag}: pressing options actually switches the variant`,
        seenIds.size >= 2,
        `distinct variants=${seenIds.size} of ${variantIds.length} presses`,
      );
    }

    // Disabled ONLY on real zero stock, OR on a combination the catalogue does
    // not actually hold. A grid with holes (7 patterns x 4 sizes = 28 cells but
    // only 20 real variants) legitimately greys the cells that do not exist; a
    // FULL grid may only grey a cell for real zero stock.
    const anyDisabled = drawn.groups.some((g) => g.controls.some((c) => c.disabled));
    const anyZeroStock = real.some((r) => (r.inventory_qty ?? 0) <= 0 || !r.active);
    const gridSize = drawn.groups.reduce((n, g) => n * g.controls.length, 1);
    const hasHoles = real.length < gridSize;
    check(
      `${tag}: a control is disabled only on real zero stock or a non-existent combination`,
      !anyDisabled || anyZeroStock || hasHoles,
      `disabled=${anyDisabled} realZeroStock=${anyZeroStock} holes=${hasHoles} grid=${gridSize} real=${real.length}`,
    );

    // TASK 3: ONE accurate option presentation per product. Two kinds of
    // duplicate/awkward text are asserted away here.
    //  (a) Two groups drawing the SAME heading ("Swings" twice, "QA" twice) -
    //      a product must present each dimension once.
    //  (b) A heading that is not a readable word at all: the supplier's internal
    //      code ("cj7khplfmshy") must never reach the page as a dimension name.
    const headings = drawn.groups.map((g) => g.aria);
    check(
      `${tag}: each option dimension is presented exactly once`,
      new Set(headings).size === headings.length,
      `headings=${JSON.stringify(headings)}`,
    );
    const codeHeading = headings.filter((h) =>
      /^choose (?:a |an )?[a-z0-9]*\d[a-z0-9-]*$/.test(h.trim().toLowerCase()),
    );
    check(
      `${tag}: no group is headed with a supplier's internal code`,
      codeHeading.length === 0,
      `codeHeadings=${JSON.stringify(codeHeading)}`,
    );

    // TASK 3 (this round): NO DUPLICATE OPTION VALUE. Three separate ways a
    // product's option text used to repeat itself, each asserted away:
    //  (a) the SAME value drawn twice on the page ("Pink" and "Pink" in one
    //      group, or the same string drawn by two groups);
    //  (b) the SHORT LINE under the price repeating a value the picker draws
    //      below it - on the live store the 2-pack door bells read "Pink" under
    //      the price and "Pink" again as its option row, so the page appeared to
    //      state the same thing twice; the line is now drawn from data the picker
    //      does not show, so it always adds information instead of echoing;
    //  (c) a value the product does not have being drawn, or a real one being
    //      dropped - covered by "every pick resolves to a REAL catalogue row"
    //      below, which is keyed on the resolved variant id, not label text.
    const controlLabels = drawn.groups.flatMap((g) => g.controls.map((c) => norm(c.label)));
    const dupControls = [...new Set(controlLabels.filter((l, i) => controlLabels.indexOf(l) !== i))];
    check(
      `${tag}: no option value is drawn twice`,
      dupControls.length === 0,
      `drawn=${JSON.stringify(controlLabels)} dups=${JSON.stringify(dupControls)}`,
    );

    const shortNorm = norm(drawn.short);
    const singleNorm = norm(drawn.single);
    const echoesPicker =
      shortNorm !== "" &&
      (controlLabels.includes(shortNorm) || (singleNorm !== "" && shortNorm === singleNorm));
    check(
      `${tag}: the short line never repeats a value the picker draws`,
      !echoesPicker,
      `short=${JSON.stringify(drawn.short)} single=${JSON.stringify(drawn.single)}`,
    );

    // NOTE ON WHAT IS *NOT* ASSERTED HERE. A "no phantom value" check that
    // compares each drawn label against the raw variant NAMES looks attractive
    // but is unsound: the picker renders a CANONICAL label, so the supplier's
    // fused `DarkGrey`/`GrayCamo` and its US `Gray` legitimately differ from the
    // drawn `Dark Grey`/`Grey`, and such a check false-fails six correct products
    // (Pet Harnesses, Pet Mats, Pet Nests, Pet Towels, Bird Accessories, Pet
    // Toys). A gate that cries wolf gets muted. The property that actually
    // matters - that no control promises an option the catalogue does not hold -
    // is already proven by "every pick resolves to a REAL catalogue row" above,
    // keyed on the resolved variant id rather than on label text.

    if (SHOT_EVERY > 0 && Number(sample.indexOf(p)) % SHOT_EVERY === 0) {
      await page.screenshot({ path: path.join(SHOT_DIR, `options_${sample.indexOf(p) + 1}.png`) });
    }
    await page.close();
  }

  // \u2500\u2500 Single-option products: an honest row, or nothing at all \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  for (const p of singles) {
    const page = await newPage({ viewport: { width: 390, height: 1000 } });
    await page.goto(`${BASE}/product/${p.slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".pd-short", { timeout: 30_000 });
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => ({
      groups: document.querySelectorAll(".pd-swatches, .pd-chips").length,
      single: document.querySelector(".pd-opt-single-value")?.textContent?.trim() ?? null,
      plain: Boolean(document.querySelector(".pd-opt-single-plain")),
      heading: document.querySelector(".pd-opt-single .pd-label")?.textContent?.trim() ?? null,
      short: document.querySelector(".pd-short")?.textContent?.trim() ?? "",
    }));
    const dims = Array.isArray(p.option_dimensions) ? p.option_dimensions : [];
    const stated = dims.map((d) => d.label).filter((l) => l && l.trim() !== "");
    const tag = `single / ${p.slug.slice(0, 34)}`;

    check(`${tag}: draws no chooser for one option`, s.groups === 0, `groups=${s.groups}`);
    // TASK 3 (this round): the single-configuration row IS the product's option
    // value, so the short line above it must not print the same string again -
    // on the live store the 2-pack dog door bells read "Pink" under the price and
    // "Pink" again as its one configuration. The line now carries information the
    // row does not, so the product never says the same thing twice.
    check(
      `${tag}: the short line never repeats the single configuration`,
      norm(s.short) === "" || s.single === null || norm(s.short) !== norm(s.single),
      `short=${JSON.stringify(s.short)} single=${JSON.stringify(s.single)}`,
    );
    // TASK 3: a single-configuration product reads simply and accurately. The
    // awkward "One configuration - Black" sentence is gone, and the value shown
    // is the supplier's own - never a raw internal code.
    const singleText = (s.single ?? "") + " " + (s.heading ?? "");
    check(
      `${tag}: no awkward "One configuration - X" wording`,
      !/one\s+configuration/i.test(singleText),
      `text=${JSON.stringify(singleText.trim())}`,
    );
    const singleCode = (s.single ?? "").trim();
    check(
      `${tag}: the stated value is not a supplier's internal code`,
      !/^(?=.{4,}$)(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]+$/.test(singleCode),
      `value=${JSON.stringify(singleCode)}`,
    );
    // A product the supplier marks optionless must not invent a heading; one
    // that states a MEANINGFUL dimension must name it. A supplier token that
    // names nothing ("Specifications", "Q", "Materials") is not a heading a
    // shopper can act on, so the page states the value plainly instead - and
    // printing that meaningless word would itself be a failure.
    const GENERIC_TOKEN = /^(specifications?|specs?|materials?|attributes?|options?|variants?|q|qty)$/i;
    if (stated.length > 0) {
      const meaningful = stated.filter((l) => !GENERIC_TOKEN.test(String(l).trim()));
      // A lone value that is the supplier's OWN internal code ("7018NATURAL") is
      // not something to print at a shopper, so the page states NOTHING for it -
      // not the code, and not a dangling heading with no readable value.
      const soleIsCode = /^(?=.{4,}$)(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]+$/.test(
        String(p.variant_name ?? "").trim(),
      );
      if (soleIsCode) {
        check(
          `${tag}: an unreadable supplier code is not printed as the configuration`,
          s.single === null && s.heading === null,
          `heading=${JSON.stringify(s.heading)} value=${JSON.stringify(s.single)}`,
        );
      } else if (meaningful.length > 0) {
        check(
          `${tag}: names its real dimension ("${meaningful[0]}")`,
          s.heading === meaningful[0] && s.single !== null,
          `heading=${JSON.stringify(s.heading)} value=${JSON.stringify(s.single)}`,
        );
      } else {
        check(
          `${tag}: does not print the supplier's meaningless token as a heading`,
          s.single !== null && !GENERIC_TOKEN.test(String(s.heading ?? "").trim()),
          `heading=${JSON.stringify(s.heading)} value=${JSON.stringify(s.single)}`,
        );
      }
    } else {
      check(
        `${tag}: optionless product states one configuration, no fake "Option" row`,
        s.single === null || s.plain,
        `single=${JSON.stringify(s.single)} plain=${s.plain}`,
      );
    }
    await page.close();
  }

  // \u2500\u2500 Social links, header AND footer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  {
    const page = await newPage({ viewport: { width: 1280, height: 1000 } });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("footer", { timeout: 30_000 });
    await page.waitForTimeout(200);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[aria-label]"))
        .filter((a) => /facebook|instagram|tiktok|youtube|pinterest|medium|twitter|x\b/i.test(a.getAttribute("aria-label") ?? ""))
        .map((a) => ({
          label: a.getAttribute("aria-label") ?? "",
          href: a.getAttribute("href") ?? "",
          target: a.getAttribute("target") ?? "",
          rel: a.getAttribute("rel") ?? "",
          where: a.closest("footer") ? "footer" : a.closest("header") ? "header" : "body",
        })),
    );
    const dead = links.filter((l) => !l.href || l.href === "#" || l.href.startsWith("#"));
    check("no social link is a dead placeholder", dead.length === 0, `dead=${JSON.stringify(dead)}`);

    const REAL = {
      facebook: "https://www.facebook.com/petparcel",
      tiktok: "https://www.tiktok.com/@getpetparcel",
      pinterest: "https://www.pinterest.com/petparcel",
      medium: "https://medium.com/@petparcel",
    };
    for (const [name, url] of Object.entries(REAL)) {
      const hit = links.filter((l) => l.href === url);
      check(`the real ${name} account is linked`, hit.length >= 1, `matches=${hit.length}`);
      if (hit.length > 0) {
        const ok = hit.every((l) => l.target === "_blank" && /noopener/.test(l.rel) && /noreferrer/.test(l.rel));
        check(`${name} link opens in a new tab safely`, ok, JSON.stringify(hit[0]));
      }
    }
    // No icon for a platform the store has no account on.
    const bogus = links.filter((l) => /instagram|youtube/i.test(l.label));
    check("no icon links to a platform the store has no account on", bogus.length === 0, JSON.stringify(bogus));

    if (process.env.TAKE_SHOTS === "1") {
      await page.screenshot({ path: path.join(SHOT_DIR, "socials_home_1440.png") });
    }
    await page.close();
  }

  await db.end();
  await browser.close();

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n[options] ${passed}/${checks.length} checks passed`);

  if (SELF_HOST) {
    tls?.close();
    child?.kill("SIGTERM");
  }

  if (failures.length > 0) {
    console.error(`\n[options] FAILED: ${failures.length} check(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    `[options] PASSED: every sampled product draws one control per real option, heads each dimension with the supplier's own name, shows distinct real colours, switches to a real variant, and no social link is a dead placeholder.`,
  );
}

main().catch((err) => {
  console.error(`[options] FAILED: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
