import { describe, expect, it } from "vitest";
import { currentPeriod, planFor, PLANS } from "@/shared/constants/plans";

describe("plans", () => {
  it("planFor falls back to starter for unknown ids", () => {
    expect(planFor("definitely-not-a-plan").id).toBe("starter");
    expect(planFor(undefined).id).toBe("starter");
    expect(planFor(null).id).toBe("starter");
  });

  it("PLANS contains the three expected tiers with sensible limits", () => {
    expect(PLANS.starter.runs_limit).toBeGreaterThan(0);
    expect(PLANS.pro.runs_limit).toBeGreaterThan(PLANS.starter.runs_limit);
    expect(PLANS.pro.tokens_limit).toBeGreaterThan(PLANS.starter.tokens_limit);
    expect(PLANS.enterprise.runs_limit).toBeGreaterThan(PLANS.pro.runs_limit);
  });

  it("currentPeriod produces YYYY-MM in UTC", () => {
    const p = currentPeriod(new Date(Date.UTC(2027, 0, 15, 23, 59)));
    expect(p).toBe("2027-01");
    const dec = currentPeriod(new Date(Date.UTC(2026, 11, 31, 23, 59)));
    expect(dec).toBe("2026-12");
  });
});
