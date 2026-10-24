// The printable sheet of a proposal or contract, shared by the team page and the client page.
export function DocumentView({ companyName, body, signer }: { companyName: string; body: string; signer?: string | null }) {
  return (
    <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <p className="mb-6 border-b border-slate-200 pb-3 text-lg font-semibold text-brand-700">{companyName}</p>
      <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed">{body}</div>
      {signer && <p className="mt-8 border-t border-slate-200 pt-3 text-sm text-slate-600">Aceito eletronicamente por {signer}</p>}
    </article>
  );
}
