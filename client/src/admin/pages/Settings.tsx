// Store settings: brand, contact, shipping/tax, payments and email sender.
// Grouped form with validation; saving writes through the data source (the demo
// source keeps it for the session; the live source writes to store_settings).
import { useEffect, useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminSettings } from "../types";
import {
  AdminPageHeader,
  Btn,
  Card,
  ErrorPanel,
  Field,
  TableSkeleton,
  TextArea,
  TextInput,
  useToast,
} from "../ui";

type Draft = Record<keyof AdminSettings, string>;

const GROUPS: Array<{
  title: string;
  help: string;
  keys: Array<{ key: keyof AdminSettings; label: string; type?: "text" | "textarea" | "number"; hint?: string }>;
}> = [
  {
    title: "Brand",
    help: "Shown in the header, footer, page titles and structured data.",
    keys: [
      { key: "brandName", label: "Store name" },
      { key: "tagline", label: "Tagline" },
      { key: "announcement", label: "Announcement bar (empty hides it)" },
    ],
  },
  {
    title: "Shipping, tax & returns",
    help: "Drives every price calculation on the storefront.",
    keys: [
      { key: "shippingFlatCents", label: "Flat shipping rate (cents)", type: "number" },
      { key: "freeShippingThresholdCents", label: "Free shipping over (cents, 0 = off)", type: "number" },
      { key: "taxRateBps", label: "Tax rate (basis points, e.g. 600 = 6%)", type: "number" },
      { key: "returnWindowDays", label: "Return window (days)", type: "number" },
      { key: "currency", label: "Currency code" },
    ],
  },
  {
    title: "Inventory",
    help: "Drives the low-stock flag on the dashboard, the products list and the storefront.",
    keys: [
      {
        key: "lowStockThreshold",
        label: "Low-stock threshold (units)",
        type: "number",
        hint: "A variant at or below this many units is flagged low on stock, everywhere. 1-500.",
      },
    ],
  },
  {
    title: "Contact & legal",
    help: "Appears in the footer, policy pages and contact card.",
    keys: [
      { key: "contactEmail", label: "Support email" },
      { key: "contactPhone", label: "Support phone" },
      { key: "supportHours", label: "Support hours" },
      { key: "businessAddress", label: "Business address", type: "textarea" },
    ],
  },
  {
    title: "Payments",
    help: "Keys live in environment variables, never here.",
    keys: [{ key: "paymentProvider", label: "Payment method (bachs)" }],
  },
  {
    title: "Email (Resend)",
    help: "Order confirmation and shipping notification emails.",
    keys: [
      { key: "emailFromName", label: "Sender name" },
      { key: "emailFromAddress", label: "From address" },
    ],
  },
];

const NUMERIC_KEYS: Array<keyof AdminSettings> = [
  "shippingFlatCents",
  "freeShippingThresholdCents",
  "taxRateBps",
  "returnWindowDays",
  "lowStockThreshold",
];

// Change the admin password. The credential lives with the ACTIVE provider
// (Neon Auth's hash is scrypt, not bcrypt), so this calls the server, which
// delegates to the provider - a local write would not change the live sign-in.
// Neither password is ever logged; the fields are cleared on success.
function ChangePasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = trpc.settings.changePassword.useMutation();

  const submit = async () => {
    if (next.length < 8) {
      toast.push("Use at least 8 characters for the new password.", "error");
      return;
    }
    if (next !== confirm) {
      toast.push("The new passwords do not match.", "error");
      return;
    }
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.push("Password updated. Use the new password next time you sign in.");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not change the password.", "error");
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-serif text-lg font-bold text-ink">Admin password</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Updates the credential at the sign-in provider, so the new password works immediately.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Current password" htmlFor="pw-current" className="sm:col-span-2">
          <TextInput
            id="pw-current"
            type="password"
            value={current}
            onChange={setCurrent}
          />
        </Field>
        <Field label="New password" htmlFor="pw-new">
          <TextInput
            id="pw-new"
            type="password"
            value={next}
            onChange={setNext}
          />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm">
          <TextInput
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={setConfirm}
          />
        </Field>
      </div>
      <div className="mt-5">
        <Btn onClick={submit} disabled={change.isPending || !current || !next || !confirm}>
          <KeyRound className="h-4 w-4" /> {change.isPending ? "Updating…" : "Update password"}
        </Btn>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: settings, isLoading, error, refetch } = useAsync(() => data.getSettings(), [data]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const asStrings = {} as Draft;
    (Object.keys(settings) as Array<keyof AdminSettings>).forEach((k) => {
      asStrings[k] = String(settings[k]);
    });
    setDraft(asStrings);
  }, [settings]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload: Partial<AdminSettings> = {};
      (Object.keys(draft) as Array<keyof AdminSettings>).forEach((k) => {
        if (NUMERIC_KEYS.includes(k)) {
          (payload as Record<string, unknown>)[k] = Number(draft[k]) || 0;
        } else {
          (payload as Record<string, unknown>)[k] = draft[k];
        }
      });
      await data.updateSettings(payload);
      toast.push("Settings saved.");
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Store settings"
        subtitle="Everything the storefront reads at runtime. No redeploy needed."
        actions={
          <Btn onClick={save} disabled={saving || !draft}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
          </Btn>
        }
      />

      {isLoading || !draft ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => (
            <Card key={group.title} className="p-6">
              <h2 className="font-serif text-lg font-bold text-ink">{group.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{group.help}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {group.keys.map((k) => (
                  <Field
                    key={k.key}
                    label={k.label}
                    htmlFor={`set-${k.key}`}
                    className={k.type === "textarea" ? "sm:col-span-2" : ""}
                  >
                    {k.type === "textarea" ? (
                      <TextArea
                        id={`set-${k.key}`}
                        rows={2}
                        value={draft[k.key]}
                        onChange={(v) => setDraft({ ...draft, [k.key]: v })}
                      />
                    ) : (
                      <TextInput
                        id={`set-${k.key}`}
                        type={k.type === "number" ? "number" : "text"}
                        inputMode={k.type === "number" ? "numeric" : "text"}
                        value={draft[k.key]}
                        onChange={(v) => setDraft({ ...draft, [k.key]: v })}
                      />
                    )}
                    {k.hint && <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>}
                  </Field>
                ))}
              </div>
            </Card>
          ))}
          <ChangePasswordCard />
        </div>
      )}
    </>
  );
}
