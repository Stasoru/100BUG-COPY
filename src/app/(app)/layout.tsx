import Link from "next/link";
import { CompanySwitcher } from "@/components/company-switcher";
import { NavLink } from "@/components/nav-link";
import { requireUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { expireAssignments } from "@/lib/distribution";
import { logout } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Painel" },
  { href: "/queue", label: "Fila de leads" },
  { href: "/pipelines", label: "Funis" },
  { href: "/contacts", label: "Contatos" },
  { href: "/inbox", label: "Conversas" },
  { href: "/agenda", label: "Agenda" },
  { href: "/tasks", label: "Tarefas" },
  { href: "/reports", label: "Relatórios" },
  { href: "/settings", label: "Configurações" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Every page view moves on leads whose acceptance time ran out.
  await expireAssignments(user.companyId);
  const [companies, waiting] = await Promise.all([
    db.membership.findMany({ where: { userId: user.userId }, include: { company: true }, orderBy: { company: { name: "asc" } } }),
    db.leadAssignment.count({ where: { companyId: user.companyId, userId: user.userId, status: "PENDING" } }),
  ]);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-slate-900 p-3 print:hidden md:w-56">
        <p className="px-3 py-2 text-lg font-bold text-black">{APP_NAME}</p>
        {companies.length > 1 ? (
          <CompanySwitcher current={user.companyId} companies={companies.map((m) => m.company)} />
        ) : (
          <p className="truncate px-3 pb-3 text-xs text-slate-400">{user.companyName}</p>
        )}
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
              {item.href === "/queue" && waiting > 0 && (
                <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-slate-900">{waiting}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-2 flex items-center gap-1 border-t border-slate-800 pt-2 md:mt-auto md:block md:pt-3">
          <p className="truncate px-3 text-sm text-slate-300">{user.name}</p>
          <Link href="/companies" className="block px-3 py-1 text-xs text-slate-400 hover:text-white">Minhas empresas</Link>
          <form action={logout}>
            <button className="px-3 py-1 text-xs text-slate-400 hover:text-white">Sair</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6 print:p-0">{children}</main>
    </div>
  );
}
