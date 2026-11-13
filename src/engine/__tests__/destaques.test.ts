import { describe, expect, it } from "vitest";
import { crescimento, destaquesDoMes, rankingComparecimento, rankingMelhorou } from "../destaques";
import { producaoVazia, type Producao, type RegrasProducao } from "../producao";
import type { Linha } from "../tipos";

const REGRAS: RegrasProducao = { base: [{ campo: "operadora", op: "igual", valor: "Particular" }], fora: ["remarcada", "falta_remarcada", "bloqueio_clinica", "erro"] };
const P = (v: Partial<Producao>): Producao => ({ ...producaoVazia(), ...v });

describe("outras formas de ganhar", () => {
  it("crescimento só com base suficiente", () => {
    expect(crescimento(12, 10)).toBe(20);
    expect(crescimento(3, 1)).toBeNull(); // de 1 para 3 não é "+200%"
  });

  it("quem mais melhorou: só quem cresceu, do maior para o menor", () => {
    const atual = new Map([["a", P({ agendouValidos: 60 })], ["b", P({ agendouValidos: 30 })], ["c", P({ agendouValidos: 10 })], ["d", P({ agendouValidos: 9 })]]);
    const ant = new Map([["a", P({ agendouValidos: 50 })], ["b", P({ agendouValidos: 20 })], ["c", P({ agendouValidos: 20 })], ["d", P({ agendouValidos: 2 })]]);
    expect(rankingMelhorou(atual, ant, ["a", "b", "c", "d"]).map((x) => [x.id, x.pct])).toEqual([["b", 50], ["a", 20]]);
  });

  it("melhor comparecimento exige 10 consultas em dias que já passaram", () => {
    const atual = new Map([
      ["a", P({ encerradasMarcadas: 20, encerradasCompareceram: 15 })],
      ["b", P({ encerradasMarcadas: 4, encerradasCompareceram: 4 })],
      ["c", P({ encerradasMarcadas: 10, encerradasCompareceram: 9 })],
    ]);
    expect(rankingComparecimento(atual, ["a", "b", "c"]).map((x) => [x.id, x.taxa])).toEqual([["c", 90], ["a", 75]]);
  });
});

describe("destaques do mês fechado", () => {
  let n = 0;
  const l = (quem: string, em: string, extra: Partial<Linha> = {}): Linha => ({
    chave: String(++n), colaborador_id: quem, operadora: "Particular", data_agendado_em: em, data_agendado_para: null, atendido: null, situacao: null, ...extra,
  });
  const vezes = (k: number, f: () => Linha) => Array.from({ length: k }, f);

  it("volume, melhor dia (sem remarques) e comparação com o mês anterior", () => {
    const linhas = [
      ...vezes(6, () => l("a", "2026-10-03")),
      ...vezes(5, () => l("a", "2026-10-03", { situacao: "remarcada" })),
      ...vezes(4, () => l("b", "2026-10-03")),
      ...vezes(3, () => l("b", "2026-10-20")),
      ...vezes(5, () => l("a", "2026-09-10")),
      ...vezes(5, () => l("b", "2026-09-10")),
    ];
    const d = destaquesDoMes(linhas, REGRAS, ["a", "b"], "2026-10", "2026-09", "2026-11-13");
    expect(d.equipe).toMatchObject({ validos: 13, total: 18, validosAnt: 10, crescimento: 30, melhorDia: { dia: "2026-10-03", valor: 10 } });
    expect(d.pessoas.find((p) => p.id === "b")).toMatchObject({ validos: 7, crescimento: 40, melhorDia: { dia: "2026-10-03", valor: 4 } });
    expect(d.vencedores).toEqual({ volume: "b", melhorou: "b", comparecimento: null });
  });
});
