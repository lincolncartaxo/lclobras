import { describe, expect, it } from "vitest";
import {
  hashPassword,
  isAuthAttemptAllowed,
  isLocalSessionVersionValid,
  normalizeEmail,
  verifyPassword,
} from "./_core/localAuth";

describe("local password authentication", () => {
  it("hashes and verifies a password without storing it in plain text", async () => {
    const password = "Senha-segura-123";
    const credentials = await hashPassword(password);

    expect(credentials.hash).not.toBe(password);
    expect(credentials.salt).toHaveLength(64);
    await expect(verifyPassword(password, credentials.hash, credentials.salt)).resolves.toBe(true);
    await expect(verifyPassword("senha-errada", credentials.hash, credentials.salt)).resolves.toBe(false);
  });

  it("normalizes e-mails before applying per-account limits", () => {
    const now = Date.now();
    const email = `rate-limit-${now}@example.test`;
    expect(normalizeEmail(`  ${email.toUpperCase()}  `)).toBe(email);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(isAuthAttemptAllowed("login", `ip-${now}`, email.toUpperCase(), now)).toBe(true);
    }
    expect(isAuthAttemptAllowed("login", `ip-${now}`, email, now)).toBe(false);
    expect(
      isAuthAttemptAllowed("login", `ip-${now}`, email, now + 15 * 60 * 1000 + 1)
    ).toBe(true);
  });

  it("limits account requests by IP and e-mail without permanent lockout", () => {
    const now = Date.now();
    const email = `registration-${now}@example.test`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(isAuthAttemptAllowed("register", `ip-${now}`, email, now)).toBe(true);
    }
    expect(isAuthAttemptAllowed("register", `ip-${now}`, email, now)).toBe(false);
    expect(
      isAuthAttemptAllowed("register", `ip-${now}`, email, now + 24 * 60 * 60 * 1000 + 1)
    ).toBe(true);
  });

  it("keeps a previously issued local token invalid after rejection and reapproval", () => {
    const openId = "local_account_123";
    const oldTokenVersion = 4;
    const rejectedVersion = 5;
    const reapprovedVersion = 6;

    expect(
      isLocalSessionVersionValid(openId, rejectedVersion, oldTokenVersion)
    ).toBe(false);
    expect(
      isLocalSessionVersionValid(openId, reapprovedVersion, oldTokenVersion)
    ).toBe(false);
    expect(
      isLocalSessionVersionValid(openId, reapprovedVersion, reapprovedVersion)
    ).toBe(true);
  });

  it("requires a version on local sessions while preserving unversioned Manus sessions", () => {
    expect(isLocalSessionVersionValid("local_account_456", 0, undefined)).toBe(
      false
    );
    expect(isLocalSessionVersionValid("manus_open_id", 0, undefined)).toBe(
      true
    );
    expect(isLocalSessionVersionValid("manus_open_id", 2, 1)).toBe(false);
    expect(isLocalSessionVersionValid("manus_open_id", 2, 2)).toBe(true);
  });
});
