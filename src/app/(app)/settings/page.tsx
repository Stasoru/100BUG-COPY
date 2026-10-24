import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { listMembers } from "@/lib/members";
import {
  addChannel,
  addMember,
  addProduct,
  createTeam,
  deleteChannel,
  deleteProduct,
  deleteTeam,
  removeMember,
  renameCompany,
  updateMember,
  updateProfile,
} from "./actions";



export default async function SettingsPage() {
  const user = await requireUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.userId } });
  const profile = (
    <section className="card space-y-3">
      <h2 className="font-semibold">Meu perfil</h2>
      <form action={updateProfile} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" name="name" defaultValue={me.name} required />
        <input className="input" name="phone" defaultValue={me.phone ?? ""} placeholder="Seu WhatsApp (recebe os avisos de lead)" />
        <button className="btn-secondary">Salvar</button>
      </form>
    </section>
  );
  if (user.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <PageHeader title="Configurações" />
        {profile}
        <p className="text-sm text-slate-600">As demais configurações da empresa ficam com os administradores.</p>
      </div>
    );
  }
  const [members, teams, products, channels] = await Promise.all([
    listMembers(user.companyId),
    db.team.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    db.channel.findMany({ where: { companyId: user.companyId }, orderBy: { createdAt: "asc" } }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" />
      {profile}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">Empresa</h2>
          <form action={renameCompany} className="flex gap-2">
            <input className="input" name="name" defaultValue={user.companyName} required />
            <button className="btn-secondary">Salvar</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Equipes</h2>
          <p className="text-xs text-slate-500">
            O gestor vê os leads e negócios da equipe dele e os que estão sem responsável. O vendedor vê só os dele.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1">
                {t.name}
                <form action={deleteTeam.bind(null, t.id)}>
                  <button className="text-xs text-red-600 hover:underline">excluir</button>
                </form>
              </li>
            ))}
            {!teams.length && <li className="text-slate-500">Nenhuma equipe ainda.</li>}
          </ul>
          <form action={createTeam} className="flex gap-2">
            <input className="input" name="name" placeholder="Nome da equipe" required />
            <button className="btn-secondary">Criar equipe</button>
          </form>
        </section>

        <section className="card space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Pessoas</h2>
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.id}>
                <form action={updateMember.bind(null, m.id)} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                  <span className="min-w-40 flex-1">
                    {m.name} <span className="text-slate-500">· {m.email}</span>
                  </span>
                  <input className="input w-40 py-1" name="phone" defaultValue={m.phone ?? ""} placeholder="WhatsApp" />
                  <select className="input w-36 py-1" name="role" defaultValue={m.role}>
                    <option value="SELLER">Vendedor</option>
                    <option value="MANAGER">Gestor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                  <select className="input w-36 py-1" name="teamId" defaultValue={m.teamId ?? ""}>
                    <option value="">Sem equipe</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button className="btn-secondary py-1">Salvar</button>
                  {m.id !== user.userId && (
                    <button formAction={removeMember.bind(null, m.id)} className="text-xs text-red-600 hover:underline">remover</button>
                  )}
                </form>
              </li>
            ))}
          </ul>
          <form action={addMember} className="grid gap-2 sm:grid-cols-5">
            <input className="input" name="name" placeholder="Nome" required />
            <input className="input" name="email" type="email" placeholder="E-mail" required />
            <input className="input" name="password" type="password" placeholder="Senha inicial (8+)" />
            <select className="input" name="role" defaultValue="SELLER">
              <option value="SELLER">Vendedor</option>
              <option value="MANAGER">Gestor</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <button className="btn">Adicionar pessoa</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Produtos</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.name} · {formatMoney(p.price)}</span>
                <form action={deleteProduct.bind(null, p.id)}>
                  <button className="text-xs text-red-600 hover:underline">excluir</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addProduct} className="flex gap-2">
            <input className="input" name="name" placeholder="Produto" required />
            <input className="input w-32" name="price" placeholder="Preço" inputMode="decimal" />
            <button className="btn-secondary">Adicionar</button>
          </form>
        </section>

        <section id="canais" className="card space-y-3">
          <h2 className="font-semibold">Canais de WhatsApp</h2>
          <p className="text-xs text-slate-500">
            Usa a WhatsApp Cloud API oficial da Meta. Crie um app em developers.facebook.com, pegue o Phone number ID e um token
            permanente, e configure o webhook abaixo assinando o campo <code>messages</code>.
          </p>
          <ul className="space-y-2 text-sm">
            {channels.map((c) => (
              <li key={c.id} className="rounded border border-slate-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <form action={deleteChannel.bind(null, c.id)}>
                    <button className="text-xs text-red-600 hover:underline">remover</button>
                  </form>
                </div>
                <p className="break-all text-xs text-slate-500">Phone number ID: {c.phoneNumberId}</p>
                <p className="break-all text-xs text-slate-500">URL do webhook: {origin}/api/webhooks/whatsapp</p>
                <p className="break-all text-xs text-slate-500">Token de verificação: {c.verifyToken}</p>
              </li>
            ))}
          </ul>
          <form action={addChannel} className="grid gap-2">
            <input className="input" name="name" placeholder="Nome (ex.: Comercial)" />
            <input className="input" name="phoneNumberId" placeholder="Phone number ID" required />
            <input className="input" name="accessToken" type="password" placeholder="Token de acesso" required />
            <button className="btn">Conectar WhatsApp</button>
          </form>
        </section>
      </div>
    </div>
  );
}
