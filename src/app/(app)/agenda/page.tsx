import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { VisitList } from "@/components/visit-list";
import { db } from "@/lib/db";
import { formatWeekday } from "@/lib/format";
import { requireScope } from "@/lib/scope";

const DAY = 86_400_000;

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { user, scope } = await requireScope();
  const { f } = await searchParams;
  const mine = user.role === "SELLER" || f !== "team";
  const base: Prisma.VisitWhereInput = mine ? { companyId: user.companyId, userId: user.userId } : scope.visit();
  const now = new Date();
  const include = { contact: true, deal: { select: { id: true, title: true } }, user: { select: { name: true } } } as const;

  const [late, upcoming] = await Promise.all([
    db.visit.findMany({ where: { ...base, doneAt: null, startsAt: { lt: now, gte: new Date(now.getTime() - 30 * DAY) } }, include, orderBy: { startsAt: "asc" } }),
    db.visit.findMany({ where: { ...base, startsAt: { gte: now, lt: new Date(now.getTime() + 14 * DAY) } }, include, orderBy: { startsAt: "asc" } }),
  ]);
  const days = new Map<string, typeof upcoming>();
  for (const v of upcoming) {
    const key = formatWeekday(v.startsAt);
    days.set(key, [...(days.get(key) ?? []), v]);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Agenda de visitas">
        {user.role !== "SELLER" && (
          <>
            <Link href="/agenda" className={mine ? "btn" : "btn-secondary"}>Minhas</Link>
            <Link href="/agenda?f=team" className={!mine ? "btn" : "btn-secondary"}>Da equipe</Link>
          </>
        )}
      </PageHeader>
      <p className="text-sm text-slate-500">Agende visitas na página de cada negócio. Use &quot;Google Agenda&quot; para salvar a visita no seu calendário.</p>
      {late.length > 0 && (
        <section className="card border-red-200">
          <h2 className="mb-2 font-semibold text-red-700">Visitas passadas sem conclusão</h2>
          <VisitList visits={late} showLinks />
        </section>
      )}
      {[...days.entries()].map(([day, visits]) => (
        <section key={day} className="card">
          <h2 className="mb-2 font-semibold capitalize">{day}</h2>
          <VisitList visits={visits} showLinks />
        </section>
      ))}
      {!days.size && <p className="card text-sm text-slate-500">Nenhuma visita nos próximos 14 dias.</p>}
    </div>
  );
}
