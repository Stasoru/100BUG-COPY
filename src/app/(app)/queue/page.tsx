import Link from "next/link";
import { headers } from "next/headers";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { expireAssignments } from "@/lib/distribution";
import { formatDateTime, formatTime } from "@/lib/format";
import { listMembers } from "@/lib/members";
import { requireScope } from "@/lib/scope";
import {
  acceptLead,
  addLeadManually,
  addToQueue,
  createLeadSource,
  declineLead,
  deleteLeadSource,
  redistribute,
  removeFromQueue,
  setAcceptMinutes,
  toggleLeadSource,
  updateQueueMember,
} from "./actions";

const STATUS_LABEL = { PENDING: "Aguardando", ACCEPTED: "Aceito", DECLINED: "Recusado", EXPIRED: "Expirou" } as const;
const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-red-100 text-red-700",
} as const;

export default async function QueuePage() {
  const { user, scope } = await requireScope();
  await expireAssignments(user.companyId);
  const manager = user.role !== "SELLER";

  const pending = await db.leadAssignment.findMany({
    where: { companyId: user.companyId, userId: user.userId, status: "PENDING" },
    include: { deal: { include: { contact: true, leadSource: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={15} />
      <PageHeader title="Fila de leads" />

      <section className="card space-y-3">
        <h2 className="font-semibold">Aguardando você</h2>
        {pending.length ? (
          <ul className="divide-y divide-slate-100">
            {pending.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">{a.deal.contact.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.deal.contact.phone ?? a.deal.contact.email}
                    {a.deal.leadSource && ` · ${a.deal.leadSource.name}`}
                    {a.deal.campaign && ` · ${a.deal.campaign}`}
                  </p>
                  {a.expiresAt && <p className="text-xs font-medium text-amber-700">Aceite até {formatTime(a.expiresAt)}</p>}
                </div>
                <div className="flex gap-2">
                  <form action={acceptLead.bind(null, a.id)}>
                    <button className="btn bg-emerald-600 hover:bg-emerald-700">Aceitar</button>
                  </form>
                  <form action={declineLead.bind(null, a.id)}>
                    <button className="btn-secondary">Recusar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nenhum lead esperando por você agora. Esta página se atualiza sozinha.</p>
        )}
      </section>

      {manager && <ManagerSections companyId={user.companyId} isAdmin={user.role === "ADMIN"} visibleUserIds={scope.userIds} />}
    </div>
  );
}

async function ManagerSections({ companyId, isAdmin, visibleUserIds }: { companyId: string; isAdmin: boolean; visibleUserIds: string[] | null }) {
  const [company, members, queue, sources, pipelines, recent, orphans] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
    listMembers(companyId),
    db.queueMember.findMany({ where: { companyId }, include: { user: true }, orderBy: { user: { name: "asc" } } }),
    db.leadSource.findMany({ where: { companyId }, include: { pipeline: true, _count: { select: { deals: true } } }, orderBy: { createdAt: "asc" } }),
    db.pipeline.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    db.leadAssignment.findMany({
      where: { companyId, ...(visibleUserIds && { userId: { in: visibleUserIds } }) },
      include: { user: true, deal: { include: { contact: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.deal.findMany({
      where: { companyId, status: "OPEN", ownerId: null, leadSourceId: { not: null } },
      include: { contact: true, leadSource: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const outside = members.filter((m) => !queue.some((q) => q.userId === m.id));

  return (
    <>
      {orphans.length > 0 && (
        <section className="card space-y-3 border-amber-300">
          <h2 className="font-semibold">Leads sem responsável</h2>
          <p className="text-xs text-slate-500">Ninguém da fila pôde atender estes leads. Distribua de novo ou escolha o responsável no negócio.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {orphans.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link className="font-medium text-brand-700 hover:underline" href={`/deals/${d.id}`}>{d.contact.name}</Link>
                <span className="text-xs text-slate-500">{d.leadSource?.name} · {formatDateTime(d.createdAt)}</span>
                <form action={redistribute.bind(null, d.id)}>
                  <button className="btn-secondary py-1">Distribuir de novo</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Vendedores na roleta</h2>
          <p className="text-xs text-slate-500">
            Cada lead vai para quem está mais atrás na sua cota. Peso 2 recebe o dobro de leads de peso 1. Sem origens marcadas, o
            vendedor recebe de todas.
          </p>
          <div className="space-y-2">
            {queue.map((q) => (
              <form key={q.id} action={updateQueueMember.bind(null, q.id)} className="flex flex-wrap items-center gap-3 rounded border border-slate-200 p-2 text-sm">
                <span className="w-40 font-medium">
                  {q.user.name}
                  {!q.user.phone && <span className="block text-[11px] font-normal text-amber-700">sem WhatsApp para avisos</span>}
                </span>
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="active" defaultChecked={q.active} /> ativo
                </label>
                <label className="flex items-center gap-1">
                  peso <input className="input w-16 py-1" name="weight" type="number" min={1} max={10} defaultValue={q.weight} />
                </label>
                {sources.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="sourceIds" value={s.id} defaultChecked={q.sourceIds.includes(s.id)} /> {s.name}
                  </label>
                ))}
                <span className="text-xs text-slate-500">{q.served} leads</span>
                <button className="btn-secondary ml-auto py-1">Salvar</button>
                <button formAction={removeFromQueue.bind(null, q.id)} className="text-xs text-red-600 hover:underline">tirar</button>
              </form>
            ))}
            {!queue.length && <p className="text-sm text-slate-500">Ninguém na roleta ainda. Sem vendedores aqui, os leads ficam sem responsável.</p>}
          </div>
          {outside.length > 0 && (
            <form action={addToQueue} className="flex flex-wrap gap-2">
              <select className="input max-w-xs" name="userId">
                {outside.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input className="input w-20" name="weight" type="number" min={1} max={10} defaultValue={1} />
              <button className="btn-secondary">Colocar na roleta</button>
            </form>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Tempo para aceitar</h2>
          <p className="text-xs text-slate-500">
            Se o vendedor não aceitar dentro do prazo, o lead passa para o próximo. Use 0 para entregar direto, sem precisar aceitar.
          </p>
          <form action={setAcceptMinutes} className="flex items-center gap-2 text-sm">
            <input className="input w-24" name="acceptMinutes" type="number" min={0} max={1440} defaultValue={company.acceptMinutes} /> minutos
            <button className="btn-secondary">Salvar</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Cadastrar lead à mão</h2>
          {sources.length ? (
            <form action={addLeadManually} className="grid gap-2 sm:grid-cols-2">
              <input className="input" name="nome" placeholder="Nome" required />
              <input className="input" name="telefone" placeholder="WhatsApp" />
              <input className="input" name="email" type="email" placeholder="E-mail" />
              <input className="input" name="campanha" placeholder="Campanha (opcional)" />
              <select className="input" name="sourceId">
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button className="btn">Enviar para a roleta</button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Crie uma origem de leads primeiro.</p>
          )}
        </section>

        {isAdmin && (
          <section className="card space-y-3 lg:col-span-2">
            <h2 className="font-semibold">Origens de leads</h2>
            <p className="text-xs text-slate-500">
              Cada origem tem um endereço próprio. Configure no Zapier, no Make, no formulário do seu site ou no portal para enviar os
              leads (POST em JSON ou formulário) para ele. Campos aceitos: nome, telefone, email, campanha e mensagem, inclusive os
              nomes usados pelos formulários do Facebook.
            </p>
            <ul className="space-y-2 text-sm">
              {sources.map((s) => (
                <li key={s.id} className="rounded border border-slate-200 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {s.name} <span className="font-normal text-slate-500">→ {s.pipeline.name} · {s._count.deals} leads</span>
                      {!s.active && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-600">pausada</span>}
                    </span>
                    <span className="flex gap-3">
                      <form action={toggleLeadSource.bind(null, s.id)}>
                        <button className="text-xs text-brand-600 hover:underline">{s.active ? "pausar" : "ativar"}</button>
                      </form>
                      <form action={deleteLeadSource.bind(null, s.id)}>
                        <button className="text-xs text-red-600 hover:underline">excluir</button>
                      </form>
                    </span>
                  </div>
                  <p className="mt-1 break-all rounded bg-slate-50 px-2 py-1 font-mono text-xs">{origin}/api/webhooks/leads/{s.token}</p>
                </li>
              ))}
            </ul>
            <form action={createLeadSource} className="flex flex-wrap gap-2">
              <input className="input max-w-xs" name="name" placeholder="Nome (ex.: Facebook, Site, Portal)" required />
              <select className="input max-w-xs" name="pipelineId">
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button className="btn-secondary">Criar origem</button>
            </form>
          </section>
        )}

        <section className="card space-y-3 overflow-x-auto lg:col-span-2">
          <h2 className="font-semibold">Últimas distribuições</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1">Quando</th>
                <th className="py-1">Lead</th>
                <th className="py-1">Vendedor</th>
                <th className="py-1">Situação</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-1">{formatDateTime(a.createdAt)}</td>
                  <td className="py-1">
                    <Link className="text-brand-700 hover:underline" href={`/deals/${a.dealId}`}>{a.deal.contact.name}</Link>
                  </td>
                  <td className="py-1">{a.user.name}</td>
                  <td className="py-1">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </td>
                </tr>
              ))}
              {!recent.length && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">Nenhum lead distribuído ainda.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
