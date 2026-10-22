// Contact messages: the inbox for the storefront's contact form.
//
// Full CRUD + reply. The panel can create a message the owner took elsewhere (a
// phone enquiry), edit one, delete one, and REPLY to one - which actually sends
// the shopper an email and records the reply against the row, rather than only
// flipping a status flag. Read/unread/replied states keep working as before.
import { useMemo, useState } from "react";
import { Mail, MailOpen, Pencil, Reply, Send, Trash2, X } from "lucide-react";
import { formatDateTime } from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import { filterRows } from "../table";
import type { AdminContactMessage, AdminMessageStatus } from "../types";
import {
  AdminPageHeader,
  Btn,
  Card,
  ErrorPanel,
  SearchInput,
  StatusPill,
  TableSkeleton,
  useToast,
} from "../ui";
import { cn } from "@/lib/utils";

type Filter = "all" | AdminMessageStatus;

/** The blank draft for the "new message" form. */
const EMPTY_DRAFT = { name: "", email: "", topic: "", message: "" };

export function MessagesPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: messages, isLoading, error, refetch } = useAsync(() => data.listMessages(), [data]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  // Which message has its reply composer open, and the draft text.
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  // Which message is being edited inline, and its draft.
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);
  // The "new message" composer.
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const rows = useMemo(() => {
    let list = messages ?? [];
    if (filter !== "all") list = list.filter((m) => m.status === filter);
    return filterRows(list, query, ["name", "email", "topic", "message"]);
  }, [messages, filter, query]);

  const newCount = (messages ?? []).filter((m) => m.status === "new").length;

  /** Run a mutation with the shared busy flag and a human error message. */
  const run = async (fn: () => Promise<void>, okMessage: string) => {
    setBusy(true);
    try {
      await fn();
      // An empty message means the caller reports its own outcome (the reply
      // path says whether the email actually went out).
      if (okMessage) toast.push(okMessage);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Something went wrong. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (m: AdminContactMessage, status: AdminMessageStatus) =>
    run(() => data.setMessageStatus(m.id, status).then(() => undefined), `Marked as ${status}.`);

  const sendReply = (m: AdminContactMessage) => {
    const body = replyText.trim();
    if (body.length < 2) {
      toast.push("Write a reply first.", "error");
      return;
    }
    run(async () => {
      const res = await data.replyToMessage(m.id, body);
      // The reply is stored either way; say plainly whether the email went out.
      if (res.emailStatus === "sent") toast.push(`Reply sent to ${m.email}.`);
      else if (res.emailStatus === "skipped")
        toast.push("Reply saved. Email is not configured yet, so nothing was sent.", "error");
      else toast.push(`Reply saved, but the email failed: ${res.emailReason ?? "unknown error"}`, "error");
      setReplyFor(null);
      setReplyText("");
    }, "");
  };

  const startEdit = (m: AdminContactMessage) => {
    setEditFor(m.id);
    setEditDraft({ name: m.name, email: m.email, topic: m.topic, message: m.message });
  };

  const saveEdit = (m: AdminContactMessage) => {
    if (!editDraft.name.trim() || !editDraft.email.trim() || !editDraft.message.trim()) {
      toast.push("Name, email and message are required.", "error");
      return;
    }
    run(async () => {
      await data.updateMessage(m.id, editDraft);
      setEditFor(null);
    }, "Message updated.");
  };

  const remove = (m: AdminContactMessage) => {
    if (!window.confirm(`Delete the message from ${m.name}? This cannot be undone.`)) return;
    run(() => data.deleteMessage(m.id), "Message deleted.");
  };

  const create = () => {
    if (!draft.name.trim() || !draft.email.trim() || !draft.message.trim()) {
      toast.push("Name, email and message are required.", "error");
      return;
    }
    run(async () => {
      await data.createMessage(draft);
      setDraft(EMPTY_DRAFT);
      setCreating(false);
    }, "Message added.");
  };

  return (
    <>
      <AdminPageHeader title="Messages" subtitle="Enquiries from the storefront contact form." />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["all", "new", "read", "replied"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold capitalize transition",
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
            {f === "new" && newCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-xs font-bold text-amber-950">{newCount}</span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search messages…" />
          <Btn size="sm" variant="primary" disabled={busy} onClick={() => setCreating((v) => !v)}>
            {creating ? <X className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {creating ? "Cancel" : "New message"}
          </Btn>
        </div>
      </div>

      {creating && (
        <Card className="mb-4 p-5">
          <h3 className="mb-3 text-sm font-bold text-ink">Add a message</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              placeholder="Email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <input
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm sm:col-span-2"
              placeholder="Topic"
              value={draft.topic}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
            />
            <textarea
              className="min-h-[90px] rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
              placeholder="Message"
              value={draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Btn size="sm" variant="primary" disabled={busy} onClick={create}>
              <Send className="h-3.5 w-3.5" /> Add message
            </Btn>
          </div>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="text-2xl">🐾</span>
          <h3 className="text-lg font-medium text-ink">No messages</h3>
          <p className="max-w-md text-sm text-muted-foreground">Nothing matches this filter yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => (
            <Card key={m.id} className="p-5">
              {editFor === m.id ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                  <input
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    value={editDraft.email}
                    onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                  />
                  <input
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm sm:col-span-2"
                    value={editDraft.topic}
                    onChange={(e) => setEditDraft({ ...editDraft, topic: e.target.value })}
                  />
                  <textarea
                    className="min-h-[90px] rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
                    value={editDraft.message}
                    onChange={(e) => setEditDraft({ ...editDraft, message: e.target.value })}
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <Btn size="sm" variant="primary" disabled={busy} onClick={() => saveEdit(m)}>
                      Save
                    </Btn>
                    <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setEditFor(null)}>
                      Cancel
                    </Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={m.status} kind="message" />
                    <span className="text-sm font-bold text-ink">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.email}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{m.topic}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{m.message}</p>

                  {m.replyBody && (
                    <div className="mt-3 rounded-lg border-l-[3px] border-primary/40 bg-secondary/40 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Replied{m.repliedAt ? ` · ${formatDateTime(m.repliedAt)}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{m.replyBody}</p>
                    </div>
                  )}

                  {replyFor === m.id && (
                    <div className="mt-3">
                      <textarea
                        className="min-h-[90px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder={`Reply to ${m.name}…`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="mt-2 flex gap-2">
                        <Btn size="sm" variant="primary" disabled={busy} onClick={() => sendReply(m)}>
                          <Send className="h-3.5 w-3.5" /> Send reply
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setReplyFor(null);
                            setReplyText("");
                          }}
                        >
                          Cancel
                        </Btn>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {replyFor !== m.id && (
                      <Btn
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        onClick={() => {
                          setReplyFor(m.id);
                          setReplyText("");
                        }}
                      >
                        <Reply className="h-3.5 w-3.5" /> Reply
                      </Btn>
                    )}
                    {m.status !== "read" && (
                      <Btn size="sm" variant="outline" disabled={busy} onClick={() => setStatus(m, "read")}>
                        <MailOpen className="h-3.5 w-3.5" /> Mark read
                      </Btn>
                    )}
                    {m.status !== "new" && (
                      <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(m, "new")}>
                        <Mail className="h-3.5 w-3.5" /> Mark unread
                      </Btn>
                    )}
                    <Btn size="sm" variant="outline" disabled={busy} onClick={() => startEdit(m)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Btn>
                    <Btn size="sm" variant="ghost" disabled={busy} onClick={() => remove(m)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Btn>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
