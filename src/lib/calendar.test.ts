import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "./calendar";
import { parseLocalDateTime } from "./format";

describe("googleCalendarUrl", () => {
  it("builds a prefilled event in UTC", () => {
    const url = new URL(googleCalendarUrl({ title: "Visita: Ana", startsAt: new Date("2026-10-24T17:30:00Z"), durationMin: 90, place: "Rua A, 10" }));
    expect(url.searchParams.get("dates")).toBe("20261024T173000Z/20261024T190000Z");
    expect(url.searchParams.get("text")).toBe("Visita: Ana");
    expect(url.searchParams.get("location")).toBe("Rua A, 10");
    expect(url.searchParams.has("details")).toBe(false);
  });
});

describe("parseLocalDateTime", () => {
  it("reads form input as São Paulo time", () => {
    expect(parseLocalDateTime("2026-10-24T14:30")?.toISOString()).toBe("2026-10-24T17:30:00.000Z");
    expect(parseLocalDateTime("")).toBeNull();
    expect(parseLocalDateTime("ontem")).toBeNull();
  });
});
