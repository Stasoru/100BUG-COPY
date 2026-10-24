import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ingestLead } from "@/lib/distribution";
import { parseLead } from "@/lib/leads";

type Params = { params: Promise<{ token: string }> };

async function findSource(token: string) {
  return db.leadSource.findUnique({ where: { token } });
}

// Opening the URL in a browser confirms it is valid.
export async function GET(_: NextRequest, { params }: Params) {
  const source = await findSource((await params).token);
  if (!source) return NextResponse.json({ ok: false, error: "Endereço inválido" }, { status: 404 });
  return NextResponse.json({ ok: true, source: source.name, active: source.active, usage: "Envie os leads por POST, em JSON ou formulário" });
}

// Receives one lead (or a list of leads) as JSON or as a form post.
export async function POST(req: NextRequest, { params }: Params) {
  const source = await findSource((await params).token);
  if (!source) return NextResponse.json({ ok: false, error: "Endereço inválido" }, { status: 404 });
  if (!source.active) return NextResponse.json({ ok: false, error: "Origem pausada" }, { status: 409 });

  let payload: unknown;
  try {
    const type = req.headers.get("content-type") ?? "";
    payload = type.includes("application/json") ? await req.json() : Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido" }, { status: 400 });
  }

  const items = Array.isArray(payload) ? payload : [payload];
  const results = [];
  for (const item of items.slice(0, 100)) {
    const parsed = parseLead(item);
    if (!parsed.ok) {
      results.push({ ok: false, error: parsed.error });
      continue;
    }
    const { dealId, duplicate } = await ingestLead(source, parsed.lead);
    results.push({ ok: true, dealId, duplicate });
  }
  const ok = results.some((r) => r.ok);
  return NextResponse.json(items.length === 1 ? results[0] : { ok, results }, { status: ok ? 200 : 422 });
}
