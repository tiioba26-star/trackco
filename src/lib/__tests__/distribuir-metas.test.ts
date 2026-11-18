import { describe, expect, it } from "vitest";
import { distribuirMeta, incoerencia, participacoes } from "@/lib/metas/distribuir";

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
  it("aponta equipe e pessoas que não batem", () => {
    expect(incoerencia(688, [220, 24, 230, 190, 90], "un")).toContain("754");
    expect(incoerencia(688, [278, 23, 387], "un")).toBeNull();
    expect(incoerencia(null, [1, 2], "un")).toBeNull();
    expect(incoerencia(66, [70, 60], "%")).toContain("70%");
  });
});
