// Turn the raw supplier option-schema JSON (work/cj-option-schema-data.json,
// written by scripts/fetch-cj-option-schema.mjs) into the TS module the app
// ships: shared/cj-option-schema-data.ts.
//
// WHY A GENERATED TS MODULE RATHER THAN A JSON IMPORT. The seeder runs under
// tsx and the server bundles with esbuild; a generated .ts keeps the data
// type-checked, keeps it out of the client bundle's import graph by name, and
// makes a diff of a re-fetch readable in review (one entry per product).
//
// Run: node scripts/build-option-schema-module.mjs
import fs from "node:fs";
import path from "node:path";
import { parseDimensionSchema } from "../shared/cj-option-schema.ts";

const SRC = path.resolve("work/cj-option-schema-data.json");
const OUT = path.resolve("shared/cj-option-schema-data.ts");

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
// Re-derive the dimensions from the supplier's raw schema string rather than
// trusting the copy stored alongside it, so a change to the classification rules
// (a new dimension word, the supplier-code rejection) takes effect on rebuild.
const entries = Object.entries(raw.products ?? {}).map(([slug, p]) => [
  slug,
  { ...p, dimensions: parseDimensionSchema(p.productKeyEn || p.productKey) },
]);
entries.sort((a, b) => a[0].localeCompare(b[0]));

const lines = [];
lines.push("// GENERATED - do not hand-edit. Re-run `node scripts/build-option-schema-module.mjs`");
lines.push("// after `node scripts/fetch-cj-option-schema.mjs`, which reads the SUPPLIER'S OWN");
lines.push("// option dimensions from the live CJ product endpoint.");
lines.push("//");
lines.push("// This is the store's record of what the supplier states about each product's");
lines.push("// options: the dimension tokens (\"COLOR\", \"SIZE\", \"QTY\") and the storefront's");
lines.push("// heading for each (\"Colour\", \"Size\", \"Pack\"). It is what stops the buy box from");
lines.push("// heading a dimension with a word the supplier never used, and what lets a");
lines.push("// product whose real listing has a single option say so plainly instead of");
lines.push("// drawing a vague \"Option\" row.");
lines.push("//");
lines.push(`// Fetched: ${raw.generatedAt} from ${raw.source}.`);
lines.push("");
lines.push("/** One supplier-stated option dimension for a product. */");
lines.push("export interface OptionDimension {");
lines.push("  /** The supplier's own token, e.g. \"COLOR\", \"QTY\", \"Color-Size\". */");
lines.push("  token: string;");
lines.push("  /** What it is, which decides how the storefront draws it. */");
lines.push("  kind: \"color\" | \"size\" | \"pack\" | \"set\" | \"option\";");
lines.push("  /** The heading drawn above the row; \"\" when the token is an internal code. */");
lines.push("  label: string;");
lines.push("}");
lines.push("");
lines.push("/** One product's supplier-stated option schema. */");
lines.push("export interface OptionSchemaEntry {");
lines.push("  pid: string;");
lines.push("  productKey: string | null;");
lines.push("  productKeyEn: string | null;");
lines.push("  dimensions: OptionDimension[];");
lines.push("}");
lines.push("");
lines.push("/** Keyed by the product's slug, which is the store's stable identity. */");
lines.push("export const OPTION_SCHEMA_BY_SLUG: Record<string, OptionSchemaEntry> = {");
for (const [slug, p] of entries) {
  lines.push(`  ${JSON.stringify(slug)}: {`);
  lines.push(`    pid: ${JSON.stringify(p.pid)},`);
  lines.push(`    productKey: ${p.productKey === null ? "null" : JSON.stringify(p.productKey)},`);
  lines.push(`    productKeyEn: ${p.productKeyEn === null ? "null" : JSON.stringify(p.productKeyEn)},`);
  lines.push(`    dimensions: ${JSON.stringify(p.dimensions ?? [])},`);
  lines.push("  },");
}
lines.push("};");
lines.push("");
lines.push("/** The schema for a slug, or undefined when the supplier listing has not been");
lines.push(" *  fetched for it yet (a product an admin added by hand, for instance). */");
lines.push("export function optionSchemaFor(slug: string): OptionSchemaEntry | undefined {");
lines.push("  return OPTION_SCHEMA_BY_SLUG[slug];");
lines.push("}");
lines.push("");

fs.writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${entries.length} products)`);
