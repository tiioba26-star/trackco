import { describe, expect, it } from "vitest";
import { linhaDoTempo, type RegistroLog } from "../fechamento";

const r = (em: string, por: string, acao: string): RegistroLog => ({ em: `2026-11-${em}T12:00:00.000Z`, por, acao });

describe("linhaDoTempo", () => {
  const log = [
    r("01", "Ana", "Fechamento aberto"),
    r("02", "Ana", "Cálculo executado (6 pessoa(s))"),
    r("03", "Ana", "Cálculo executado (6 pessoa(s))"),
    r("04", "Ana", "Calculado → Prazo de contestação"),
    r("09", "Ana", "Prazo de contestação → Conferência do líder"),
  ];

  it("marca feitas, a atual e as que faltam, com data e quem concluiu", () => {
    const l = linhaDoTempo(["contestacao", "lider", "admin"], "conferencia_lider", log);
    expect(l.map((e) => e.estado)).toEqual(["feita", "feita", "feita", "atual", "a_fazer", "a_fazer", "a_fazer"]);
    // recalcular não muda a data em que chegou em "Calculado"
    expect(l[1].inicio?.em).toContain("2026-11-02");
    expect(l[1].fim).toEqual({ em: "2026-11-04T12:00:00.000Z", por: "Ana" });
    expect(l[3].inicio?.em).toContain("2026-11-09");
    expect(l[3].responsavel).toBe("lider_ou_admin");
    expect(l[4].inicio).toBeNull();
  });

  it("reabrir apaga as datas das etapas depois de Calculado", () => {
    const l = linhaDoTempo(["contestacao"], "calculado", [
      ...log.slice(0, 4),
      r("10", "Bia", "Prazo de contestação → Aprovação do admin"),
      r("11", "Bia", "Aprovação do admin → Aprovado"),
      r("12", "Bia", "Reaberto (estava em Aprovado)"),
    ]);
    const calc = l.find((e) => e.status === "calculado")!;
    expect(calc.estado).toBe("atual");
    expect(calc.inicio).toEqual({ em: "2026-11-12T12:00:00.000Z", por: "Bia" });
    expect(l.find((e) => e.status === "aprovado")?.inicio).toBeNull();
  });

  it("entregue: todas feitas", () => {
    const l = linhaDoTempo([], "entregue", [r("01", "Ana", "Fechamento aberto"), r("05", "Ana", "Aprovado → Entregue")]);
    expect(l.every((e) => e.estado === "feita")).toBe(true);
    expect(l.at(-1)?.inicio?.por).toBe("Ana");
  });

  it("sem histórico não quebra", () => {
    expect(linhaDoTempo([], "aberto", null)[0]).toMatchObject({ estado: "atual", inicio: null });
  });
});
