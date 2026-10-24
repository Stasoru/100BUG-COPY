import { PageHeader } from "@/components/page-header";
import { PipelineTemplateSelect } from "@/components/pipeline-template-select";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addCompany, switchCompany } from "./actions";

const ROLE_LABEL = { ADMIN: "Administrador", MANAGER: "Gestor", SELLER: "Vendedor" } as const;

export default async function CompaniesPage() {
  const user = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.userId },
    include: { company: { include: { _count: { select: { deals: true, memberships: true } } } } },
    orderBy: { company: { name: "asc" } },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Minhas empresas" />
      <p className="text-sm text-slate-600">
        Cada empresa tem seus próprios funis, leads, equipe e configurações. Troque de empresa a qualquer momento.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((m) => (
          <li key={m.id} className={`card space-y-2 ${m.companyId === user.companyId ? "border-brand-500" : ""}`}>
            <p className="font-semibold">{m.company.name}</p>
            <p className="text-xs text-slate-500">
              {ROLE_LABEL[m.role]} · {m.company._count.memberships} pessoas · {m.company._count.deals} negócios
            </p>
            {m.companyId === user.companyId ? (
              <p className="text-xs font-medium text-brand-700">Você está aqui</p>
            ) : (
              <form action={switchCompany}>
                <input type="hidden" name="companyId" value={m.companyId} />
                <button className="btn-secondary py-1">Entrar nesta empresa</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <section className="card max-w-xl space-y-3">
        <h2 className="font-semibold">Nova empresa</h2>
        <form action={addCompany} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input className="input" name="name" placeholder="Nome da empresa" required />
          <PipelineTemplateSelect />
          <button className="btn">Criar</button>
        </form>
      </section>
    </div>
  );
}
