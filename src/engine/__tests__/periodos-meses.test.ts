import { describe, expect, it } from "vitest";
import { atalhoDosMeses, mesesDoAtalho, textoMeses } from "../periodos-meses";

describe("períodos em meses", () => {
  it("atalhos a partir de novembro/2026", () => {
    expect(mesesDoAtalho("mes", "2026-11")).toEqual({ de: "2026-11", ate: "2026-11" });
    expect(mesesDoAtalho("mes_passado", "2026-11")).toEqual({ de: "2026-10", ate: "2026-10" });
    expect(mesesDoAtalho("6m", "2026-11")).toEqual({ de: "2026-06", ate: "2026-11" });
    expect(mesesDoAtalho("3m", "2026-11")).toEqual({ de: "2026-08", ate: "2026-10" });
    expect(mesesDoAtalho("ano", "2026-11")).toEqual({ de: "2026-01", ate: "2026-11" });
    expect(mesesDoAtalho("12m", "2026-01")).toEqual({ de: "2025-01", ate: "2025-12" });
  });
  it("reconhece o atalho pelas datas", () => {
    expect(atalhoDosMeses("2026-06", "2026-11", "2026-11")).toBe("6m");
    expect(atalhoDosMeses("2026-02", "2026-05", "2026-11")).toBe("personalizado");
  });
  it("escreve os meses por extenso", () => {
    expect(textoMeses("2026-06", "2026-11")).toBe("junho a novembro de 2026");
    expect(textoMeses("2025-12", "2026-03")).toBe("dezembro de 2025 a março de 2026");
    expect(textoMeses("2026-11", "2026-11")).toBe("novembro de 2026");
  });
});
