import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

export type CurrentUser = {
  userId: string;
  companyId: string;
  role: "ADMIN" | "MANAGER" | "SELLER";
  teamId: string | null;
  name: string;
  companyName: string;
};

// Resolves the signed-in user and checks the membership still exists.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const membership = await db.membership.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId: session.companyId } },
    include: { user: true, company: true },
  });
  if (!membership) return null;
  return {
    userId: membership.userId,
    companyId: membership.companyId,
    role: membership.role,
    teamId: membership.teamId,
    name: membership.user.name,
    companyName: membership.company.name,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Apenas administradores podem fazer isso");
  return user;
}

// Admins and team managers: run the lead queue and see their team's work.
export async function requireManager() {
  const user = await requireUser();
  if (user.role === "SELLER") throw new Error("Apenas gestores e administradores podem fazer isso");
  return user;
}

export async function startSession(userId: string, companyId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession({ userId, companyId }), sessionCookieOptions);
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
