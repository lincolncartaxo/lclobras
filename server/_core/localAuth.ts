import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string, salt = randomBytes(32).toString("hex")) {
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return { hash: derivedKey.toString("hex"), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
