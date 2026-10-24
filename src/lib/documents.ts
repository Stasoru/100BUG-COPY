import { formatDate, formatMoney } from "./format";

export const KIND_LABEL = { PROPOSAL: "Proposta", CONTRACT: "Contrato" } as const;

// Fields a template can use, written as {{field}}.
export const PLACEHOLDERS = {
  "cliente.nome": "Nome do cliente",
  "cliente.telefone": "Telefone do cliente",
  "cliente.email": "E-mail do cliente",
  "negocio.titulo": "Título do negócio",
  "negocio.valor": "Valor total",
  produtos: "Lista de produtos com quantidade e preço",
  "empresa.nome": "Nome da sua empresa",
  "vendedor.nome": "Nome do vendedor",
  "vendedor.telefone": "Telefone do vendedor",
  numero: "Número do documento",
  data: "Data de hoje",
  validade: "Hoje + 7 dias",
} as const;

// Starting points offered when a company has no templates of its own.
export const DEFAULT_TEMPLATES = [
  {
    kind: "PROPOSAL" as const,
    name: "Proposta comercial padrão",
    body: `PROPOSTA COMERCIAL Nº {{numero}}

Para: {{cliente.nome}}
Data: {{data}}

Olá, {{cliente.nome}}! Conforme conversamos, segue a nossa proposta para "{{negocio.titulo}}".

ITENS
{{produtos}}

VALOR TOTAL: {{negocio.valor}}

Condições de pagamento: a combinar.
Esta proposta vale até {{validade}}.

Qualquer dúvida, fale comigo.
{{vendedor.nome}} · {{vendedor.telefone}}
{{empresa.nome}}`,
  },
  {
    kind: "CONTRACT" as const,
    name: "Contrato simples de venda",
    body: `CONTRATO Nº {{numero}}

CONTRATADA: {{empresa.nome}}
CONTRATANTE: {{cliente.nome}}, telefone {{cliente.telefone}}, e-mail {{cliente.email}}

1. OBJETO
A CONTRATADA fornecerá à CONTRATANTE os itens abaixo, referentes a "{{negocio.titulo}}":
{{produtos}}

2. PREÇO
A CONTRATANTE pagará {{negocio.valor}}, nas condições combinadas entre as partes.

3. PRAZO
Os itens serão entregues ou executados no prazo combinado entre as partes, contado da assinatura.

4. DISPOSIÇÕES GERAIS
Este contrato é celebrado de boa-fé. Alterações só valem se feitas por escrito e aceitas pelas duas partes.

Data: {{data}}

Responsável pela CONTRATADA: {{vendedor.nome}}`,
  },
];

export type DocumentVariables = Record<keyof typeof PLACEHOLDERS, string>;

type DealData = {
  title: string;
  value: number;
  contact: { name: string; phone: string | null; email: string | null };
  products: { quantity: number; unitPrice: number; name: string }[];
  owner: { name: string; phone: string | null } | null;
  companyName: string;
  number: number;
  today?: Date;
};

export function documentVariables(d: DealData): DocumentVariables {
  const today = d.today ?? new Date();
  const products = d.products.length
    ? d.products.map((p) => `- ${p.quantity} × ${p.name}: ${formatMoney(p.unitPrice * p.quantity)}`).join("\n")
    : `- ${d.title}: ${formatMoney(d.value)}`;
  return {
    "cliente.nome": d.contact.name,
    "cliente.telefone": d.contact.phone ?? "",
    "cliente.email": d.contact.email ?? "",
    "negocio.titulo": d.title,
    "negocio.valor": formatMoney(d.value),
    produtos: products,
    "empresa.nome": d.companyName,
    "vendedor.nome": d.owner?.name ?? "",
    "vendedor.telefone": d.owner?.phone ?? "",
    numero: String(d.number),
    data: formatDate(today),
    validade: formatDate(new Date(today.getTime() + 7 * 86_400_000)),
  };
}

// Replaces {{field}} with its value. Unknown fields stay as written so the mistake is visible.
export function renderTemplate(body: string, vars: Partial<Record<string, string>>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}
