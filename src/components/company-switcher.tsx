"use client";

import { switchCompany } from "@/app/(app)/companies/actions";

// Changing the select switches company right away.
export function CompanySwitcher({ current, companies }: { current: string; companies: { id: string; name: string }[] }) {
  return (
    <form action={switchCompany} className="px-3 pb-3">
      <select
        name="companyId"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full truncate rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
        aria-label="Trocar de empresa"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </form>
  );
}
