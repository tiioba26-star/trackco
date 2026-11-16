import { describe, expect, it } from "vitest";
import { janelaBase, janelaGestao, mesesInteiros } from "../periodos-gestao";

const HOJE = "2026-11-16";

describe("períodos da Gestão", () => {
  it("atalhos ignoram as datas e usam o próprio intervalo", () => {
    expect(janelaGestao("3m", "2026-10-01", "2026-10-31", HOJE)).toMatchObject({ inicio: "2026-08-01", fim: "2026-10-31", periodo: "3m" });
    expect(janelaGestao("12m", null, null, HOJE)).toMatchObject({ inicio: "2025-11-01", fim: "2026-10-31" });
    expect(janelaGestao("mes_passado", null, null, HOJE)).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(janelaGestao("mes", null, null, HOJE)).toMatchObject({ inicio: "2026-11-01", fim: HOJE, emAndamento: true });
    expect(janelaGestao("ano", null, null, HOJE)).toMatchObject({ inicio: "2026-01-01", fim: HOJE });
  });

  it("meses inteiros", () => {
    expect(mesesInteiros("2026-08-01", "2026-10-31")).toBe(3);
    expect(mesesInteiros("2026-10-01", "2026-10-31")).toBe(1);
    expect(mesesInteiros("2025-11-01", "2026-10-31")).toBe(12);
    expect(mesesInteiros("2026-10-05", "2026-10-31")).toBe(0);
    expect(mesesInteiros("2026-10-01", "2026-10-30")).toBe(0);
  });

  it("meses inteiros comparam com os mesmos meses logo antes", () => {
    const tres = janelaGestao("3m", null, null, HOJE);
    expect(janelaBase(tres, "anterior", HOJE)).toEqual({ inicio: "2026-05-01", fim: "2026-07-31", nome: "maio a julho" });
    const doze = janelaGestao("12m", null, null, HOJE);
    expect(janelaBase(doze, "anterior", HOJE)).toEqual({
      inicio: "2024-11-01",
      fim: "2025-10-31",
      nome: "novembro de 2024 a outubro de 2025",
    });
    // outubro escolhido à mão compara com setembro, e o nome do período fica claro
    const out = janelaGestao("personalizado", "2026-10-01", "2026-10-31", HOJE);
    expect(out.nome).toBe("Outubro");
    expect(janelaBase(out, "anterior", HOJE)).toEqual({ inicio: "2026-09-01", fim: "2026-09-30", nome: "setembro" });
  });

  it("mês em andamento compara até o mesmo dia; datas soltas, o mesmo número de dias antes", () => {
    const mes = janelaGestao("mes", null, null, HOJE);
    expect(janelaBase(mes, "anterior", HOJE)).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-16" });
    const solto = janelaGestao("personalizado", "2026-10-05", "2026-10-20", HOJE);
    expect(solto.nome).toBe("Período escolhido");
    expect(janelaBase(solto, "anterior", HOJE)).toMatchObject({ inicio: "2026-09-19", fim: "2026-10-04" });
    expect(janelaBase(solto, "ano", HOJE)).toMatchObject({ inicio: "2025-10-05", fim: "2025-10-20" });
    expect(janelaBase(solto, "nada", HOJE)).toBeNull();
  });

  it("datas invertidas ou no futuro são corrigidas", () => {
    expect(janelaGestao("personalizado", "2026-10-20", "2026-10-05", HOJE)).toMatchObject({ inicio: "2026-10-05", fim: "2026-10-20" });
    expect(janelaGestao("personalizado", "2026-11-01", "2026-12-31", HOJE)).toMatchObject({ fim: HOJE, emAndamento: true });
  });
});
