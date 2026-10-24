import { appUrl } from "./app-url";
import { db } from "./db";
import type { IncomingLead } from "./leads";
import { pickNext } from "./queue";
import { sendText } from "./whatsapp";

const MINUTE = 60_000;

// Stores a lead from a source: contact, deal in the source's pipeline, then hands it to the next seller.
// A lead from someone who already has an open deal in that pipeline is added to that deal instead.
export async function ingestLead(source: { id: string; companyId: string; name: string; pipelineId: string }, lead: IncomingLead) {
  const { companyId } = source;
  let contact =
    (lead.phone && (await db.contact.findUnique({ where: { companyId_phone: { companyId, phone: lead.phone } } }))) ||
    (lead.email && (await db.contact.findFirst({ where: { companyId, email: lead.email } }))) ||
    null;
  if (!contact) {
    contact = await db.contact.create({
      data: { companyId, name: lead.name, phone: lead.phone, email: lead.email, source: source.name },
    });
  }
  const details = [lead.campaign && `campanha ${lead.campaign}`, lead.message && `"${lead.message}"`].filter(Boolean).join(", ");
  const text = `Lead recebido de ${source.name}${details ? ` (${details})` : ""}`;

  const existing = await db.deal.findFirst({ where: { companyId, contactId: contact.id, pipelineId: source.pipelineId, status: "OPEN" } });
  if (existing) {
    await db.activity.create({ data: { companyId, contactId: contact.id, dealId: existing.id, kind: "lead", text: `${text} de novo` } });
    return { dealId: existing.id, duplicate: true };
  }

  const stage = await db.stage.findFirst({ where: { pipelineId: source.pipelineId }, orderBy: { position: "asc" } });
  if (!stage) throw new Error("O funil da origem não tem etapas");
  const deal = await db.deal.create({
    data: {
      companyId,
      pipelineId: source.pipelineId,
      stageId: stage.id,
      contactId: contact.id,
      leadSourceId: source.id,
      campaign: lead.campaign,
      title: lead.name,
    },
  });
  await db.activity.create({ data: { companyId, contactId: contact.id, dealId: deal.id, kind: "lead", text } });
  await distributeDeal(deal.id);
  await expireAssignments(companyId);
  return { dealId: deal.id, duplicate: false };
}

// Offers a deal to the next seller in the rotation, skipping everyone it was already offered to
// (unless a manager asks to start over).
export async function distributeDeal(dealId: string, { startOver = false } = {}) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: { company: true, assignments: true } });
  const companyId = deal.companyId;
  const members = await db.queueMember.findMany({ where: { companyId } });
  const tried = startOver ? [] : deal.assignments.map((a) => a.userId);
  const next = pickNext(members, deal.leadSourceId, tried);
  if (!next) {
    await db.deal.update({ where: { id: dealId }, data: { ownerId: null } });
    await db.activity.create({
      data: { companyId, dealId, contactId: deal.contactId, kind: "queue", text: "Nenhum vendedor disponível na fila. O lead aguarda distribuição manual." },
    });
    return null;
  }

  const minutes = deal.company.acceptMinutes;
  const now = new Date();
  await db.$transaction([
    db.queueMember.update({ where: { companyId_userId: { companyId, userId: next.userId } }, data: { served: { increment: 1 }, lastServedAt: now } }),
    db.leadAssignment.create({
      data: {
        companyId,
        dealId,
        userId: next.userId,
        status: minutes > 0 ? "PENDING" : "ACCEPTED",
        expiresAt: minutes > 0 ? new Date(now.getTime() + minutes * MINUTE) : null,
        respondedAt: minutes > 0 ? null : now,
      },
    }),
    db.deal.update({ where: { id: dealId }, data: { ownerId: next.userId } }),
    db.contact.updateMany({ where: { id: deal.contactId, ownerId: null }, data: { ownerId: next.userId } }),
  ]);
  const seller = await db.user.findUniqueOrThrow({ where: { id: next.userId } });
  await db.activity.create({
    data: {
      companyId,
      dealId,
      contactId: deal.contactId,
      kind: "queue",
      text: minutes > 0 ? `Lead oferecido a ${seller.name} (${minutes} min para aceitar)` : `Lead distribuído para ${seller.name}`,
    },
  });
  await notifySeller(dealId, seller, minutes);
  return next.userId;
}

// Sends the seller a WhatsApp alert through the company's first connected number.
async function notifySeller(dealId: string, seller: { name: string; phone: string | null }, minutes: number) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: { contact: true, leadSource: true } });
  const channel = await db.channel.findFirst({ where: { companyId: deal.companyId }, orderBy: { createdAt: "asc" } });
  if (!seller.phone || !channel) return;
  const lines = [
    `Novo lead para você, ${seller.name.split(" ")[0]}!`,
    `Nome: ${deal.contact.name}`,
    deal.contact.phone && `WhatsApp: ${deal.contact.phone}`,
    deal.leadSource && `Origem: ${deal.leadSource.name}${deal.campaign ? ` · ${deal.campaign}` : ""}`,
    minutes > 0 ? `Aceite em até ${minutes} min: ${appUrl()}/queue` : `Abrir: ${appUrl()}/deals/${deal.id}`,
  ];
  const result = await sendText(channel, seller.phone, lines.filter(Boolean).join("\n"));
  await db.activity.create({
    data: {
      companyId: deal.companyId,
      dealId,
      contactId: deal.contactId,
      kind: "queue",
      text: result.ok ? `Aviso enviado no WhatsApp de ${seller.name}` : `Não foi possível avisar ${seller.name} no WhatsApp: ${result.error}`,
    },
  });
}

// Pending offers past their deadline go to the next seller. Runs whenever someone opens the app.
export async function expireAssignments(companyId: string) {
  const expired = await db.leadAssignment.findMany({
    where: { companyId, status: "PENDING", expiresAt: { lt: new Date() } },
    include: { user: true, deal: true },
  });
  for (const a of expired) {
    const claimed = await db.leadAssignment.updateMany({ where: { id: a.id, status: "PENDING" }, data: { status: "EXPIRED", respondedAt: new Date() } });
    if (!claimed.count) continue;
    await db.activity.create({
      data: { companyId, dealId: a.dealId, contactId: a.deal.contactId, kind: "queue", text: `${a.user.name} não aceitou a tempo` },
    });
    if (a.deal.status === "OPEN") await distributeDeal(a.dealId);
  }
}

export async function respondToAssignment(assignmentId: string, userId: string, accept: boolean) {
  const assignment = await db.leadAssignment.findFirst({ where: { id: assignmentId, userId, status: "PENDING" }, include: { user: true, deal: true } });
  if (!assignment) throw new Error("Este lead não está mais esperando por você");
  const updated = await db.leadAssignment.updateMany({
    where: { id: assignmentId, status: "PENDING" },
    data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
  });
  if (!updated.count) throw new Error("Este lead não está mais esperando por você");
  await db.activity.create({
    data: {
      companyId: assignment.companyId,
      dealId: assignment.dealId,
      contactId: assignment.deal.contactId,
      userId,
      kind: "queue",
      text: accept ? `${assignment.user.name} aceitou o lead` : `${assignment.user.name} recusou o lead`,
    },
  });
  if (!accept) await distributeDeal(assignment.dealId);
  return assignment.dealId;
}

// Records when a seller first acted on a deal, for the response-time report.
export async function markFirstContact(dealIds: string | string[]) {
  const ids = Array.isArray(dealIds) ? dealIds : [dealIds];
  if (!ids.length) return;
  await db.deal.updateMany({ where: { id: { in: ids }, firstContactAt: null }, data: { firstContactAt: new Date() } });
}
