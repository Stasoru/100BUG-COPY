import { describe, expect, it } from "vitest";
import { documentVariables, renderTemplate } from "./documents";

describe("renderTemplate", () => {
  it("fills known fields and keeps unknown ones visible", () => {
    expect(renderTemplate("Olá {{ cliente.nome }}, total {{negocio.valor}} {{xyz}}", { "cliente.nome": "Ana", "negocio.valor": "R$ 10,00" })).toBe(
      "Olá Ana, total R$ 10,00 {{xyz}}",
    );
  });
});

describe("documentVariables", () => {
  const base = {
    title: "Apartamento 302",
    value: 1500,
    contact: { name: "Ana", phone: "5511999990000", email: null },
    owner: { name: "Bruno", phone: null },
    companyName: "Imob",
    number: 7,
    today: new Date("2026-10-24T15:00:00Z"),
  };

  it("lists products with line totals", () => {
    const vars = documentVariables({ ...base, products: [{ quantity: 2, unitPrice: 750, name: "Taxa" }] });
    expect(vars.produtos).toBe("- 2 × Taxa: R$ 1.500,00");
    expect(vars.data).toBe("24/10/2026");
    expect(vars.validade).toBe("31/10/2026");
    expect(vars["cliente.email"]).toBe("");
  });

  it("falls back to the deal itself when there are no products", () => {
    expect(documentVariables({ ...base, products: [] }).produtos).toBe("- Apartamento 302: R$ 1.500,00");
  });
});
