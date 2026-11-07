import { createHash, randomBytes } from "node:crypto";

/** Random URL-safe token (256 bits). The raw value is only ever sent to the user. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash is stored, so a database leak cannot be used to sign in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
