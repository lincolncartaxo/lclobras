import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

type AuthAction = "login" | "register";
type RateLimitBucket = { count: number; resetAt: number };

// Per-process burst protection. The map is bounded and entries expire; a shared
// store should replace it if the application is later scaled across instances.
const rateLimitBuckets = new Map<string, RateLimitBucket>();
const rateLimitPolicy: Record<
  AuthAction,
  { ipMax: number; ipWindowMs: number; emailMax: number; emailWindowMs: number }
> = {
  login: {
    ipMax: 40,
    ipWindowMs: 15 * 60 * 1000,
    emailMax: 10,
    emailWindowMs: 15 * 60 * 1000,
  },
  register: {
    ipMax: 12,
    ipWindowMs: 60 * 60 * 1000,
    emailMax: 3,
    emailWindowMs: 24 * 60 * 60 * 1000,
  },
};

export async function hashPassword(
  password: string,
  salt = randomBytes(32).toString("hex")
) {
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

export function isLocalSessionVersionValid(
  openId: string,
  currentVersion: number,
  tokenVersion: unknown
): boolean {
  if (!openId.startsWith("local_") && tokenVersion === undefined) return true;
  return (
    typeof tokenVersion === "number" &&
    Number.isSafeInteger(tokenVersion) &&
    tokenVersion === currentVersion
  );
}

function consumeBucket(key: string, limit: number, windowMs: number, now: number) {
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function pruneRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size <= 5000) return;
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
  while (rateLimitBuckets.size > 10000) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitBuckets.delete(oldestKey);
  }
}

export function isAuthAttemptAllowed(
  action: AuthAction,
  ip: string,
  email: string,
  now = Date.now()
) {
  pruneRateLimitBuckets(now);
  const policy = rateLimitPolicy[action];
  const normalizedIp = ip.trim().slice(0, 128) || "unknown";
  const emailDigest = createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex");
  const ipAllowed = consumeBucket(
    `${action}:ip:${normalizedIp}`,
    policy.ipMax,
    policy.ipWindowMs,
    now
  );
  const emailAllowed = consumeBucket(
    `${action}:email:${emailDigest}`,
    policy.emailMax,
    policy.emailWindowMs,
    now
  );
  return ipAllowed && emailAllowed;
}
