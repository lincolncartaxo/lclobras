import { describe, expect, it } from "vitest";
import { isCalendarDate } from "../shared/date-utils";

describe("isCalendarDate", () => {
  it("accepts valid ISO dates, including leap days", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-10-31")).toBe(true);
  });

  it("rejects impossible dates and non-ISO values", () => {
    expect(isCalendarDate("2023-02-29")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("31/10/2026")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });
});
