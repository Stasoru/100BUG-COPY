import { describe, expect, it } from "vitest";
import { pickNext, startingServed, type Candidate } from "./queue";

const seller = (userId: string, extra: Partial<Candidate> = {}): Candidate => ({
  userId,
  weight: 1,
  active: true,
  sourceIds: [],
  served: 0,
  lastServedAt: null,
  ...extra,
});

// Runs the rotation n times, updating counters the way the app does.
function simulate(candidates: Candidate[], n: number, sourceId: string | null = null) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const next = pickNext(candidates, sourceId)!;
    next.served++;
    next.lastServedAt = new Date(i + 1);
    counts[next.userId] = (counts[next.userId] ?? 0) + 1;
  }
  return counts;
}

describe("pickNext", () => {
  it("alternates between sellers with the same weight", () => {
    expect(simulate([seller("a"), seller("b")], 10)).toEqual({ a: 5, b: 5 });
  });

  it("respects weights", () => {
    expect(simulate([seller("a", { weight: 2 }), seller("b")], 9)).toEqual({ a: 6, b: 3 });
  });

  it("skips paused sellers, excluded sellers and other sources", () => {
    const list = [seller("a", { active: false }), seller("b", { sourceIds: ["fb"] }), seller("c")];
    expect(pickNext(list, "site")?.userId).toBe("c");
    expect(pickNext(list, "fb", ["c"])?.userId).toBe("b");
    expect(pickNext(list, "site", ["c"])).toBeNull();
  });
});

describe("startingServed", () => {
  it("puts a newcomer level with the least-served seller", () => {
    expect(startingServed([{ served: 10, weight: 1, active: true }, { served: 30, weight: 2, active: true }], 1)).toBe(10);
    expect(startingServed([], 3)).toBe(0);
  });
});
