export type LeadRow = {
  source: string | null;
  campaign: string | null;
  owner: string | null;
  status: "OPEN" | "WON" | "LOST";
  value: number;
  createdAt: Date;
  firstContactAt: Date | null;
};

export type OfferRow = { user: string; status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" };

export type LeadGroup = { key: string; leads: number; open: number; won: number; lost: number; conversion: number; revenue: number };

// Marketing view: what each source or campaign brought, from lead to sale.
export function leadsBy(rows: LeadRow[], keyOf: (r: LeadRow) => string | null): LeadGroup[] {
  const groups = new Map<string, LeadGroup>();
  for (const r of rows) {
    const key = keyOf(r) || "Sem informação";
    const g = groups.get(key) ?? { key, leads: 0, open: 0, won: 0, lost: 0, conversion: 0, revenue: 0 };
    g.leads++;
    if (r.status === "OPEN") g.open++;
    if (r.status === "WON") {
      g.won++;
      g.revenue += r.value;
    }
    if (r.status === "LOST") g.lost++;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, conversion: g.leads ? g.won / g.leads : 0 })).sort((a, b) => b.leads - a.leads);
}

export type SellerStats = {
  key: string;
  offered: number;
  accepted: number;
  missed: number;
  leads: number;
  contacted: number;
  avgMinutesToContact: number | null;
  won: number;
  conversion: number;
  revenue: number;
};

// Team view: how fast and how well each seller works the leads they get.
export function sellerStats(rows: LeadRow[], offers: OfferRow[]): SellerStats[] {
  const names = new Set([...rows.map((r) => r.owner).filter((o): o is string => !!o), ...offers.map((o) => o.user)]);
  return [...names]
    .map((key) => {
      const mine = rows.filter((r) => r.owner === key);
      const myOffers = offers.filter((o) => o.user === key);
      const minutes = mine.filter((r) => r.firstContactAt).map((r) => (r.firstContactAt!.getTime() - r.createdAt.getTime()) / 60_000);
      const won = mine.filter((r) => r.status === "WON");
      return {
        key,
        offered: myOffers.length,
        accepted: myOffers.filter((o) => o.status === "ACCEPTED").length,
        missed: myOffers.filter((o) => o.status === "DECLINED" || o.status === "EXPIRED").length,
        leads: mine.length,
        contacted: minutes.length,
        avgMinutesToContact: minutes.length ? minutes.reduce((a, b) => a + b, 0) / minutes.length : null,
        won: won.length,
        conversion: mine.length ? won.length / mine.length : 0,
        revenue: won.reduce((acc, r) => acc + r.value, 0),
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export function formatDuration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1).replace(".", ",")} h`;
  return `${(minutes / 1440).toFixed(1).replace(".", ",")} dias`;
}
