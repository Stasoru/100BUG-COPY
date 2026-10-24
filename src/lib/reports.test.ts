import { describe, expect, it } from "vitest";
import { formatDuration, leadsBy, sellerStats, type LeadRow } from "./reports";

const t0 = new Date("2026-10-01T12:00:00Z");
const row = (extra: Partial<LeadRow>): LeadRow => ({
  source: "Facebook",
  campaign: null,
  owner: "Ana",
  status: "OPEN",
  value: 0,
  createdAt: t0,
  firstContactAt: null,
  ...extra,
});

describe("leadsBy", () => {
  it("counts leads, sales and conversion per source", () => {
    const rows = [row({ status: "WON", value: 1000 }), row({}), row({ status: "LOST" }), row({ source: "Site", status: "WON", value: 50 })];
    expect(leadsBy(rows, (r) => r.source)).toEqual([
      { key: "Facebook", leads: 3, open: 1, won: 1, lost: 1, conversion: 1 / 3, revenue: 1000 },
      { key: "Site", leads: 1, open: 0, won: 1, lost: 0, conversion: 1, revenue: 50 },
    ]);
  });
});

describe("sellerStats", () => {
  it("measures response time and acceptance", () => {
    const rows = [
      row({ firstContactAt: new Date(t0.getTime() + 10 * 60_000) }),
      row({ firstContactAt: new Date(t0.getTime() + 30 * 60_000), status: "WON", value: 200 }),
      row({ owner: "Bruno" }),
    ];
    const offers = [
      { user: "Ana", status: "ACCEPTED" as const },
      { user: "Ana", status: "ACCEPTED" as const },
      { user: "Bruno", status: "EXPIRED" as const },
      { user: "Bruno", status: "ACCEPTED" as const },
    ];
    const [ana, bruno] = sellerStats(rows, offers);
    expect(ana).toMatchObject({ key: "Ana", leads: 2, offered: 2, accepted: 2, missed: 0, avgMinutesToContact: 20, won: 1, conversion: 0.5, revenue: 200 });
    expect(bruno).toMatchObject({ key: "Bruno", leads: 1, missed: 1, avgMinutesToContact: null });
  });
});

describe("formatDuration", () => {
  it("picks a readable unit", () => {
    expect(formatDuration(12.4)).toBe("12 min");
    expect(formatDuration(90)).toBe("1,5 h");
    expect(formatDuration(2880)).toBe("2,0 dias");
    expect(formatDuration(null)).toBe("—");
  });
});
