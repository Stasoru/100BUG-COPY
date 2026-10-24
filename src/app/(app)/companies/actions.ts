"use server";

import { redirect } from "next/navigation";
import { requireUser, startSession } from "@/lib/auth";
import { createCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { formString } from "@/lib/format";

export async function switchCompany(form: FormData) {
  const user = await requireUser();
  const companyId = formString(form, "companyId");
  const membership = await db.membership.findUnique({ where: { userId_companyId: { userId: user.userId, companyId } } });
  if (!membership) throw new Error("Você não faz parte desta empresa");
  await startSession(user.userId, companyId);
  redirect("/dashboard");
}

export async function addCompany(form: FormData) {
  const user = await requireUser();
  const name = formString(form, "name");
  if (!name) throw new Error("Informe o nome da empresa");
  const company = await db.$transaction((tx) => createCompany(tx, user.userId, name, formString(form, "template")));
  await startSession(user.userId, company.id);
  redirect("/dashboard");
}
