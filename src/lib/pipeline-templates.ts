// Ready-made funnels by business type. The first stage is where new leads land.
export const PIPELINE_TEMPLATES = {
  general: { label: "Vendas (geral)", name: "Vendas", stages: ["Novo lead", "Contato feito", "Proposta", "Negociação"] },
  realEstate: {
    label: "Imóveis",
    name: "Imóveis",
    stages: ["Novo lead", "Primeiro contato", "Visita agendada", "Visita feita", "Proposta", "Documentação"],
  },
  vehicles: {
    label: "Veículos",
    name: "Veículos",
    stages: ["Novo lead", "Contato feito", "Test drive", "Avaliação do usado", "Proposta", "Financiamento"],
  },
  services: {
    label: "Serviços e agências",
    name: "Serviços",
    stages: ["Novo lead", "Reunião de diagnóstico", "Proposta enviada", "Negociação", "Contrato"],
  },
  consulting: {
    label: "Consultoria",
    name: "Consultoria",
    stages: ["Novo lead", "Qualificação", "Reunião", "Proposta", "Fechamento"],
  },
} as const;

export type PipelineTemplateKey = keyof typeof PIPELINE_TEMPLATES;

export function pipelineTemplate(key: string | null | undefined) {
  return PIPELINE_TEMPLATES[(key && key in PIPELINE_TEMPLATES ? key : "general") as PipelineTemplateKey];
}
