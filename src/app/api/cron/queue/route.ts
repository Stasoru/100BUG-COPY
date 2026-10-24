import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { expireAssignments } from "@/lib/distribution";

// Moves on leads nobody accepted in time, even when no one has the app open.
// Vercel Cron calls it (see vercel.json); with CRON_SECRET set, only calls carrying it are accepted.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("unauthorized", { status: 401 });
  const companies = await db.leadAssignment.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    distinct: ["companyId"],
    select: { companyId: true },
  });
  for (const { companyId } of companies) await expireAssignments(companyId);
  return NextResponse.json({ ok: true, companies: companies.length });
}
