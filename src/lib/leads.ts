import { normalizePhone } from "./format";

export type IncomingLead = {
  name: string;
  phone: string | null;
  email: string | null;
  campaign: string | null;
  message: string | null;
};

// Field names used by Facebook lead forms, Zapier/Make, listing portals and plain website forms.
const ALIASES = {
  name: ["name", "nome", "full_name", "fullname", "nome_completo"],
  firstName: ["first_name", "primeiro_nome"],
  lastName: ["last_name", "sobrenome"],
  phone: ["phone", "telefone", "phone_number", "whatsapp", "celular", "fone", "tel"],
  email: ["email", "e-mail", "e_mail"],
  campaign: ["campaign", "campanha", "campaign_name", "utm_campaign", "ad_name", "anuncio", "form_name"],
  message: ["message", "mensagem", "comments", "comentario", "observacao", "obs"],
};

// Turns whatever a lead source sends into a lead, or explains what is missing.
export function parseLead(input: unknown): { ok: true; lead: IncomingLead } | { ok: false; error: string } {
  const fields = flatten(input);
  const pick = (keys: string[]) => keys.map((k) => fields.get(k)).find((v) => v) ?? null;

  const phone = normalizePhone(pick(ALIASES.phone));
  const email = pick(ALIASES.email)?.toLowerCase() ?? null;
  const fullName = pick(ALIASES.name) ?? [pick(ALIASES.firstName), pick(ALIASES.lastName)].filter(Boolean).join(" ");
  if (!phone && !email) return { ok: false, error: "Informe pelo menos telefone ou e-mail" };
  return {
    ok: true,
    lead: {
      name: fullName || phone || email!,
      phone,
      email,
      campaign: pick(ALIASES.campaign),
      message: pick(ALIASES.message),
    },
  };
}

// Lowercased key -> trimmed text. Also reads Facebook's [{ name, values: [...] }] field_data shape.
function flatten(input: unknown): Map<string, string> {
  const result = new Map<string, string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const entry = item as { name?: unknown; values?: unknown };
        if (typeof entry?.name === "string" && Array.isArray(entry.values)) add(entry.name, entry.values[0]);
        else visit(item);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, v] of Object.entries(value)) {
        if (v && typeof v === "object") visit(v);
        else add(key, v);
      }
    }
  };
  const add = (key: string, v: unknown) => {
    const k = key.trim().toLowerCase();
    const text = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
    if (text && !result.has(k)) result.set(k, text);
  };
  visit(input);
  return result;
}
