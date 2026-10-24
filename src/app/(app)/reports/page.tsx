import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { formatDuration, leadsBy, sellerStats, type LeadGroup, type LeadRow } from "@/lib/reports";
import { requireScope } from "@/lib/scope";

const PERIODS = { "7": "7 dias", "30": "30 dias", "90": "90 dias", all: "Tudo" } as const;
const DAY = 86_400_000;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { user, scope } = await requireScope();
  const { period: raw } = await searchParams;
  const period = (raw && raw in PERIODS ? raw : "30") as keyof typeof PERIODS;
  const since = period === "all" ? undefined : new Date(Date.now() - Number(period) * DAY);

  const [deals, offers] = await Promise.all([
    db.deal.findMany({
      where: { ...scope.deal(), leadSourceId: { not: null }, ...(since && { createdAt: { gte: since } }) },
      include: { leadSource: { select: { name: true } }, owner: { select: { name: true } } },
    }),
    db.leadAssignment.findMany({
      where: { companyId: user.companyId, ...(scope.userIds && { userId: { in: scope.userIds } }), ...(since && { createdAt: { gte: since } }) },
      include: { user: { select: { name: true } } },
    }),
  ]);
  const rows: LeadRow[] = deals.map((d) => ({
    source: d.leadSource?.name ?? null,
    campaign: d.campaign,
    owner: d.owner?.name ?? null,
    status: d.status,
    value: Number(d.value),
    createdAt: d.createdAt,
    firstContactAt: d.firstContactAt,
  }));
  const sellers = sellerStats(rows, offers.map((o) => ({ user: o.user.name, status: o.status })));
  const total = leadsBy(rows, () => "Total")[0];
  const contacted = rows.filter((r) => r.firstContactAt);
  const avgContact = contacted.length
    ? contacted.reduce((acc, r) => acc + (r.firstContactAt!.getTime() - r.createdAt.getTime()) / 60_000, 0) / contacted.length
    : null;

  const kpis = [
    { label: "Leads recebidos", value: String(total?.leads ?? 0) },
    { label: "Vendas", value: String(total?.won ?? 0), hint: formatMoney(total?.revenue ?? 0) },
    { label: "Conversão", value: pct(total?.conversion ?? 0), hint: "vendas ÷ leads" },
    { label: "Tempo até o 1º contato", value: formatDuration(avgContact), hint: "média" },
    { label: "Sem contato ainda", value: String(rows.filter((r) => r.status === "OPEN" && !r.firstContactAt).length) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Relatórios">
        {Object.entries(PERIODS).map(([k, label]) => (
          <Link key={k} href={`/reports?period=${k}`} className={k === period ? "btn" : "btn-secondary"}>{label}</Link>
        ))}
      </PageHeader>
      <p className="text-sm text-slate-500">Considera os leads que chegaram pelas origens de leads no período.</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="text-xl font-semibold">{k.value}</p>
            {k.hint && <p className="text-xs text-slate-400">{k.hint}</p>}
          </div>
        ))}
      </div>

      <h2 className="pt-2 text-lg font-semibold">Marketing</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <LeadTable title="Por origem" rows={leadsBy(rows, (r) => r.source)} />
        <LeadTable title="Por campanha" rows={leadsBy(rows, (r) => r.campaign)} />
      </div>

      <h2 className="pt-2 text-lg font-semibold">Equipe</h2>
      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1">Vendedor</th>
              <th className="py-1 text-right">Ofertas da fila</th>
              <th className="py-1 text-right">Aceitas</th>
              <th className="py-1 text-right">Perdidas na fila</th>
              <th className="py-1 text-right">Leads</th>
              <th className="py-1 text-right">Tempo até o 1º contato</th>
              <th className="py-1 text-right">Vendas</th>
              <th className="py-1 text-right">Conversão</th>
              <th className="py-1 text-right">Receita</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s) => (
              <tr key={s.key} className="border-t border-slate-100">
                <td className="py-1">{s.key}</td>
                <td className="py-1 text-right">{s.offered}</td>
                <td className="py-1 text-right">{s.accepted}</td>
                <td className={`py-1 text-right ${s.missed ? "text-red-600" : ""}`}>{s.missed}</td>
                <td className="py-1 text-right">{s.leads}</td>
                <td className="py-1 text-right">{formatDuration(s.avgMinutesToContact)}</td>
                <td className="py-1 text-right">{s.won}</td>
                <td className="py-1 text-right">{pct(s.conversion)}</td>
                <td className="py-1 text-right">{formatMoney(s.revenue)}</td>
              </tr>
            ))}
            {!sellers.length && (
              <tr><td colSpan={9} className="py-4 text-center text-slate-500">Sem dados no período.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function LeadTable({ title, rows }: { title: string; rows: LeadGroup[] }) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <section className="card overflow-x-auto">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr>
            <th className="py-1">Nome</th>
            <th className="py-1">Leads</th>
            <th className="py-1 text-right">Vendas</th>
            <th className="py-1 text-right">Conversão</th>
            <th className="py-1 text-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100">
              <td className="py-1">{r.key}</td>
              <td className="py-1">
                <span className="flex items-center gap-2">
                  <span className="h-2 rounded bg-brand-500" style={{ width: `${(r.leads / max) * 4}rem` }} />
                  {r.leads}
                </span>
              </td>
              <td className="py-1 text-right">{r.won}</td>
              <td className="py-1 text-right">{pct(r.conversion)}</td>
              <td className="py-1 text-right">{formatMoney(r.revenue)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={5} className="py-4 text-center text-slate-500">Sem leads no período.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
