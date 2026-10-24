// Link that opens Google Calendar with the visit filled in; the person just clicks "Save".
export function googleCalendarUrl(v: { title: string; startsAt: Date; durationMin: number; place?: string | null; details?: string | null }) {
  const end = new Date(v.startsAt.getTime() + v.durationMin * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: v.title,
    dates: `${stamp(v.startsAt)}/${stamp(end)}`,
    ...(v.place && { location: v.place }),
    ...(v.details && { details: v.details }),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// 2026-10-24T17:30:00.000Z -> 20261024T173000Z
function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
