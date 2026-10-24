"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { markFirstContact } from "@/lib/distribution";
import { DEFAULT_TEMPLATES, KIND_LABEL, documentVariables, renderTemplate } from "@/lib/documents";
import { formString } from "@/lib/format";
import { requireScope } from "@/lib/scope";

async function ownedProposal(id: string) {
  const { user, scope } = await requireScope();
  const proposal = await db.proposal.findFirst({ where: { id, companyId: user.companyId, deal: scope.deal() } });
  if (!proposal) throw new Error("Documento não encontrado");
  return { user, proposal };
}

// template = "t:<id>" for a company template or "d:<index>" for a built-in one.
export async function createProposal(dealId: string, form: FormData) {
  const { user, scope } = await requireScope();
  const deal = await db.deal.findFirst({
    where: { ...scope.deal(), id: dealId },
    include: { contact: true, owner: true, company: true, products: { include: { product: true } } },
  });
  if (!deal) throw new Error("Negócio não encontrado");

  const [type, ref] = formString(form, "template").split(":");
  const template =
    type === "t"
      ? await db.documentTemplate.findFirst({ where: { id: ref, companyId: user.companyId } })
      : DEFAULT_TEMPLATES[Number(ref)];
  if (!template) throw new Error("Escolha um modelo");

  const last = await db.proposal.findFirst({ where: { companyId: user.companyId, kind: template.kind }, orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;
  const vars = documentVariables({
    title: deal.title,
    value: Number(deal.value),
    contact: deal.contact,
    owner: deal.owner,
    companyName: deal.company.name,
    number,
    products: deal.products.map((p) => ({ quantity: p.quantity, unitPrice: Number(p.unitPrice), name: p.product.name })),
  });
  const proposal = await db.proposal.create({
    data: {
      companyId: user.companyId,
      dealId,
      kind: template.kind,
      number,
      title: `${KIND_LABEL[template.kind]} nº ${number} · ${deal.contact.name}`,
      body: renderTemplate(template.body, vars),
      total: deal.value,
      token: crypto.randomBytes(18).toString("base64url"),
      createdById: user.userId,
    },
  });
  await db.activity.create({
    data: { companyId: user.companyId, dealId, contactId: deal.contactId, userId: user.userId, kind: "proposal", text: `${proposal.title} criado` },
  });
  await markFirstContact(dealId);
  redirect(`/proposals/${proposal.id}`);
}

export async function updateProposal(id: string, form: FormData) {
  const { proposal } = await ownedProposal(id);
  if (proposal.status !== "DRAFT") throw new Error("Só dá para editar rascunhos. Volte para rascunho antes de mudar.");
  await db.proposal.update({
    where: { id },
    data: { title: formString(form, "title") || proposal.title, body: String(form.get("body") ?? proposal.body) },
  });
  revalidatePath(`/proposals/${id}`);
}

export async function setProposalStatus(id: string, status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED") {
  const { user, proposal } = await ownedProposal(id);
  await db.proposal.update({
    where: { id },
    data: {
      status,
      sentAt: status === "SENT" ? new Date() : status === "DRAFT" ? null : proposal.sentAt,
      respondedAt: status === "ACCEPTED" || status === "REJECTED" ? new Date() : null,
      signerName: status === "ACCEPTED" || status === "REJECTED" ? proposal.signerName : null,
    },
  });
  const label = { DRAFT: "voltou para rascunho", SENT: "marcado como enviado", ACCEPTED: "marcado como aceito", REJECTED: "marcado como recusado" }[status];
  const deal = await db.deal.findUniqueOrThrow({ where: { id: proposal.dealId } });
  await db.activity.create({
    data: { companyId: user.companyId, dealId: deal.id, contactId: deal.contactId, userId: user.userId, kind: "proposal", text: `${proposal.title} ${label}` },
  });
  revalidatePath(`/proposals/${id}`);
}

export async function deleteProposal(id: string) {
  const { proposal } = await ownedProposal(id);
  await db.proposal.delete({ where: { id } });
  redirect(`/deals/${proposal.dealId}`);
}
