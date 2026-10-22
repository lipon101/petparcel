// Verification-token primitives. A LEAF module on purpose: no db, no env, no
// network - so both the auth layer (which mints a token inside the signup
// transaction) and the email layer (which renders the link) can share it without
// dragging a database connection into either.
import { createHash, randomBytes } from "node:crypto";

/** How long a verification link stays valid. */
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** SHA-256 of a raw token. Only the hash is ever stored, so a leaked row is not
 *  a working link. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface MintedToken {
  /** The raw token - goes in the email link and nowhere else. */
  token: string;
  /** What gets persisted. */
  tokenHash: string;
  expiresAt: Date;
}

/** Mint a fresh, high-entropy token and its stored form. */
export function mintVerificationToken(now = Date.now()): MintedToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token), expiresAt: new Date(now + VERIFICATION_TTL_MS) };
}
