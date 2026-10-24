import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_STYLE } from "@/lib/proposal-status";
import { requireScope } from "@/lib/scope";
import { deleteProposal, setProposalStatus, updateProposal } from "../actions";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, scope } = await requireScope();
  const proposal = await db.proposal.findFirst({
    where: { id, companyId: user.companyId, deal: scope.deal() },
    include: { deal: { include: { contact: true } }, company: true },
  });
  if (!proposal) notFound();
  const h = await headers();
  const publicUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/p/${proposal.token}`;
  const phone = proposal.deal.contact.phone;
  const whatsappText = `Olá, ${proposal.deal.contact.name}! Segue o documento "${proposal.title}": ${publicUrl}`;
  const draft = proposal.status === "DRAFT";

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader title={proposal.title}>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${PROPOSAL_STATUS_STYLE[proposal.status]}`}>
            {PROPOSAL_STATUS_LABEL[proposal.status]}
          </span>
          <Link className="btn-secondary" href={`/deals/${proposal.dealId}`}>Voltar ao negócio</Link>
          <PrintButton />
        </PageHeader>

        <section className="card space-y-3">
          <div className="flex flex-wrap gap-2">
            {draft && (
              <form action={setProposalStatus.bind(null, proposal.id, "SENT")}>
                <button className="btn">Marcar como enviado</button>
              </form>
            )}
            {proposal.status === "SENT" && (
              <>
                <form action={setProposalStatus.bind(null, proposal.id, "ACCEPTED")}>
                  <button className="btn bg-emerald-600 hover:bg-emerald-700">Cliente aceitou</button>
                </form>
                <form action={setProposalStatus.bind(null, proposal.id, "REJECTED")}>
                  <button className="btn bg-red-600 hover:bg-red-700">Cliente recusou</button>
                </form>
              </>
            )}
            {!draft && (
              <form action={setProposalStatus.bind(null, proposal.id, "DRAFT")}>
                <button className="btn-secondary">Voltar para rascunho</button>
              </form>
            )}
            {phone && (
              <a className="btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}`}>
                Enviar pelo WhatsApp
              </a>
            )}
            {draft && (
              <form action={deleteProposal.bind(null, proposal.id)} className="ml-auto">
                <button className="text-xs text-red-600 hover:underline">excluir</button>
              </form>
            )}
          </div>
          <div>
            <p className="label">Link para o cliente ver e aceitar</p>
            <p className="break-all rounded bg-slate-50 px-2 py-1 font-mono text-xs">{publicUrl}</p>
            <p className="mt-1 text-xs text-slate-500">
              O cliente só consegue aceitar ou recusar depois que o documento for marcado como enviado.
              {proposal.sentAt && ` Enviado em ${formatDateTime(proposal.sentAt)}.`}
              {proposal.respondedAt && ` Respondido em ${formatDateTime(proposal.respondedAt)}${proposal.signerName ? ` por ${proposal.signerName}` : ""}.`}
            </p>
          </div>
        </section>

        {draft && (
          <details className="card" open>
            <summary className="cursor-pointer text-sm font-medium">Editar texto</summary>
            <form action={updateProposal.bind(null, proposal.id)} className="mt-3 space-y-2">
              <input className="input" name="title" defaultValue={proposal.title} />
              <textarea className="input font-mono" name="body" rows={18} defaultValue={proposal.body} />
              <button className="btn-secondary">Salvar texto</button>
            </form>
          </details>
        )}
      </div>

      <DocumentView companyName={proposal.company.name} body={proposal.body} signer={proposal.status === "ACCEPTED" ? proposal.signerName : null} />
    </div>
  );
}
