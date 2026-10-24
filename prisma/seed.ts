// Demo data: `npm run db:seed`. Logins (password demo1234):
// demo@roda.dev (admin), carla@roda.dev (manager), bruno@roda.dev and diego@roda.dev (sellers).
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ingestLead } from "../src/lib/distribution";
import { PIPELINE_TEMPLATES } from "../src/lib/pipeline-templates";

const db = new PrismaClient();
const DAY = 86_400_000;
const MINUTE = 60_000;

async function main() {
  if (await db.user.findUnique({ where: { email: "demo@roda.dev" } })) {
    console.log("Seed already applied");
    return;
  }
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const company = await db.company.create({ data: { name: "Imobiliária Demo" } });
  const team = await db.team.create({ data: { companyId: company.id, name: "Equipe Centro" } });
  const person = (name: string, email: string, phone: string | null) => db.user.create({ data: { name, email, phone, passwordHash } });
  const admin = await person("Ana Admin", "demo@roda.dev", null);
  const manager = await person("Carla Gestora", "carla@roda.dev", null);
  const bruno = await person("Bruno Corretor", "bruno@roda.dev", "5511900000001");
  const diego = await person("Diego Corretor", "diego@roda.dev", "5511900000002");
  await db.membership.createMany({
    data: [
      { userId: admin.id, companyId: company.id, role: "ADMIN" },
      { userId: manager.id, companyId: company.id, role: "MANAGER", teamId: team.id },
      { userId: bruno.id, companyId: company.id, role: "SELLER", teamId: team.id },
      { userId: diego.id, companyId: company.id, role: "SELLER", teamId: team.id },
    ],
  });

  const template = PIPELINE_TEMPLATES.realEstate;
  const pipeline = await db.pipeline.create({
    data: { companyId: company.id, name: template.name, stages: { create: template.stages.map((name, position) => ({ name, position })) } },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  await db.product.createMany({
    data: [
      { companyId: company.id, name: "Comissão de venda", price: 12000 },
      { companyId: company.id, name: "Taxa de administração de aluguel", price: 450 },
    ],
  });
  const source = (name: string) =>
    db.leadSource.create({ data: { companyId: company.id, name, pipelineId: pipeline.id, token: crypto.randomBytes(18).toString("base64url") } });
  const facebook = await source("Facebook");
  const portal = await source("Portal de imóveis");
  const site = await source("Site");

  // Bruno gets twice Diego's share; Diego only serves the portal and the website.
  await db.queueMember.createMany({
    data: [
      { companyId: company.id, userId: bruno.id, weight: 2 },
      { companyId: company.id, userId: diego.id, weight: 1, sourceIds: [portal.id, site.id] },
    ],
  });

  // Past leads go through the real rotation (no acceptance step), then get backdated history.
  const leads = [
    ["Fernanda Alves", "5511988880001", facebook, "Lançamento Jardins"],
    ["Gustavo Pires", "5511988880002", portal, null],
    ["Helena Costa", "5511988880003", facebook, "Lançamento Jardins"],
    ["Igor Santos", "5511988880004", site, null],
    ["Julia Martins", "5511988880005", facebook, "Aluguel Centro"],
    ["Lucas Prado", "5511988880006", portal, null],
    ["Marina Rocha", "5511988880007", facebook, "Aluguel Centro"],
    ["Nicolas Freitas", "5511988880008", site, null],
    ["Olivia Teles", "5511988880009", facebook, "Lançamento Jardins"],
  ] as const;
  for (const [i, [name, phone, src, campaign]] of leads.entries()) {
    const { dealId } = await ingestLead(src, { name, phone, email: null, campaign, message: null });
    const createdAt = new Date(Date.now() - (leads.length - i) * 2 * DAY);
    const status = i === 1 || i === 4 ? "WON" : i === 6 ? "LOST" : "OPEN";
    await db.deal.update({
      where: { id: dealId },
      data: {
        createdAt,
        firstContactAt: i === 8 ? null : new Date(createdAt.getTime() + (5 + i * 7) * MINUTE),
        stageId: pipeline.stages[i % 5].id,
        stageEnteredAt: new Date(createdAt.getTime() + DAY),
        value: status === "WON" ? 12000 : 0,
        status,
        lostReason: status === "LOST" ? "Comprou com outra imobiliária" : null,
        closedAt: status === "OPEN" ? null : new Date(createdAt.getTime() + DAY),
      },
    });
    await db.leadAssignment.updateMany({ where: { dealId }, data: { createdAt, respondedAt: createdAt } });
    await db.activity.updateMany({ where: { dealId }, data: { createdAt } });
  }

  // From now on sellers have 15 minutes to accept. One fresh lead is waiting for Bruno.
  await db.company.update({ where: { id: company.id }, data: { acceptMinutes: 15 } });
  await ingestLead(facebook, { name: "Paulo Viana", phone: "5511988880010", email: null, campaign: "Lançamento Jardins", message: "Tem 2 quartos?" });

  const firstDeal = await db.deal.findFirstOrThrow({
    where: { companyId: company.id, status: "OPEN", ownerId: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  await db.visit.create({
    data: {
      companyId: company.id,
      contactId: firstDeal.contactId,
      dealId: firstDeal.id,
      userId: firstDeal.ownerId,
      startsAt: new Date(Math.ceil(Date.now() / (60 * MINUTE)) * 60 * MINUTE + DAY),
      place: "Rua das Flores, 120 - apto 82",
    },
  });
  await db.task.create({
    data: {
      companyId: company.id,
      title: "Enviar fotos do apartamento",
      assigneeId: firstDeal.ownerId,
      dealId: firstDeal.id,
      contactId: firstDeal.contactId,
      dueAt: new Date(Date.now() - DAY),
    },
  });
  console.log("Seeded. Login: demo@roda.dev / demo1234");
}

main().finally(() => db.$disconnect());
