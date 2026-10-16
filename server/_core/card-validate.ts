import { TRPCError } from "@trpc/server";

/**
 * Card-input validation for the one place raw card data can still arrive.
 *
 * The storefront sends shoppers to NOWPayments' hosted page, so in normal use
 * card numbers never touch this server. These checks exist for the other path -
 * a direct API call to `checkout.place` - so that obviously invalid or invented
 * card data is refused at our edge instead of being accepted and passed along.
 *
 * What this is NOT: a substitute for the gateway's own authorisation. Nothing
 * here proves a card can be charged; it only proves the value is shaped like a
 * real card and is not one of the published test numbers. The gateway remains
 * the authority.
 */

/** Luhn (mod-10) checksum - the rule every card network uses. Catches the
 *  overwhelmingly common case of a mistyped digit before it reaches anyone. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * The numbers card networks publish for their own test suites, plus the classic
 * repeated-digit patterns. Every one of these passes Luhn, so a Luhn check alone
 * would wave them straight through - which is precisely how a fake order gets
 * accepted in a store that only validates the checksum.
 */
const BLOCKED_TEST_NUMBERS = new Set([
  // Visa test range
  "4111111111111111",
  "4012888888881881",
  "4222222222222",
  "4242424242424242",
  "4000056655665556",
  // Mastercard test range
  "5555555555554444",
  "5105105105105100",
  "5200828282828210",
  "5555555566666666",
  // Amex test range
  "378282246310005",
  "371449635398431",
  "378734493671000",
  // Discover test range
  "6011111111111117",
  "6011000990139424",
  // Diners Club test range
  "30569309025904",
  "38520000023237",
  // JCB test range
  "3530111333300000",
  "3566002020360505",
]);

/** Length of the CVV is brand-dependent: Amex prints 4 digits, everyone else 3. */
function cvvLength(brand: string): number {
  return brand === "amex" ? 4 : 3;
}

export function detectBrand(digits: string): string {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  if (/^(30[0-5]|36|38|39)/.test(digits)) return "diners";
  if (/^35/.test(digits)) return "jcb";
  return "unknown";
}

/** `MM/YY`, `M/YY`, `MM-YYYY` and `MMYY` all reach us from real forms; a date in
 *  the past, or absurdly far out, is not a real expiry. */
export function expiryValid(raw: string, now = new Date()): boolean {
  const cleaned = raw.replace(/\s/g, "");
  const m = cleaned.match(/^(\d{1,2})[\/\-]?(\d{2}|\d{4})$/);
  if (!m) return false;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return false;
  const yearPart = m[2];
  const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
  // A card is good through the LAST day of its expiry month.
  const endOfMonth = new Date(year, month, 1).getTime();
  if (endOfMonth <= now.getTime()) return false;
  // Guard against a typo like 12/99 being read as a legitimate far-future date.
  const maxYears = now.getFullYear() + 20;
  return year <= maxYears;
}

export function cvvValid(raw: string, brand: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === cvvLength(brand);
}

export interface CardInput {
  number?: string;
  expiry?: string;
  cvv?: string;
}

export interface CardChecks {
  digits: string;
  brand: string;
  luhn: boolean;
  testNumber: boolean;
  expiryOk: boolean;
  cvvOk: boolean;
}

/** Normalise and test a card group without throwing - useful for tests and for
 *  reporting exactly which part was wrong. */
export function inspectCard(card: CardInput, now = new Date()): CardChecks {
  const digits = (card.number ?? "").replace(/\D/g, "");
  const brand = detectBrand(digits);
  return {
    digits,
    brand,
    luhn: luhnValid(digits),
    testNumber: BLOCKED_TEST_NUMBERS.has(digits),
    expiryOk: expiryValid(card.expiry ?? "", now),
    cvvOk: cvvValid(card.cvv ?? "", brand),
  };
}

/**
 * Reject card data that cannot be a real card. A fully absent group is fine -
 * that is the hosted-checkout path, where the shopper types their card on the
 * gateway's page and we never see it.
 */
export function assertCardDetailsAcceptable(card: CardInput | null | undefined): void {
  if (!card || (!card.number && !card.expiry && !card.cvv)) return;

  const r = inspectCard(card);

  if (r.testNumber) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That card number is a published test card. Enter a real card to place an order.",
    });
  }
  if (!r.luhn) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That card number doesn't look right. Check the digits and try again.",
    });
  }
  if (!r.expiryOk) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That expiry date isn't valid. Use MM/YY and make sure it hasn't passed.",
    });
  }
  if (!r.cvvOk) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        r.brand === "amex"
          ? "The security code on an American Express card is 4 digits."
          : "That security code doesn't look right - it's the 3 digits on the back of the card.",
    });
  }
}
