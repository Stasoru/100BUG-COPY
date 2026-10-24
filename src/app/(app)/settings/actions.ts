"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formString, normalizePhone, parseMoney } from "@/lib/format";

export async function renameCompany(form: FormData) {
  const user = await requireAdmin();
  const name = formString(form, "name");
  if (name) await db.company.update({ where: { id: user.companyId }, data: { name } });
  revalidatePath("/", "layout");
}

export async function addMember(form: FormData) {
  const user = await requireAdmin();
  const email = formString(form, "email").toLowerCase();
  const name = formString(form, "name");
  const password = formString(form, "password");
  const role = parseRole(formString(form, "role"));
  if (!email || !name) throw new Error("Informe nome e e-mail");
  let member = await db.user.findUnique({ where: { email } });
  if (!member) {
    if (password.length < 8) throw new Error("A senha inicial precisa ter pelo menos 8 caracteres");
    member = await db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 10) } });
  }
  await db.membership.upsert({
    where: { userId_companyId: { userId: member.id, companyId: user.companyId } },
    create: { userId: member.id, companyId: user.companyId, role },
    update: { role },
  });
  revalidatePath("/settings");
}

function parseRole(input: string) {
  return input === "ADMIN" || input === "MANAGER" ? input : "SELLER";
}

export async function updateMember(userId: string, form: FormData) {
  const user = await requireAdmin();
  const membership = await db.membership.findUnique({ where: { userId_companyId: { userId, companyId: user.companyId } } });
  if (!membership) return;
  const role = parseRole(formString(form, "role"));
  if (membership.role === "ADMIN" && role !== "ADMIN") {
    const admins = await db.membership.count({ where: { companyId: user.companyId, role: "ADMIN" } });
    if (admins <= 1) throw new Error("A empresa precisa de pelo menos um administrador");
  }
  const team = await db.team.findFirst({ where: { id: formString(form, "teamId"), companyId: user.companyId } });
  await db.membership.update({ where: { id: membership.id }, data: { role, teamId: team?.id ?? null } });
  await db.user.update({ where: { id: userId }, data: { phone: normalizePhone(formString(form, "phone")) } });
  revalidatePath("/settings");
}

export async function createTeam(form: FormData) {
  const user = await requireAdmin();
  const name = formString(form, "name");
  if (name) await db.team.create({ data: { companyId: user.companyId, name } });
  revalidatePath("/settings");
}

export async function deleteTeam(teamId: string) {
  const user = await requireAdmin();
  await db.team.deleteMany({ where: { id: teamId, companyId: user.companyId } });
  revalidatePath("/settings");
}

// Anyone can set their own name and the WhatsApp number that receives lead alerts.
export async function updateProfile(form: FormData) {
  const user = await requireUser();
  const name = formString(form, "name");
  await db.user.update({
    where: { id: user.userId },
    data: { ...(name && { name }), phone: normalizePhone(formString(form, "phone")) },
  });
  revalidatePath("/", "layout");
}

export async function removeMember(userId: string) {
  const user = await requireAdmin();
  if (userId === user.userId) throw new Error("Você não pode remover a si mesmo");
  await db.membership.deleteMany({ where: { userId, companyId: user.companyId } });
  revalidatePath("/settings");
}

export async function addProduct(form: FormData) {
  const user = await requireAdmin();
  const name = formString(form, "name");
  const price = parseMoney(formString(form, "price"));
  if (name) await db.product.create({ data: { companyId: user.companyId, name, price } });
  revalidatePath("/settings");
}

export async function deleteProduct(productId: string) {
  const user = await requireAdmin();
  await db.product.deleteMany({ where: { id: productId, companyId: user.companyId } });
  revalidatePath("/settings");
}

export async function addChannel(form: FormData) {
  const user = await requireAdmin();
  const phoneNumberId = formString(form, "phoneNumberId");
  const accessToken = formString(form, "accessToken");
  if (!phoneNumberId || !accessToken) throw new Error("Informe o Phone number ID e o token");
  await db.channel.create({
    data: {
      companyId: user.companyId,
      name: formString(form, "name") || "WhatsApp",
      phoneNumberId,
      accessToken,
      verifyToken: crypto.randomBytes(16).toString("hex"),
    },
  });
  revalidatePath("/settings");
}

export async function deleteChannel(channelId: string) {
  const user = await requireAdmin();
  await db.channel.deleteMany({ where: { id: channelId, companyId: user.companyId } });
  revalidatePath("/settings");
}
