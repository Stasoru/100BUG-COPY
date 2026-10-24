import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { requireUser, type CurrentUser } from "./auth";
import { db } from "./db";

type Viewer = Pick<CurrentUser, "userId" | "companyId" | "role" | "teamId">;

// Who sees what:
// - admin: everything in the company;
// - manager: their team's work plus anything not yet assigned (a manager without a team sees only their own);
// - seller: only what is theirs.
export function buildScope(viewer: Viewer, teamUserIds: string[]) {
  const { companyId, role } = viewer;
  const ids = role === "ADMIN" ? null : role === "MANAGER" ? [...new Set([viewer.userId, ...teamUserIds])] : [viewer.userId];
  const unassigned = role === "MANAGER";
  return {
    all: ids === null,
    userIds: ids,
    deal(): Prisma.DealWhereInput {
      if (!ids) return { companyId };
      return { companyId, OR: [{ ownerId: { in: ids } }, ...(unassigned ? [{ ownerId: null }] : [])] };
    },
    contact(): Prisma.ContactWhereInput {
      if (!ids) return { companyId };
      return {
        companyId,
        OR: [{ ownerId: { in: ids } }, { deals: { some: { ownerId: { in: ids } } } }, ...(unassigned ? [{ ownerId: null }] : [])],
      };
    },
    conversation(): Prisma.ConversationWhereInput {
      if (!ids) return { companyId };
      return {
        companyId,
        OR: [{ assigneeId: { in: ids } }, { contact: { ownerId: { in: ids } } }, ...(unassigned ? [{ assigneeId: null }] : [])],
      };
    },
    task(): Prisma.TaskWhereInput {
      if (!ids) return { companyId };
      return { companyId, OR: [{ assigneeId: { in: ids } }, ...(unassigned ? [{ assigneeId: null }] : [])] };
    },
    visit(): Prisma.VisitWhereInput {
      if (!ids) return { companyId };
      return { companyId, OR: [{ userId: { in: ids } }, ...(unassigned ? [{ userId: null }] : [])] };
    },
  };
}

export type Scope = ReturnType<typeof buildScope>;

// The signed-in user and what they can see.
export const requireScope = cache(async () => {
  const user = await requireUser();
  const teamUserIds =
    user.role === "MANAGER" && user.teamId
      ? (await db.membership.findMany({ where: { companyId: user.companyId, teamId: user.teamId }, select: { userId: true } })).map((m) => m.userId)
      : [];
  return { user, scope: buildScope(user, teamUserIds) };
});
