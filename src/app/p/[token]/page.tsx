import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";
import { respondToProposal } from "./actions";

export const metadata: Metadata = { robots: { index: false } };

// What the client sees: the document, and buttons to accept or decline while it is waiting for an answer.
export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await db.proposal.findUnique({ where: { token }, include: { company: true } });
  if (!proposal || proposal.status === "DRAFT") notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0 md:p-8">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
        <PrintButton />
      </div>
      <DocumentView companyName={proposal.company.name} body={proposal.body} signer={proposal.status === "ACCEPTED" ? proposal.signerName : null} />
      <div className="mx-auto mt-4 max-w-3xl print:hidden">
        {proposal.status === "SENT" ? (
          <section className="card space-y-3">
            <h2 className="font-semibold">Sua resposta</h2>
            <form className="flex flex-wrap gap-2">
              <input className="input max-w-sm" name="signerName" placeholder="Seu nome completo" />
              <button formAction={respondToProposal.bind(null, token, true)} className="btn bg-emerald-600 hover:bg-emerald-700">
                Aceito
              </button>
              <button formAction={respondToProposal.bind(null, token, false)} className="btn-secondary">
                Não aceito
              </button>
            </form>
            <p className="text-xs text-slate-500">Ao clicar em &quot;Aceito&quot;, seu nome e a data ficam registrados neste documento.</p>
          </section>
        ) : (
          <p className="card text-sm font-medium">
            {proposal.status === "ACCEPTED" ? "Documento aceito. Obrigado!" : "Documento recusado. Se mudar de ideia, fale com o vendedor."}
          </p>
        )}
      </div>
    </main>
  );
}
