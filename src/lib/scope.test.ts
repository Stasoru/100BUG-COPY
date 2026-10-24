import { describe, expect, it } from "vitest";
import { buildScope } from "./scope";

const base = { companyId: "c1", userId: "u1", teamId: null };

describe("buildScope", () => {
  it("lets admins see the whole company", () => {
    const scope = buildScope({ ...base, role: "ADMIN" }, []);
    expect(scope.all).toBe(true);
    expect(scope.deal()).toEqual({ companyId: "c1" });
  });

  it("limits sellers to their own deals", () => {
    const scope = buildScope({ ...base, role: "SELLER" }, ["u2"]);
    expect(scope.userIds).toEqual(["u1"]);
    expect(scope.deal()).toEqual({ companyId: "c1", OR: [{ ownerId: { in: ["u1"] } }] });
  });

  it("gives managers their team plus unassigned work", () => {
    const scope = buildScope({ ...base, role: "MANAGER", teamId: "t1" }, ["u1", "u2", "u3"]);
    expect(scope.userIds).toEqual(["u1", "u2", "u3"]);
    expect(scope.deal()).toEqual({ companyId: "c1", OR: [{ ownerId: { in: ["u1", "u2", "u3"] } }, { ownerId: null }] });
  });
});
