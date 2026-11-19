import { describe, expect, it } from "vitest";
import { distribuirMeta, incoerencia, participacoes, valeParaEquipe } from "@/lib/metas/distribuir";

const vale = (r: Record<string, number>, fatores: Record<string, number>) =>
  Object.entries(r).reduce((s, [id, v]) => s + v * (fatores[id] ?? 1), 0);

describe("meta da equipe repartida", () => {
  it("divide pela participação e a soma fecha com a da equipe", () => {
    const r = distribuirMeta(688, [
      { id: "ana", peso: 180 },
      { id: "maiane", peso: 160 },
      { id: "bianca", peso: 15 },
      { id: "vanessa", peso: 90 },
    ], "un");
    expect(Object.values(r).reduce((s, v) => s + v, 0)).toBe(688);
    expect(r.ana).toBe(278); // 180/445 × 688 = 278,3
    expect(r.bianca).toBe(23);
  });
  it("30% do histórico = 30% da meta", () => {
    const r = distribuirMeta(1000, [{ id: "a", peso: 30 }, { id: "b", peso: 70 }], "un");
    expect(r).toEqual({ a: 300, b: 700 });
  });
  it("sem histórico divide igual", () => {
    expect(distribuirMeta(10, [{ id: "a", peso: null }, { id: "b", peso: 0 }, { id: "c", peso: null }], "un")).toEqual({ a: 4, b: 3, c: 3 });
  });
  it("taxa não se divide", () => {
    expect(distribuirMeta(70, [{ id: "a", peso: 10 }, { id: "b", peso: 90 }], "%")).toEqual({ a: 70, b: 70 });
  });
  it("participação em fração", () => {
    expect(participacoes([{ id: "a", peso: 30 }, { id: "b", peso: 70 }])).toEqual({ a: 0.3, b: 0.7 });
  });
});

describe("meta da equipe com ausências", () => {
  // caso real de novembro/2026: o Igor (27% do histórico) de férias o mês todo
  const pesos = [
    { id: "ana", peso: 197, fator: 1 },
    { id: "bianca", peso: 11, fator: 1 },
    { id: "igor", peso: 184, fator: 0 },
    { id: "maiane", peso: 158, fator: 1 },
    { id: "vanessa", peso: 138, fator: 1 },
  ];
  it("quem está ausente o mês todo fica fora e a parte dele vai para os outros", () => {
    const r = distribuirMeta(688, pesos, "un");
    expect(r.igor).toBeUndefined();
    expect(Object.values(r).reduce((s, v) => s + v, 0)).toBe(688);
    expect(r.ana).toBe(269); // 197/504 × 688
  });
  it("ausência parcial: a meta é a do mês cheio e o que vale fecha com a da equipe", () => {
    const fatores = { a: 0.5, b: 1 };
    const r = distribuirMeta(300, [{ id: "a", peso: 100, fator: 0.5 }, { id: "b", peso: 100, fator: 1 }], "un");
    // a trabalha metade do mês: vale 100 (= 200 × 0,5); b vale 200
    expect(r).toEqual({ a: 200, b: 200 });
    expect(vale(r, fatores)).toBe(300);
  });
  it("o arredondamento nunca deixa o que vale longe da meta da equipe", () => {
    for (const total of [97, 250, 688, 1001]) {
      const ps = [
        { id: "a", peso: 37, fator: 0.83 },
        { id: "b", peso: 12, fator: 1 },
        { id: "c", peso: 51, fator: 0.41 },
        { id: "d", peso: 20, fator: 0 },
      ];
      const r = distribuirMeta(total, ps, "un");
      expect(Math.abs(vale(r, { a: 0.83, b: 1, c: 0.41 }) - total)).toBeLessThanOrEqual(0.5);
    }
  });
  it("taxa: só quem trabalha recebe", () => {
    expect(distribuirMeta(66, pesos, "%")).toEqual({ ana: 66, bianca: 66, maiane: 66, vanessa: 66 });
  });
  it("participação desconta a ausência", () => {
    const p = participacoes(pesos);
    expect(p.igor).toBe(0);
    expect(Math.round(p.ana * 1000) / 10).toBe(39.1);
  });
  it("todos ausentes: ninguém recebe", () => {
    expect(distribuirMeta(100, [{ id: "a", peso: 10, fator: 0 }], "un")).toEqual({});
  });
});

describe("coerência entre equipe e pessoas", () => {
  const sem = (vs: number[]) => vs.map((valor) => ({ valor }));
  it("aponta equipe e pessoas que não batem", () => {
    expect(incoerencia(688, sem([220, 24, 230, 190, 90]), "un")).toContain("754");
    expect(incoerencia(688, sem([278, 23, 387]), "un")).toBeNull();
    expect(incoerencia(null, sem([1, 2]), "un")).toBeNull();
    expect(incoerencia(66, sem([70, 60]), "%")).toContain("70%");
  });
  it("conta só o que vale para cada pessoa", () => {
    // Igor com meta mas ausente o mês todo: não soma
    expect(incoerencia(504, [{ valor: 320, fator: 1 }, { valor: 184, fator: 0 }, { valor: 184, fator: 1 }], "un")).toBeNull();
    expect(incoerencia(688, [{ valor: 320, fator: 1 }, { valor: 184, fator: 0 }, { valor: 184, fator: 1 }], "un")).toContain(
      "descontadas as ausências",
    );
    // taxa de quem não trabalha no mês não precisa bater
    expect(incoerencia(66, [{ valor: 66, fator: 1 }, { valor: 70, fator: 0 }], "%")).toBeNull();
  });
  it("o que vale para a equipe", () => {
    expect(valeParaEquipe([{ valor: 200, fator: 0.5 }, { valor: 200, fator: 1 }], "un")).toBe(300);
    expect(valeParaEquipe([{ valor: 70, fator: 1 }, { valor: 60, fator: 1 }, { valor: 10, fator: 0 }], "%")).toBe(65);
  });
});
