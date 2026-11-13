import { describe, expect, it } from "vitest";
import { calcularRecordes } from "../recordes";
import type { RegrasProducao } from "../producao";
import type { Linha } from "../tipos";

const REGRAS: RegrasProducao = {
  base: [{ campo: "operadora", op: "igual", valor: "Particular" }],
  fora: ["remarcada", "falta_remarcada", "bloqueio_clinica", "erro"],
};
const HOJE = "2026-11-13";
let n = 0;
const l = (em: string, extra: Partial<Linha> = {}): Linha => ({
  chave: String(++n),
  colaborador_id: "eu",
  operadora: "Particular",
  data_agendado_em: em,
  data_agendado_para: null,
  atendido: null,
  situacao: null,
  ...extra,
});
const vezes = (k: number, f: () => Linha) => Array.from({ length: k }, f);

describe("recordes pessoais (só agendamentos válidos)", () => {
  it("melhor dia e melhor mês ignoram remarques, outras pessoas e SUS", () => {
    const linhas = [
      ...vezes(5, () => l("2026-10-03")),
      ...vezes(4, () => l("2026-10-03", { situacao: "remarcada" })), // não conta
      ...vezes(9, () => l("2026-10-04", { colaborador_id: "outra" })), // não é minha
      ...vezes(9, () => l("2026-10-05", { operadora: "SUS" })), // não é Particular
      ...vezes(3, () => l("2026-11-12")),
      l(HOJE),
    ];
    const r = calcularRecordes(linhas, REGRAS, "eu", HOJE, "2025-11-01");
    expect(r.melhorDia).toEqual({ valor: 5, dia: "2026-10-03" });
    expect(r.melhorMes).toEqual({ valor: 5, comp: "2026-10" });
    expect(r.hoje).toBe(1);
    expect(r.mesAtual).toBe(4);
  });

  it("empate: vale o mais recente (o recorde foi igualado)", () => {
    const linhas = [...vezes(4, () => l("2026-09-10")), ...vezes(4, () => l("2026-11-02"))];
    expect(calcularRecordes(linhas, REGRAS, "eu", HOJE, "2025-11-01").melhorDia).toEqual({ valor: 4, dia: "2026-11-02" });
  });

  it("melhor comparecimento só em meses fechados e com pelo menos 20 consultas", () => {
    const consulta = (para: string, veio: boolean) => l("2026-08-01", { data_agendado_para: para, atendido: veio, situacao: veio ? "realizada" : "falta" });
    const linhas = [
      ...vezes(18, () => consulta("2026-09-10", true)),
      ...vezes(2, () => consulta("2026-09-11", false)), // set: 18/20 = 90%
      ...vezes(15, () => consulta("2026-10-10", true)),
      ...vezes(5, () => consulta("2026-10-11", false)), // out: 15/20 = 75%
      ...vezes(10, () => consulta("2026-08-10", true)), // ago: só 10 consultas → fora
      ...vezes(25, () => consulta("2026-11-10", true)), // nov: mês corrente → fora
      ...vezes(30, () => l("2026-08-01", { data_agendado_para: "2026-10-12", situacao: "remarcada" })), // fora da base
    ];
    const r = calcularRecordes(linhas, REGRAS, "eu", HOJE, "2025-11-01");
    expect(r.melhorTaxa).toEqual({ valor: 90, comp: "2026-09" });
  });

  it("sem dados: nada de recorde", () => {
    const r = calcularRecordes([], REGRAS, "eu", HOJE, "2025-11-01");
    expect(r).toMatchObject({ melhorDia: null, melhorMes: null, melhorTaxa: null, hoje: 0, mesAtual: 0 });
  });
});
