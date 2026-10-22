#!/usr/bin/env tsx
// Send a test notification to the owner's Telegram chat.
//
// WHY THIS EXISTS. The token, the chat id and the bot's membership of the
// channel are three separate things to get right, and every one of them fails
// SILENTLY from the store's point of view - the store just never gets a
// notification, which you only discover by missing a real sale. This script
// proves all three BEFORE the first order, and prints a specific reason for
// each failure instead of a generic error.
//
// USAGE
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... pnpm tsx scripts/send-telegram-test.ts
// or, with both set in the environment already:
//   pnpm tsx scripts/send-telegram-test.ts
//
// It reads NO order and touches NO database row, so it is safe to run against
// production at any time.
import { isTelegramConfigured, sendTelegramTestMessage } from "../server/services/telegram";

async function main() {
  if (!isTelegramConfigured()) {
    console.error(
      [
        "Telegram is not configured - nothing was sent.",
        "",
        "Set BOTH of these, then run this again:",
        "  TELEGRAM_BOT_TOKEN  from @BotFather (/newbot, or /mybots -> API Token)",
        "  TELEGRAM_CHAT_ID    the numeric chat id (see the docs for how to read it",
        "                      from https://api.telegram.org/bot<TOKEN>/getUpdates)",
        "",
        "In production they go in Vercel: Project -> Settings -> Environment Variables.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const result = await sendTelegramTestMessage();
  if (result.status === "sent") {
    console.log(
      `Test notification delivered (message id ${result.messageId ?? "unknown"}). ` +
        "Check the chat - if it arrived, every paid order will too.",
    );
    return;
  }

  console.error(`Test notification FAILED: ${result.reason ?? result.status}`);
  console.error(
    [
      "",
      "The most common causes, by the error Telegram returned:",
      "  'chat not found'      TELEGRAM_CHAT_ID is wrong, or the bot has never been",
      "                        messaged / added to that chat.",
      "  'not enough rights'   The bot is not an ADMIN of the channel. A bot cannot",
      "                        post to a channel it only belongs to.",
      "  'Unauthorized'        TELEGRAM_BOT_TOKEN is wrong or has been revoked.",
      "  'can't parse entities' A product name reached the message unescaped - a bug,",
      "                        please report it (services/telegram.ts escapes all",
      "                        interpolated values).",
    ].join("\n"),
  );
  process.exitCode = 1;
}

void main();
