"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formString } from "@/lib/format";

// The client answers from the public link. Only documents marked as sent can be answered.
export async function respondToProposal(token: string, accept: boolean, form: FormData) {
  const signerName = formString(form, "signerName");
  if (accept && signerName.length < 3) throw new Error("Escreva seu nome completo para aceitar");
  const proposal = await db.proposal.findUnique({ where: { token }, include: { deal: true } });
  if (!proposal || proposal.status !== "SENT") throw new Error("Este documento não está aguardando resposta");
  await db.proposal.update({
    where: { id: proposal.id },
    data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date(), signerName: signerName || null },
  });
  await db.activity.create({
    data: {
      companyId: proposal.companyId,
      dealId: proposal.dealId,
      contactId: proposal.deal.contactId,
      kind: "proposal",
      text: `${proposal.title} ${accept ? "aceito" : "recusado"} pelo cliente pelo link${signerName ? ` (${signerName})` : ""}`,
    },
  });
  revalidatePath(`/p/${token}`);
}
