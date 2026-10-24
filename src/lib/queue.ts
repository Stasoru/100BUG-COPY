export type Candidate = {
  userId: string;
  weight: number;
  active: boolean;
  sourceIds: string[];
  served: number;
  lastServedAt: Date | null;
};

export function isEligible(c: Candidate, sourceId: string | null, exclude: string[] = []) {
  if (!c.active || c.weight < 1 || exclude.includes(c.userId)) return false;
  return !c.sourceIds.length || (sourceId !== null && c.sourceIds.includes(sourceId));
}

// Weighted rotation: the seller furthest behind their share (served ÷ weight) gets the next lead.
// A seller with weight 2 ends up with twice as many leads as one with weight 1.
// Ties go to whoever waited longest.
export function pickNext(candidates: Candidate[], sourceId: string | null, exclude: string[] = []): Candidate | null {
  const eligible = candidates.filter((c) => isEligible(c, sourceId, exclude));
  eligible.sort(
    (a, b) =>
      (a.served + 1) / a.weight - (b.served + 1) / b.weight ||
      (a.lastServedAt?.getTime() ?? 0) - (b.lastServedAt?.getTime() ?? 0) ||
      a.userId.localeCompare(b.userId),
  );
  return eligible[0] ?? null;
}

// A seller who joins (or comes back) starts level with the others instead of receiving every lead
// until their count catches up.
export function startingServed(others: Pick<Candidate, "served" | "weight" | "active">[], weight: number) {
  const ratios = others.filter((o) => o.active && o.weight > 0).map((o) => o.served / o.weight);
  return ratios.length ? Math.floor(Math.min(...ratios) * weight) : 0;
}
