import { describe, expect, it } from "vitest";
import {
  calculateBudgetProgressMetrics,
  calculateBudgetProgressTotals,
  selectProgressSnapshotAtOrBefore,
} from "../shared/budget-progress";

describe("budget physical and approved financial progress", () => {
  it("compares approved value with the physical value of a contract item", () => {
    expect(
      calculateBudgetProgressMetrics({
        contractAmount: 120_000,
        physicalPercent: 65,
        approvedAmount: 72_000,
      })
    ).toEqual({
      contractAmount: 120_000,
      physicalPercent: 65,
      physicalValue: 78_000,
      approvedAmount: 72_000,
      financialPercent: 60,
      varianceAmount: -6_000,
      variancePercentagePoints: -5,
    });
  });

  it("weights the work totals by each item's contract amount, not by item count", () => {
    expect(
      calculateBudgetProgressTotals([
        { contractAmount: 100_000, physicalPercent: 50, approvedAmount: 45_000 },
        { contractAmount: 50_000, physicalPercent: 20, approvedAmount: 5_000 },
      ])
    ).toEqual({
      contractAmount: 150_000,
      physicalValue: 60_000,
      approvedAmount: 50_000,
      varianceAmount: -10_000,
      variancePercentagePoints: -6.67,
      physicalPercent: 40,
      financialPercent: 33.33,
    });
  });

  it("handles an empty or zero-value budget without dividing by zero", () => {
    expect(calculateBudgetProgressTotals([])).toEqual({
      contractAmount: 0,
      physicalValue: 0,
      approvedAmount: 0,
      varianceAmount: 0,
      variancePercentagePoints: 0,
      physicalPercent: 0,
      financialPercent: 0,
    });
    expect(
      calculateBudgetProgressMetrics({
        contractAmount: 0,
        physicalPercent: 0,
        approvedAmount: 0,
      }).financialPercent
    ).toBe(0);
  });

  it("never prefills a historical date from a later snapshot", () => {
    const history = [
      { measurementDate: "2026-10-31", physicalPercent: 80 },
      { measurementDate: "2026-10-10", physicalPercent: 35 },
    ];

    expect(
      selectProgressSnapshotAtOrBefore(history, "2026-10-20")
    ).toEqual({ measurementDate: "2026-10-10", physicalPercent: 35 });
    expect(
      selectProgressSnapshotAtOrBefore(history, "2026-10-05")
    ).toBeNull();
    expect(
      selectProgressSnapshotAtOrBefore(history, "2026-10-31")
    ).toEqual({ measurementDate: "2026-10-31", physicalPercent: 80 });
  });
});
