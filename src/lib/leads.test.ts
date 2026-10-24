import { describe, expect, it } from "vitest";
import { parseLead } from "./leads";

describe("parseLead", () => {
  it("reads a plain website form", () => {
    expect(parseLead({ nome: "Ana Lima", telefone: "+55 (11) 98888-0000", campanha: "Black Friday" })).toEqual({
      ok: true,
      lead: { name: "Ana Lima", phone: "5511988880000", email: null, campaign: "Black Friday", message: null },
    });
  });

  it("reads Facebook field_data and nested objects", () => {
    const payload = {
      ad_name: "Lançamento",
      field_data: [
        { name: "full_name", values: ["Bruno Reis"] },
        { name: "phone_number", values: ["+5511977770000"] },
        { name: "email", values: ["BRUNO@EXAMPLE.COM"] },
      ],
    };
    expect(parseLead(payload)).toEqual({
      ok: true,
      lead: { name: "Bruno Reis", phone: "5511977770000", email: "bruno@example.com", campaign: "Lançamento", message: null },
    });
  });

  it("joins first and last name and falls back to the phone", () => {
    expect(parseLead({ first_name: "Carla", last_name: "Souza", phone: "11966660000" })).toMatchObject({ ok: true, lead: { name: "Carla Souza" } });
    expect(parseLead({ whatsapp: "11955550000" })).toMatchObject({ ok: true, lead: { name: "11955550000" } });
  });

  it("rejects leads without any way to contact them", () => {
    expect(parseLead({ nome: "Sem contato" })).toEqual({ ok: false, error: "Informe pelo menos telefone ou e-mail" });
    expect(parseLead(null).ok).toBe(false);
  });
});
