// Customers vs Users - two different things, shown as two different things.
//
//   CUSTOMER - a registered account that has actually PAID for an order.
//              Derived from paid orders, so an account that never bought is
//              never counted here. Lifetime value is the sum of paid orders.
//   USER     - every registered account, whether or not it has bought.
//              A signup is not a sale, so it is reported separately.
//
// Both tables are searchable and sortable, and both read live from the database.
import { useMemo, useState } from "react";
import { ShieldAlert, Trash2, UserRound, Users } from "lucide-react";
import { formatDate, formatMoney } from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import { filterRows } from "../table";
import type { AdminCustomer, AdminUser } from "../types";
import {
  AdminPageHeader,
  Btn,
  Card,
  Column,
  ConfirmDialog,
  DataTable,
  ErrorPanel,
  Pill,
  SearchInput,
  TableSkeleton,
  useToast,
} from "../ui";

export function CustomersPage() {
  const data = useAdminData();
  const toast = useToast();
  const customers = useAsync(() => data.listCustomers(), [data]);
  const users = useAsync(() => data.listUsers(), [data]);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  // Bulk selection (the owner account can never be selected).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await data.deleteUser(pendingDelete.id);
      toast.push(`${pendingDelete.name || pendingDelete.email} deleted.`);
      setPendingDelete(null);
      // Both tables can change: a deleted paid buyer also leaves the Customers list.
      users.refetch();
      customers.refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not delete the account.", "error");
    } finally {
      setBusy(false);
    }
  };

  // Bulk delete: reuse the SAME admin.deleteUser path as the row action. Each
  // account is attempted independently so one refusal (the owner guard, or a
  // race) never blocks the rest - the toast reports the exact tally.
  const confirmBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await data.deleteUser(id);
        ok += 1;
      } catch {
        failed.push(id);
      }
    }
    setBulkBusy(false);
    setBulkOpen(false);
    setSelected(new Set(failed));
    if (failed.length === 0) {
      toast.push(`${ok} ${ok === 1 ? "account" : "accounts"} deleted.`);
    } else {
      toast.push(`${ok} deleted, ${failed.length} could not be deleted.`, "error");
    }
    users.refetch();
    customers.refetch();
  };

  const customerRows = useMemo(
    () => filterRows(customers.data ?? [], query, ["name", "email", "phone"]),
    [customers.data, query],
  );
  const userRows = useMemo(
    () => filterRows(users.data ?? [], query, ["name", "email", "role"]),
    [users.data, query],
  );

  const customerColumns: Column<AdminCustomer>[] = [
    {
      key: "name",
      header: "Customer",
      sortable: true,
      className: "max-w-[150px] sm:max-w-none",
      render: (c) => (
        <span>
          <span className="block truncate font-semibold text-ink">{c.name || "—"}</span>
          {c.phone && <span className="block truncate text-xs text-muted-foreground">{c.phone}</span>}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (c) => (
        <span className="block max-w-[140px] truncate text-muted-foreground sm:max-w-[220px]">
          {c.email}
        </span>
      ),
    },
    {
      key: "orderCount",
      header: "Orders",
      sortable: true,
      align: "right",
      className: "hidden sm:table-cell",
      render: (c) => <span className="font-semibold text-ink">{c.orderCount}</span>,
    },
    {
      key: "spendCents",
      header: "Lifetime value",
      sortable: true,
      align: "right",
      render: (c) => <span className="font-extrabold text-ink">{formatMoney(c.spendCents)}</span>,
    },
    {
      key: "lastOrderAt",
      header: "Last order",
      sortable: true,
      align: "right",
      className: "hidden sm:table-cell",
      render: (c) => (
        <span className="text-muted-foreground">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</span>
      ),
    },
  ];

  const userColumns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Account",
      sortable: true,
      className: "max-w-[150px] sm:max-w-none",
      render: (u) => (
        <span>
          <span className="block truncate font-semibold text-ink">{u.name || "—"}</span>
          {/* Role rides under the name on narrow screens and takes its own
              column from `sm` up, so the table fits a phone without a swipe. */}
          <span className="mt-0.5 block sm:hidden">
            <Pill tone={u.role === "admin" ? "rose" : "slate"}>{u.role}</Pill>
          </span>
          {u.phone && <span className="hidden truncate text-xs text-muted-foreground sm:block">{u.phone}</span>}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (u) => (
        <span className="block max-w-[140px] truncate text-muted-foreground sm:max-w-[220px]">
          {u.email}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      align: "center",
      className: "hidden sm:table-cell",
      render: (u) => <Pill tone={u.role === "admin" ? "rose" : "slate"}>{u.role}</Pill>,
    },
    {
      key: "orderCount",
      header: "Orders",
      sortable: true,
      align: "right",
      className: "hidden sm:table-cell",
      render: (u) => (
        <span className={u.orderCount > 0 ? "font-semibold text-ink" : "text-muted-foreground"}>
          {u.orderCount}
        </span>
      ),
    },
    {
      key: "emailVerified",
      header: "Status",
      align: "center",
      className: "hidden sm:table-cell",
      sortValue: (u) => (u.emailVerified ? 1 : 0),
      render: (u) =>
        u.emailVerified ? (
          <Pill tone="green">verified</Pill>
        ) : (
          <Pill tone="neutral">unverified</Pill>
        ),
    },
    {
      key: "createdAt",
      header: "Joined",
      sortable: true,
      align: "right",
      className: "hidden md:table-cell",
      render: (u) => <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) =>
        u.role === "admin" ? (
          // HARD GUARD, made visible: the owner's own account is the only way
          // back into this panel, so its delete control is present but disabled
          // and explains itself on hover / to a screen reader. The server refuses
          // it too, so this is courtesy, not the protection itself.
          <button
            type="button"
            disabled
            aria-label={`The owner account ${u.email} cannot be deleted`}
            title="The store owner's account can't be deleted - it is the only way back into this panel."
            className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full text-rose-300"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPendingDelete(u)}
            aria-label={`Delete account ${u.email}`}
            title={`Delete account ${u.email}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Customers"
        subtitle="Customers are accounts that have paid for an order. Registered accounts are listed separately as users."
      />

      <div className="mb-5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search customers and users…" />
      </div>

      {/* Customers: paid buyers only. */}
      <Card className="mb-8 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
            <UserRound className="h-5 w-5 text-primary" /> Customers
          </h2>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
            {customers.data?.length ?? 0} with a paid order
          </span>
        </div>
        {customers.isLoading ? (
          <TableSkeleton rows={4} />
        ) : customers.error ? (
          <ErrorPanel message={customers.error} onRetry={customers.refetch} />
        ) : (
          <DataTable
            rows={customerRows}
            columns={customerColumns}
            pageSize={10}
            initialSort={{ key: "spendCents", dir: "desc" }}
            emptyTitle={query ? "No customers match" : "No customers yet"}
            emptyBody={
              query
                ? "Try a different search term."
                : "A customer appears here once an account has paid for an order."
            }
          />
        )}
      </Card>

      {/* Users: every registered account, buyer or not. */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
            <Users className="h-5 w-5 text-primary" /> Users
          </h2>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
            {users.data?.length ?? 0} registered
          </span>
        </div>
        <p className="mb-4 -mt-2 text-sm text-muted-foreground">
          Every registered account, whether or not it has bought anything.
        </p>

        {/* Bulk action bar: appears only when rows are ticked. The owner account
            can never be ticked, and the server refuses it regardless. */}
        {selected.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="text-sm font-semibold text-ink">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Btn>
              <Btn
                variant="danger"
                size="sm"
                onClick={() => setBulkOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete selected
              </Btn>
            </div>
          </div>
        )}

        {users.isLoading ? (
          <TableSkeleton rows={4} />
        ) : users.error ? (
          <ErrorPanel message={users.error} onRetry={users.refetch} />
        ) : (
          <DataTable
            rows={userRows}
            columns={userColumns}
            pageSize={10}
            initialSort={{ key: "createdAt", dir: "desc" }}
            selection={{
              selected,
              onChange: setSelected,
              // The owner's account is never selectable - it is the only way
              // back into this panel. The server enforces this too.
              isSelectable: (u) => u.role !== "admin",
            }}
            emptyTitle={query ? "No users match" : "No registered users yet"}
            emptyBody={
              query ? "Try a different search term." : "Accounts appear here as soon as someone signs up."
            }
          />
        )}
      </Card>

      <ConfirmDialog
        open={bulkOpen}
        title={`Delete ${selected.size} ${selected.size === 1 ? "account" : "accounts"}?`}
        body={`This permanently deletes ${selected.size} account${selected.size === 1 ? "" : "s"} and their sign-in credentials, saved addresses and wishlists. They will no longer be able to sign in. Any orders or reviews they left are kept for the store's records but are no longer linked to an account. This cannot be undone.`}
        confirmLabel={bulkBusy ? "Deleting…" : `Delete ${selected.size}`}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete ${pendingDelete.name || pendingDelete.email}?` : "Delete account?"}
        body={
          pendingDelete
            ? `This permanently deletes the account for ${pendingDelete.name || "this person"} (${pendingDelete.email}) along with their sign-in credential, saved addresses and wishlist. They will no longer be able to sign in. Any orders or reviews they left are kept for the store's records but are no longer linked to an account. This cannot be undone.`
            : ""
        }
        confirmLabel={busy ? "Deleting…" : "Delete account"}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
