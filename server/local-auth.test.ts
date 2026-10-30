import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./_core/localAuth";

describe("local password authentication", () => {
  it("hashes and verifies a password without storing it in plain text", async () => {
    const password = "Senha-segura-123";
    const credentials = await hashPassword(password);

    expect(credentials.hash).not.toBe(password);
    expect(credentials.salt).toHaveLength(64);
    await expect(verifyPassword(password, credentials.hash, credentials.salt)).resolves.toBe(true);
    await expect(verifyPassword("senha-errada", credentials.hash, credentials.salt)).resolves.toBe(false);
  });
});
