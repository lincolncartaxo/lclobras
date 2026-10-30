import { describe, expect, it } from "vitest";
import { calculateWorkFinanceMetrics } from "./finance";

const records = [
  { id: 1, module: "contas-pagar", workId: 7, amount: 80 },
  { id: 2, module: "contas-pagar", workId: 7, amount: 20 },
  { id: 3, module: "contas-receber", workId: 7, amount: 100 },
  { id: 4, module: "contas-pagar", workId: 8, amount: 50 },
];

const settlements = [
  { recordId: 1, amount: 20, paidByCentral: true },
  { recordId: 1, amount: 10, paidByCentral: false },
  { recordId: 2, amount: 15, paidByCentral: false },
  { recordId: 3, amount: 60, paidByCentral: false },
  { recordId: 3, amount: 30, paidByCentral: false },
  { recordId: 4, amount: 50, paidByCentral: true },
];

describe("calculateWorkFinanceMetrics", () => {
  it("subtracts all paid work expenses, including central-paid expenses, once", () => {
    expect(calculateWorkFinanceMetrics(200, 7, records, settlements)).toEqual({
      received: 90,
      settledCosts: 45,
      centralPaidCosts: 20,
      cashBalance: 45,
      totalCosts: 100,
      profit: 100,
    });
  });

  it("does not include another work's settlements or office overhead", () => {
    const officePayable = {
      id: 5,
      module: "contas-pagar",
      workId: null,
      amount: 40,
    };
    expect(
      calculateWorkFinanceMetrics(200, 7, [...records, officePayable], settlements)
    ).toMatchObject({
      settledCosts: 45,
      centralPaidCosts: 20,
      cashBalance: 45,
      totalCosts: 100,
      profit: 100,
    });
  });
});
