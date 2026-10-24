"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { markFirstContact } from "@/lib/distribution";
import { formatDateTime, formString, parseLocalDateTime } from "@/lib/format";
import { memberIdOrNull } from "@/lib/members";
import { requireScope } from "@/lib/scope";

export async function createVisit(form: FormData) {
  const { user, scope } = await requireScope();
  const startsAt = parseLocalDateTime(formString(form, "startsAt"));
  if (!startsAt) throw new Error("Informe data e hora da visita");
  const dealId = formString(form, "dealId") || null;
  const deal = dealId ? await db.deal.findFirst({ where: { ...scope.deal(), id: dealId } }) : null;
  const contactId = deal?.contactId ?? formString(form, "contactId");
  const contact = await db.contact.findFirst({ where: { ...scope.contact(), id: contactId } });
  if (!contact || (dealId && !deal)) throw new Error("Contato ou negócio não encontrado");

  const visit = await db.visit.create({
    data: {
      companyId: user.companyId,
      contactId: contact.id,
      dealId: deal?.id ?? null,
      userId: (await memberIdOrNull(user.companyId, formString(form, "userId"))) ?? user.userId,
      startsAt,
      durationMin: Math.min(600, Math.max(15, Math.floor(Number(formString(form, "durationMin")) || 60))),
      place: formString(form, "place") || null,
      notes: formString(form, "notes") || null,
    },
  });
  await db.activity.create({
    data: {
      companyId: user.companyId,
      contactId: contact.id,
      dealId: deal?.id,
      userId: user.userId,
      kind: "visit",
      text: `Visita agendada para ${formatDateTime(visit.startsAt)}${visit.place ? ` em ${visit.place}` : ""}`,
    },
  });
  if (deal) await markFirstContact(deal.id);
  revalidatePath("/", "layout");
}

export async function toggleVisitDone(visitId: string) {
  const { user, scope } = await requireScope();
  const visit = await db.visit.findFirst({ where: { ...scope.visit(), id: visitId } });
  if (!visit) return;
  await db.visit.update({ where: { id: visitId }, data: { doneAt: visit.doneAt ? null : new Date() } });
  if (!visit.doneAt) {
    await db.activity.create({
      data: { companyId: user.companyId, contactId: visit.contactId, dealId: visit.dealId, userId: user.userId, kind: "visit", text: "Visita realizada" },
    });
  }
  revalidatePath("/", "layout");
}

export async function deleteVisit(visitId: string) {
  const { scope } = await requireScope();
  await db.visit.deleteMany({ where: { ...scope.visit(), id: visitId } });
  revalidatePath("/", "layout");
}
