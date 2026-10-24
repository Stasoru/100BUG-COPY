import type { Prisma } from "@prisma/client";
import { pipelineTemplate } from "./pipeline-templates";

// A new company with its creator as admin and a first funnel from the chosen template.
export async function createCompany(tx: Prisma.TransactionClient, userId: string, name: string, templateKey?: string) {
  const template = pipelineTemplate(templateKey);
  const company = await tx.company.create({ data: { name } });
  await tx.membership.create({ data: { userId, companyId: company.id, role: "ADMIN" } });
  await tx.pipeline.create({
    data: {
      companyId: company.id,
      name: template.name,
      stages: { create: template.stages.map((stage, position) => ({ name: stage, position })) },
    },
  });
  return company;
}
