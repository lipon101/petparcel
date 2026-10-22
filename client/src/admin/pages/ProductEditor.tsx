// Product editor: details, images (URL list), tags, active/featured, and a
// variant table with per-variant price and stock. Form validation blocks a save
// with an empty name or a non-positive price, and shows the reason inline.
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ListPlus, Plus, Save, Trash2 } from "lucide-react";
import { adminPath } from "@/_core/admin-path";
import { formatMoney, parseDollarsToCents } from "@shared/store";
import { normalizeMedia, type ProductMedia } from "@shared/media";
import { MediaUploader } from "../MediaUploader";
import { useCatalogCategories } from "@/lib/useCatalog";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminProductInput, AdminProductSpecs, AdminVariantInput } from "../types";
import { OPTION_KIND_OPTIONS, buildOptionCombos, splitList, type OptionKind } from "../product-options";
import {
  AdminPageHeader,
  Btn,
  Card,
  ErrorPanel,
  Field,
  Pill,
  Select,
  TableSkeleton,
  TextArea,
  TextInput,
  Toggle,
  useToast,
} from "../ui";

/** A sentinel the category picker uses for "this product is filed on a name the
 *  browse taxonomy does not list", which reveals a free-text field. It keeps an
 *  older/custom aisle editable instead of silently rewriting it. */
const CUSTOM_CATEGORY = "__custom__";

function productIdFromPath(): string {
  const prefix = adminPath("products/");
  return window.location.pathname.slice(prefix.length).split("/")[0] ?? "";
}

interface VariantDraft {
  id?: string;
  name: string;
  sku: string;
  price: string;
  inventoryQty: string;
  active: boolean;
  /** Upstream supplier variant id - the exact option CJ fulfils. Blank = unmapped. */
  cjVid: string;
}

export function ProductEditorPage() {
  const data = useAdminData();
  const toast = useToast();
  const id = useMemo(productIdFromPath, []);
  const { data: product, isLoading, error, refetch } = useAsync(() => data.getProduct(id), [data, id]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [tagsText, setTagsText] = useState("");
  const [specs, setSpecs] = useState<AdminProductSpecs>({});
  const [active, setActive] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  // Option shape for this product: none / sizes / colours / both. Products
  // differ, so the editor lets the admin state which one applies and generates
  // the matching rows rather than hand-typing a generic list.
  const [optionKind, setOptionKind] = useState<OptionKind>("none");
  const [sizesText, setSizesText] = useState("");
  const [colorsText, setColorsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The browse tree from the live catalogue, so the pickers offer exactly the
  // aisles and subcategories the store actually has (nothing hardcoded here).
  const { nodes: categoryTree } = useCatalogCategories();
  const [customCategory, setCustomCategory] = useState(false);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setCategory(product.category);
    setDescription(product.description);
    setPrice((product.priceCents / 100).toFixed(2));
    setCompareAt(product.compareAtCents ? (product.compareAtCents / 100).toFixed(2) : "");
    setImages(product.images);
    setMedia(normalizeMedia(product.media, product.images));
    setTagsText(product.tags.join(", "));
    setSpecs(product.specs ?? {});
    setActive(product.active);
    setFeatured(product.featured);
    setVariants(
      product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: (v.priceCents / 100).toFixed(2),
        inventoryQty: String(v.inventoryQty),
        active: v.active,
        cjVid: v.cjVid ?? "",
      })),
    );
  }, [product?.id, product?.updatedAt]);

  // The current `category` name mapped onto the two-level picker: which aisle it
  // sits under (if any) and which subcategory it is. A name the tree does not
  // know falls to the free-text field rather than being rewritten.
  const selectedParent = useMemo(
    () => categoryTree.find((p) => p.name === category) ?? categoryTree.find((p) => p.children.some((c) => c.name === category)),
    [categoryTree, category],
  );
  const inTree = Boolean(selectedParent) || categoryTree.some((p) => p.name === category);
  // A legacy name (one of the products seeded before the taxonomy landed) opens
  // the free-text field by default; so does pressing "Custom category…".
  const usingCustom = customCategory || (Boolean(category) && !inTree);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "A product needs a name.";
    if (!category.trim()) next.category = "Pick a category.";
    const cents = parseDollarsToCents(price);
    if (cents == null || cents <= 0) next.price = "Enter a price greater than zero.";
    if (compareAt && (parseDollarsToCents(compareAt) ?? 0) <= 0) next.compareAt = "Compare-at must be a positive amount.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.push("Please fix the highlighted fields.", "error");
      return;
    }
    setSaving(true);
    try {
      const input: AdminProductInput = {
        name: name.trim(),
        slug: product?.slug,
        description,
        category: category.trim(),
        priceCents: parseDollarsToCents(price) ?? 0,
        compareAtCents: compareAt ? parseDollarsToCents(compareAt) : null,
        images,
        media,
        specs,
        tags: tagsText.split(",").map((s) => s.trim()).filter(Boolean),
        active,
        featured,
        sortOrder: product?.sortOrder ?? 0,
      };
      await data.updateProduct(id, input);

      // Variants persist to the real database too: new rows are created, edited
      // rows updated, and removed rows deleted. The draft is diffed against what
      // was loaded, so a save writes exactly what changed.
      const original = product?.variants ?? [];
      const keptIds = new Set(variants.map((v) => v.id).filter(Boolean) as string[]);
      for (const v of original) {
        if (!keptIds.has(v.id)) await data.deleteVariant(v.id);
      }
      for (const row of variants) {
        const payload: AdminVariantInput = {
          name: row.name.trim() || "Default",
          sku: row.sku.trim(),
          priceCents: parseDollarsToCents(row.price) ?? 0,
          inventoryQty: Math.max(0, Math.trunc(Number(row.inventoryQty) || 0)),
          active: row.active,
          cjVid: row.cjVid.trim() || null,
        };
        if (row.id) await data.updateVariant(row.id, payload);
        else await data.createVariant(id, payload);
      }

      toast.push("Product saved.");
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <AdminPageHeader title="Product" />
        <TableSkeleton rows={5} />
      </>
    );
  }
  if (error || !product) {
    return (
      <>
        <AdminPageHeader title="Product" />
        <ErrorPanel message={error ?? "That product could not be found."} onRetry={refetch} />
        <div className="mt-4">
          <Link to={adminPath("products")} className="text-sm font-semibold text-primary hover:underline">
            Back to products
          </Link>
        </div>
      </>
    );
  }

  const updateVariant = (i: number, patch: Partial<VariantDraft>) =>
    setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Build the variant rows for the chosen option shape. Existing rows are
  // replaced only when there is something to replace them with, so a
  // half-filled form never wipes a product's options.
  const generateOptions = () => {
    const labels = buildOptionCombos(optionKind, splitList(sizesText), splitList(colorsText));
    if (labels.length === 0) {
      toast.push("Add at least one value before generating options.", "error");
      return;
    }
    const base = price || "0.00";
    setVariants(labels.map((label) => ({ name: label, sku: "", price: base, inventoryQty: "0", active: true, cjVid: "" })));
    toast.push(`${labels.length} option${labels.length === 1 ? "" : "s"} generated.`);
  };

  return (
    <>
      <div className="mb-4">
        <Link
          to={adminPath("products")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All products
        </Link>
      </div>
      <AdminPageHeader
        title={product.name}
        subtitle="Product details, images and variants."
        actions={
          <Btn onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save product"}
          </Btn>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="font-serif text-lg font-bold text-ink">Details</h2>
          <div className="mt-4 space-y-4">
            <Field label="Name" htmlFor="p-name">
              <TextInput id="p-name" value={name} onChange={setName} />
              {errors.name && <p className="mt-1 text-xs font-semibold text-destructive">{errors.name}</p>}
            </Field>

            {/* Category is a two-level picker bound to the live browse tree: pick
                an aisle, then a subcategory of it. The subcategory list is
                filtered by the chosen aisle, so it can never offer a child of a
                different parent. */}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="p-parent" hint="The aisle this product is browsed under.">
                <Select
                  id="p-parent"
                  value={selectedParent?.id ?? CUSTOM_CATEGORY}
                  onChange={(v) => {
                    if (v === CUSTOM_CATEGORY) {
                      setCustomCategory(true);
                      return;
                    }
                    setCustomCategory(false);
                    const parent = categoryTree.find((p) => p.id === v);
                    if (!parent) return;
                    // Keeping a child selected only when it belongs to the newly
                    // chosen aisle, otherwise file on the aisle itself.
                    const stays = parent.children.some((c) => c.name === category);
                    setCategory(stays ? category : parent.name);
                  }}
                  options={[
                    ...categoryTree.map((p) => ({ value: p.id, label: p.name })),
                    { value: CUSTOM_CATEGORY, label: "Custom category…" },
                  ]}
                />
              </Field>
              <Field label="Subcategory" htmlFor="p-sub" hint="Optional - narrows the aisle further.">
                <Select
                  id="p-sub"
                  value={selectedParent?.children.some((c) => c.name === category) ? category : ""}
                  onChange={(v) => {
                    if (!selectedParent) return;
                    setCategory(v || selectedParent.name);
                  }}
                  options={[
                    { value: "", label: selectedParent ? `All ${selectedParent.name}` : "Pick a category first" },
                    ...(selectedParent?.children ?? []).map((c) => ({ value: c.name, label: c.name })),
                  ]}
                  className={selectedParent ? undefined : "opacity-60"}
                />
              </Field>
            </div>

            {usingCustom && (
              <Field label="Custom category name" htmlFor="p-cat" hint="Used only when the aisle is not in the browse tree.">
                <TextInput id="p-cat" value={category} onChange={setCategory} />
              </Field>
            )}
            {/* The picker's current value shown as plain text, so what will be
                SAVED is always visible even when the tree filtered it out. */}
            <p className="-mt-2 text-xs text-muted-foreground">
              Filed under: <span className="font-semibold text-ink">{category || "—"}</span>
            </p>
            {errors.category && <p className="-mt-2 text-xs font-semibold text-destructive">{errors.category}</p>}

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <Field label="Price (USD)" htmlFor="p-price">
                <TextInput id="p-price" inputMode="decimal" value={price} onChange={setPrice} />
                {errors.price && <p className="mt-1 text-xs font-semibold text-destructive">{errors.price}</p>}
              </Field>
              <Field label="Compare-at (USD)" htmlFor="p-compare" hint="Optional">
                <TextInput id="p-compare" inputMode="decimal" value={compareAt} onChange={setCompareAt} placeholder="—" />
                {errors.compareAt && <p className="mt-1 text-xs font-semibold text-destructive">{errors.compareAt}</p>}
              </Field>
            </div>

            <Field label="Description" htmlFor="p-desc">
              <TextArea id="p-desc" rows={6} value={description} onChange={setDescription} />
            </Field>

            {/* Real, checkable attributes for the Product Details tab. Every
                field is optional: leave one blank and the tab simply shows one
                row fewer rather than printing a placeholder. */}
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Product details</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Real attributes only - leave a field blank if it is not known.
              </p>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                <Field label="Materials" htmlFor="p-materials">
                  <TextInput
                    id="p-materials"
                    value={specs.materials ?? ""}
                    onChange={(v) => setSpecs((s) => ({ ...s, materials: v }))}
                    placeholder="e.g. PVC shell"
                  />
                </Field>
                <Field label="Dimensions" htmlFor="p-dimensions">
                  <TextInput
                    id="p-dimensions"
                    value={specs.dimensions ?? ""}
                    onChange={(v) => setSpecs((s) => ({ ...s, dimensions: v }))}
                    placeholder="e.g. 18.5 x 18.9 x 23.2 in"
                  />
                </Field>
                <Field label="Weight" htmlFor="p-weight">
                  <TextInput
                    id="p-weight"
                    value={specs.weight ?? ""}
                    onChange={(v) => setSpecs((s) => ({ ...s, weight: v }))}
                    placeholder="e.g. 18.7 lb"
                  />
                </Field>
                <Field label="Care" htmlFor="p-care">
                  <TextInput
                    id="p-care"
                    value={specs.care ?? ""}
                    onChange={(v) => setSpecs((s) => ({ ...s, care: v }))}
                    placeholder="e.g. Wipe with a damp cloth"
                  />
                </Field>
              </div>
            </div>

            <Field label="Media" hint="Images and videos. Upload from your device, or import a supplier link - we host our own copy, so the source is never exposed. The first item is the main catalogue photo.">
              <MediaUploader media={media} onChange={setMedia} />
            </Field>

            <Field label="Tags" htmlFor="p-tags" hint="Comma separated">
              <TextInput id="p-tags" value={tagsText} onChange={setTagsText} />
            </Field>

            <div className="flex flex-wrap gap-5">
              <Toggle checked={active} onChange={setActive} label="Live on storefront" />
              <Toggle checked={featured} onChange={setFeatured} label="Feature on home page" />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-ink">Variants &amp; stock</h2>
              <Btn
                size="sm"
                variant="outline"
                onClick={() =>
                  setVariants((rows) => [
                    ...rows,
                    { name: "New variant", sku: "", price, inventoryQty: "0", active: true, cjVid: "" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Btn>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              One row per option, each with its own price and stock. Blank SKUs are generated for you.
            </p>

            {/* Option shape: pick what THIS product actually comes in, list the
                values, and generate the rows. Products differ, so this keeps
                each one's options its own instead of a generic set. */}
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[10rem] flex-1">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Option type</span>
                  <Select
                    value={optionKind}
                    onChange={(v) => setOptionKind(v as OptionKind)}
                    options={OPTION_KIND_OPTIONS}
                    ariaLabel="Option type"
                    className="!mt-0 h-10"
                  />
                </label>
                {(optionKind === "size" || optionKind === "sizeColor") && (
                  <label className="min-w-[10rem] flex-1">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">Sizes</span>
                    <TextInput
                      aria-label="Sizes"
                      value={sizesText}
                      onChange={setSizesText}
                      placeholder="S, M, L"
                      className="!mt-0 h-10"
                    />
                  </label>
                )}
                {(optionKind === "color" || optionKind === "sizeColor") && (
                  <label className="min-w-[10rem] flex-1">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">Colours</span>
                    <TextInput
                      aria-label="Colours"
                      value={colorsText}
                      onChange={setColorsText}
                      placeholder="Black, Blue"
                      className="!mt-0 h-10"
                    />
                  </label>
                )}
                <Btn variant="outline" size="sm" onClick={generateOptions} disabled={optionKind === "none"}>
                  <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate options
                </Btn>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Pick the option type and its values, then generate a row for each.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {variants.length === 0 && (
                <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  No variants - the product sells at its base price with no options.
                </p>
              )}
              {variants.map((row, i) => (
                <div key={row.id ?? `new-${i}`} className="rounded-xl border border-border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                    <TextInput
                      aria-label="Variant name"
                      value={row.name}
                      onChange={(v) => updateVariant(i, { name: v })}
                      placeholder="Name (e.g. Large)"
                      className="!mt-0 h-10"
                    />
                    <TextInput
                      aria-label="SKU"
                      value={row.sku}
                      onChange={(v) => updateVariant(i, { sku: v })}
                      placeholder="SKU (auto if blank)"
                      className="!mt-0 h-10 font-mono"
                    />
                    <TextInput
                      aria-label="Price"
                      inputMode="decimal"
                      value={row.price}
                      onChange={(v) => updateVariant(i, { price: v })}
                      placeholder="Price"
                      className="!mt-0 h-10"
                    />
                    <TextInput
                      aria-label="Inventory quantity"
                      inputMode="numeric"
                      value={row.inventoryQty}
                      onChange={(v) => updateVariant(i, { inventoryQty: v })}
                      placeholder="Stock"
                      className="!mt-0 h-10"
                    />
                    <TextInput
                      aria-label="CJ variant id"
                      value={row.cjVid}
                      onChange={(v) => updateVariant(i, { cjVid: v })}
                      placeholder="CJ VID (for auto-fulfilment)"
                      className="!mt-0 h-10 font-mono sm:col-span-2"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Toggle checked={row.active} onChange={(v) => updateVariant(i, { active: v })} label="Active" />
                    <span className="text-xs text-muted-foreground">
                      {formatMoney(parseDollarsToCents(row.price) ?? 0)} · {row.inventoryQty || 0} in stock
                    </span>
                    <button
                      type="button"
                      onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))}
                      className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-input px-3 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Saved with the product and live on the storefront immediately.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="font-serif text-lg font-bold text-ink">Preview</h2>
            <p className="mt-1 text-xs text-muted-foreground">How this product appears in the catalog.</p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="aspect-square bg-muted">
                {images[0] ? (
                  <img src={images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">🐾</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{category}</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{name || "Untitled"}</p>
                <p className="mt-1 text-sm font-extrabold text-ink">
                  {formatMoney(parseDollarsToCents(price) ?? 0)}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <Pill tone={active ? "green" : "slate"}>{active ? "Live" : "Hidden"}</Pill>
                  {featured && <Pill tone="teal">Featured</Pill>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}