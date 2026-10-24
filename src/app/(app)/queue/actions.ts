"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireManager, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { distributeDeal, ingestLead, respondToAssignment } from "@/lib/distribution";
import { formString } from "@/lib/format";
import { parseLead } from "@/lib/leads";
import { memberIdOrNull } from "@/lib/members";
import { startingServed } from "@/lib/queue";

export async function acceptLead(assignmentId: string) {
  const user = await requireUser();
  const dealId = await respondToAssignment(assignmentId, user.userId, true);
  redirect(`/deals/${dealId}`);
}

export async function declineLead(assignmentId: string) {
  const user = await requireUser();
  await respondToAssignment(assignmentId, user.userId, false);
  revalidatePath("/queue");
}

// ---------- Rotation ----------

export async function addToQueue(form: FormData) {
  const user = await requireManager();
  const userId = await memberIdOrNull(user.companyId, formString(form, "userId"));
  if (!userId) return;
  const weight = clampWeight(formString(form, "weight"));
  const others = await db.queueMember.findMany({ where: { companyId: user.companyId } });
  await db.queueMember.upsert({
    where: { companyId_userId: { companyId: user.companyId, userId } },
    create: { companyId: user.companyId, userId, weight, served: startingServed(others, weight) },
    update: { active: true },
  });
  revalidatePath("/queue");
}

export async function updateQueueMember(queueMemberId: string, form: FormData) {
  const user = await requireManager();
  const member = await db.queueMember.findFirst({ where: { id: queueMemberId, companyId: user.companyId } });
  if (!member) return;
  const active = form.get("active") === "on";
  const weight = clampWeight(formString(form, "weight"));
  const sourceIds = (
    await db.leadSource.findMany({ where: { companyId: user.companyId, id: { in: form.getAll("sourceIds").map(String) } }, select: { id: true } })
  ).map((s) => s.id);
  // Coming back from a pause: start level with the others, not with a backlog of "missed" leads.
  const others = await db.queueMember.findMany({ where: { companyId: user.companyId, id: { not: member.id } } });
  const served = active && !member.active ? startingServed(others, weight) : member.served;
  await db.queueMember.update({ where: { id: member.id }, data: { active, weight, sourceIds, served } });
  revalidatePath("/queue");
}

export async function removeFromQueue(queueMemberId: string) {
  const user = await requireManager();
  await db.queueMember.deleteMany({ where: { id: queueMemberId, companyId: user.companyId } });
  revalidatePath("/queue");
}

export async function setAcceptMinutes(form: FormData) {
  const user = await requireManager();
  const minutes = Math.min(1440, Math.max(0, Math.floor(Number(formString(form, "acceptMinutes")) || 0)));
  await db.company.update({ where: { id: user.companyId }, data: { acceptMinutes: minutes } });
  revalidatePath("/queue");
}

export async function redistribute(dealId: string) {
  const user = await requireManager();
  const deal = await db.deal.findFirst({ where: { id: dealId, companyId: user.companyId, status: "OPEN" } });
  if (!deal) return;
  await db.leadAssignment.updateMany({ where: { dealId, status: "PENDING" }, data: { status: "EXPIRED", respondedAt: new Date() } });
  await distributeDeal(dealId, { startOver: true });
  revalidatePath("/queue");
}

function clampWeight(input: string) {
  return Math.min(10, Math.max(1, Math.floor(Number(input) || 1)));
}

// ---------- Lead sources ----------

export async function createLeadSource(form: FormData) {
  const user = await requireAdmin();
  const name = formString(form, "name");
  const pipeline = await db.pipeline.findFirst({ where: { id: formString(form, "pipelineId"), companyId: user.companyId } });
  if (!name || !pipeline) throw new Error("Informe o nome e o funil");
  await db.leadSource.create({
    data: { companyId: user.companyId, name, pipelineId: pipeline.id, token: crypto.randomBytes(18).toString("base64url") },
  });
  revalidatePath("/queue");
}

export async function toggleLeadSource(sourceId: string) {
  const user = await requireAdmin();
  const source = await db.leadSource.findFirst({ where: { id: sourceId, companyId: user.companyId } });
  if (!source) return;
  await db.leadSource.update({ where: { id: sourceId }, data: { active: !source.active } });
  revalidatePath("/queue");
}

export async function deleteLeadSource(sourceId: string) {
  const user = await requireAdmin();
  await db.leadSource.deleteMany({ where: { id: sourceId, companyId: user.companyId } });
  revalidatePath("/queue");
}

// Lets the team type in a lead that arrived by phone or in person; it goes through the same rotation.
export async function addLeadManually(form: FormData) {
  const user = await requireManager();
  const source = await db.leadSource.findFirst({ where: { id: formString(form, "sourceId"), companyId: user.companyId } });
  if (!source) throw new Error("Escolha a origem do lead");
  const parsed = parseLead(Object.fromEntries(form.entries()));
  if (!parsed.ok) throw new Error(parsed.error);
  const { dealId } = await ingestLead(source, parsed.lead);
  redirect(`/deals/${dealId}`);
}
