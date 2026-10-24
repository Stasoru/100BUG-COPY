export const PROPOSAL_STATUS_LABEL = { DRAFT: "Rascunho", SENT: "Enviado", ACCEPTED: "Aceito", REJECTED: "Recusado" } as const;
export const PROPOSAL_STATUS_STYLE = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-sky-100 text-sky-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
} as const;
