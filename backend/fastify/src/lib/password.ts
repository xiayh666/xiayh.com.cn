import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function verifyPassword(candidate: string, configured: string): Promise<boolean> {
  if (!configured) return false;

  if (!configured.startsWith("scrypt$")) {
    const left = Buffer.from(candidate);
    const right = Buffer.from(configured);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  const [, saltHex, hashHex] = configured.split("$");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(candidate, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}
