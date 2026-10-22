// Persist Resend webhook events into `email_events`.
//
// Kept separate from the pure verifier (`_core/resend-webhook.ts`) so the
// security rule stays testable without a database, and separate from the route
// so the write can be exercised on its own.
//
// IDEMPOTENT: Svix retries a delivery until it gets a 2xx, so the same event
// can arrive more than once. `svix_id` is UNIQUE and the insert uses
// ON CONFLICT DO NOTHING, so a retry is a no-op rather than a duplicate row.
//
// NEVER THROWS: a webhook that cannot be recorded must still be ACKed (2xx) so
// Svix does not retry forever - the failure is logged server-side and the
// caller answers 200. The alternative (500) turns a transient DB blip into an
// unbounded retry storm.
import { db } from "../_core/db";
import { emailEvents } from "../../drizzle/schema";
import type { ResendEventRecord } from "../_core/resend-webhook";

export interface RecordResult {
  /** true when a new row was written; false when it was a duplicate (retry). */
  inserted: boolean;
  /** Set when the write failed; the event was still ACKed. */
  error?: string;
}

/**
 * Record one webhook event. Returns whether a row was written, and never throws.
 *
 * `onConflictDoNothing` on the unique `svix_id` makes a Svix retry idempotent.
 * Drizzle's `.returning()` yields the inserted row(s); an empty array means the
 * conflict path was taken (already recorded).
 */
export async function recordEmailEvent(record: ResendEventRecord): Promise<RecordResult> {
  try {
    const rows = await db
      .insert(emailEvents)
      .values({
        svixId: record.svixId,
        type: record.type,
        providerMessageId: record.providerMessageId,
        toEmail: record.toEmail,
        fromEmail: record.fromEmail,
        subject: record.subject,
        reason: record.reason,
        occurredAt: record.occurredAt,
      })
      .onConflictDoNothing({ target: emailEvents.svixId })
      .returning({ id: emailEvents.id });
    return { inserted: rows.length > 0 };
  } catch (e) {
    // Log the type + svix id only - never the payload (it can carry addresses).
    // eslint-disable-next-line no-console
    console.warn(
      `[email-events] could not record ${record.type} (${record.svixId}): ${(e as Error).message}`,
    );
    return { inserted: false, error: (e as Error).message };
  }
}
