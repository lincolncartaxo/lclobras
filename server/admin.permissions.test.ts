import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("admin procedures", () => {
  it("blocks non-admin accounts from the overview and account-role mutation", async () => {
    const user: NonNullable<TrpcContext["user"]> = {
      id: 42,
      openId: "regular-user",
      email: "user@example.com",
      name: "Usuário comum",
      loginMethod: "manus",
      role: "user",
      operationalRole: "administrativo",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.people.setAccountRole({ id: 42, role: "admin" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.budgetProgress.save({
        budgetItemId: 7,
        measurementDate: "2026-10-29",
        physicalPercent: 40,
        approvedAmount: 1200,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
