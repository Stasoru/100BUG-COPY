import Link from "next/link";
import { createVisit, deleteVisit, toggleVisitDone } from "@/app/(app)/agenda/actions";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatDateTime } from "@/lib/format";

type Visit = {
  id: string;
  startsAt: Date;
  durationMin: number;
  place: string | null;
  notes: string | null;
  doneAt: Date | null;
  contact: { id: string; name: string; phone: string | null };
  deal?: { id: string; title: string } | null;
  user: { name: string } | null;
};

export function VisitList({ visits, showLinks = false }: { visits: Visit[]; showLinks?: boolean }) {
  if (!visits.length) return <p className="text-sm text-slate-500">Nenhuma visita.</p>;
  const now = new Date();
  return (
    <ul className="divide-y divide-slate-100">
      {visits.map((v) => {
        const late = !v.doneAt && v.startsAt < now;
        return (
          <li key={v.id} className="flex flex-wrap items-start gap-3 py-2 text-sm">
            <form action={toggleVisitDone.bind(null, v.id)}>
              <button
                className={`mt-0.5 h-4 w-4 rounded border ${v.doneAt ? "border-emerald-600 bg-emerald-600" : "border-slate-400"}`}
                aria-label={v.doneAt ? "Marcar como não realizada" : "Marcar como realizada"}
              />
            </form>
            <div className="min-w-0 flex-1">
              <p className={v.doneAt ? "text-slate-400 line-through" : ""}>
                <span className={late ? "font-medium text-red-600" : "font-medium"}>{formatDateTime(v.startsAt)}</span>
                {" · "}
                {showLinks ? (
                  <Link className="text-brand-700 hover:underline" href={v.deal ? `/deals/${v.deal.id}` : `/contacts/${v.contact.id}`}>
                    {v.contact.name}
                  </Link>
                ) : (
                  v.contact.name
                )}
              </p>
              <p className="text-xs text-slate-500">
                {v.durationMin} min{v.place && ` · ${v.place}`}{v.user && ` · ${v.user.name}`}
                {v.notes && ` · ${v.notes}`}
              </p>
            </div>
            <a
              className="text-xs text-brand-600 hover:underline"
              target="_blank"
              rel="noreferrer"
              href={googleCalendarUrl({
                title: `Visita: ${v.contact.name}`,
                startsAt: v.startsAt,
                durationMin: v.durationMin,
                place: v.place,
                details: [v.contact.phone && `WhatsApp: ${v.contact.phone}`, v.notes].filter(Boolean).join("\n") || null,
              })}
            >
              Google Agenda
            </a>
            <form action={deleteVisit.bind(null, v.id)}>
              <button className="text-xs text-red-600 hover:underline">excluir</button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

export function VisitForm({ hidden, members }: { hidden: Record<string, string>; members: { id: string; name: string }[] }) {
  return (
    <form action={createVisit} className="grid gap-2 sm:grid-cols-[auto_6rem_1fr_auto]">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input className="input" name="startsAt" type="datetime-local" required />
      <input className="input" name="durationMin" type="number" min={15} step={15} defaultValue={60} title="Duração (min)" />
      <input className="input" name="place" placeholder="Endereço ou local" />
      <select className="input" name="userId" defaultValue="">
        <option value="">Eu</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <input className="input sm:col-span-3" name="notes" placeholder="Observações (opcional)" />
      <button className="btn-secondary">Agendar visita</button>
    </form>
  );
}

