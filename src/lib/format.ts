const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// Brazil has had no daylight saving time since 2019, so São Paulo is always UTC-3.
export const TIME_ZONE = "America/Sao_Paulo";
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TIME_ZONE });
const time = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: TIME_ZONE });
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: TIME_ZONE });

export const formatMoney = (value: number | string | { toString(): string }) => currency.format(Number(value.toString()));
export const formatDateTime = (d: Date) => dateTime.format(d);
export const formatDate = (d: Date) => date.format(d);
export const formatTime = (d: Date) => time.format(d);
export const formatWeekday = (d: Date) => weekday.format(d);

// Reads a <input type="datetime-local"> value ("2026-10-24T14:30") as São Paulo time.
export function parseLocalDateTime(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null;
  const d = new Date(`${input}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Accepts "1.234,56", "1234.56" and "1234".
export function parseMoney(input: string) {
  const normalized = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

// "a, b ,c" -> ["a","b","c"], deduplicated and lowercased.
export function parseTags(input: string | null | undefined): string[] {
  if (!input) return [];
  return [...new Set(input.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

// Keeps digits only, so "+55 (11) 99999-0000" and "5511999990000" match the same contact.
export function normalizePhone(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
