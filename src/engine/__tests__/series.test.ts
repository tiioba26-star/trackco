import { describe, expect, it } from "vitest";
import type { RegrasProducao } from "../producao";
import { calendarioDoMes, comparecimentoPorSemana, mediaPorDiaDaSemana, semanasAte, somaPorMes, somaPorSemana, validosPorDia } from "../series";
import type { Linha } from "../tipos";

const REGRAS: RegrasProducao = { base: [{ campo: "operadora", op: "igual", valor: "Particular" }], fora: ["remarcada", "erro"] };
let n = 0;
const l = (em: string, extra: Partial<Linha> = {}): Linha => ({ chave: String(++n), colaborador_id: "a", operadora: "Particular", data_agendado_em: em, situacao: null, ...extra });

describe("séries da TV", () => {
  it("válidos por dia ignoram remarques e outro convênio", () => {
    const m = validosPorDia([l("2026-11-02"), l("2026-11-02"), l("2026-11-02", { situacao: "remarcada" }), l("2026-11-03", { operadora: "SUS" })], REGRAS, "2026-11-01", "2026-11-30");
    expect([...m]).toEqual([["2026-11-02", 2]]);
  });

  it("semanas começam na segunda e a última é a de hoje (sexta 13/11)", () => {
    const s = semanasAte("2026-11-13", 3);
    expect(s).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(somaPorSemana(new Map([["2026-11-08", 4], ["2026-11-09", 5], ["2026-11-15", 1]]), s)).toEqual([0, 4, 6]);
  });

  it("comparecimento por semana só com dias passados e 10+ consultas", () => {
    const c = (para: string, veio: boolean) => l("2026-10-01", { data_agendado_para: para, atendido: veio });
    const linhas = [...Array.from({ length: 8 }, () => c("2026-11-03", true)), ...Array.from({ length: 2 }, () => c("2026-11-04", false)), c("2026-11-13", true)];
    const r = comparecimentoPorSemana(linhas, REGRAS, ["2026-11-02", "2026-11-09"], "2026-11-13");
    expect(r[0]).toEqual({ marcadas: 10, vieram: 8, taxa: 80 });
    expect(r[1]).toEqual({ marcadas: 0, vieram: 0, taxa: null }); // 13/11 é hoje: ainda não conta
  });

  it("média por dia da semana e calendário do mês", () => {
    const porDia = new Map([["2026-11-02", 10], ["2026-11-09", 20], ["2026-11-03", 3]]);
    const m = mediaPorDiaDaSemana(porDia, "2026-11-02", "2026-11-15");
    expect(m.find((x) => x.rotulo === "Seg")).toMatchObject({ total: 30, media: 15 });
    expect(m.some((x) => x.rotulo === "Dom")).toBe(false);
    const cal = calendarioDoMes("2026-11", porDia, "2026-11-13");
    expect(cal[0]).toMatchObject({ data: "2026-11-01", dow: 7, semana: 0 }); // 01/11/2026 é domingo
    expect(cal[1]).toMatchObject({ data: "2026-11-02", dow: 1, semana: 1, valor: 10 });
    expect(cal.find((d) => d.data === "2026-11-20")?.valor).toBeNull();
    expect(somaPorMes(porDia).get("2026-11")).toBe(33);
  });
});
