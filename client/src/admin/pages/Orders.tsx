// Orders list: status filter chips, search, sortable + paginated table. Clicking
// a row opens the order detail. Each row also carries a delete action that opens
// a confirmation dialog naming the order, so a record is never removed by
// accident - the owner can clear spam or test orders from the panel.
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";
import { adminPath } from "@/_core/admin-path";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, formatDateTime, formatMoney } from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import { filterRows } from "../table";
import type { AdminOrder } from "../types";
import {
  AdminPageHeader,
  Column,
  ConfirmDialog,
  DataTable,
  ErrorPanel,
  SearchInput,
  StatusPill,
  TableSkeleton,
  useToast,
} from "../ui";
import { cn } from "@/lib/utils";

export function OrdersPage() {
  const data = useAdminData();
  const toast = useToast();
  const [, navigate] = useLocation();
  const { data: orders, isLoading, error, refetch } = useAsync(() => data.listOrders(), [data]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    let list = orders ?? [];
    if (status) list = list.filter((o) => o.status === status);
    return filterRows(list, query, ["orderNumber", "email", "customerName"]);
  }, [orders, status, query]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await data.deleteOrder(pendingDelete.id);
      toast.push(`Order ${pendingDelete.orderNumber} deleted.`);
      setPendingDelete(null);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not delete the order.", "error");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminOrder>[] = [
    {
      key: "orderNumber",
      header: "Order",
      sortable: true,
      render: (o) => (
        <span>
          <span className="block font-mono font-bold text-ink">{o.orderNumber}</span>
          <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{o.customerName}</span>
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      className: "hidden md:table-cell",
      render: (o) => <span className="block max-w-[220px] truncate text-muted-foreground">{o.email}</span>,
    },
    {
      key: "createdAt",
      header: "Placed",
      sortable: true,
      className: "hidden whitespace-nowrap sm:table-cell",
      render: (o) => <span className="text-muted-foreground">{formatDateTime(o.createdAt)}</span>,
    },
    {
      key: "totalCents",
      header: "Total",
      sortable: true,
      align: "right",
      render: (o) => <span className="font-extrabold text-ink">{formatMoney(o.totalCents)}</span>,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      align: "center",
      className: "hidden lg:table-cell",
      sortValue: (o) => o.paymentStatus,
      render: (o) => <StatusPill status={o.paymentStatus} kind="payment" />,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      sortValue: (o) => o.status,
      render: (o) => <StatusPill status={o.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <button
          type="button"
          // The row itself opens the order; the delete control must not.
          onClick={(e) => {
            e.stopPropagation();
            setPendingDelete(o);
          }}
          aria-label={`Delete order ${o.orderNumber}`}
          title={`Delete order ${o.orderNumber}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title="Orders" subtitle="Update payment, fulfilment and tracking." />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-semibold",
            status === "" ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-inset ring-border hover:bg-secondary",
          )}
        >
          All
        </button>
        {ORDER_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatus(st)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold",
              status === st ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-inset ring-border hover:bg-secondary",
            )}
          >
            {ORDER_STATUS_LABEL[st]}
          </button>
        ))}
        <div className="ml-auto">
          <SearchInput value={query} onChange={setQuery} placeholder="Search orders…" />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          pageSize={10}
          initialSort={{ key: "createdAt", dir: "desc" }}
          emptyTitle="No orders match"
          emptyBody="Try a different status or search term."
          onRowClick={(o) => navigate(adminPath(`orders/${o.id}`))}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete order ${pendingDelete.orderNumber}?` : "Delete order?"}
        body={
          pendingDelete
            ? `This permanently removes order ${pendingDelete.orderNumber} for ${pendingDelete.email} (${formatMoney(
                pendingDelete.totalCents,
              )}) and its line items, history and email log. This cannot be undone.`
            : ""
        }
        confirmLabel={busy ? "Deleting…" : "Delete order"}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
