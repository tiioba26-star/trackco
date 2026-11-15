import { describe, expect, it } from "vitest";
import { FAIXAS_DE_FATOS, faixaDoPercentual, fatoDaFaixa, fatosDoMes } from "../fatos-percentuais";

const mesesSeguidos = (de: string, n: number) => {
  const [a, m] = de.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = a * 12 + (m - 1) + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  });
};

describe("tabela de fatos por porcentagem", () => {
  it("cada faixa tem pelo menos 12 fatos, e cada número citado cabe na faixa", () => {
    for (const fx of FAIXAS_DE_FATOS) {
      expect(fx.fatos.length, fx.rotulo).toBeGreaterThanOrEqual(12);
      for (const fato of fx.fatos) {
        expect(fato.valor >= fx.de && fato.valor <= fx.ate, `${fx.rotulo}: ${fato.texto}`).toBe(true);
        expect(fato.texto.length, fato.texto).toBeLessThanOrEqual(150);
      }
    }
  });

  it("as faixas cobrem de 0,5% a 100% sem buraco e sem fato repetido", () => {
    for (let i = 1; i < FAIXAS_DE_FATOS.length; i++) expect(FAIXAS_DE_FATOS[i].de).toBe(FAIXAS_DE_FATOS[i - 1].ate);
    expect(FAIXAS_DE_FATOS[0].de).toBe(0.5);
    expect(FAIXAS_DE_FATOS.at(-1)!.ate).toBe(100);
    const textos = FAIXAS_DE_FATOS.flatMap((fx) => fx.fatos.map((x) => x.texto));
    expect(new Set(textos).size).toBe(textos.length);
    expect(faixaDoPercentual(0.2)).toBe(-1);
    expect(FAIXAS_DE_FATOS[faixaDoPercentual(100)].rotulo).toBe("95% a 100%");
    expect(FAIXAS_DE_FATOS[faixaDoPercentual(15)].rotulo).toBe("15%");
    expect(FAIXAS_DE_FATOS[faixaDoPercentual(70.6)].rotulo).toBe("70%");
  });

  it("em 12 meses seguidos, a mesma faixa nunca repete um fato (inclusive virando o ano)", () => {
    for (let fx = 0; fx < FAIXAS_DE_FATOS.length; fx++) {
      const textos = mesesSeguidos("2026-06", 12).map((c) => fatoDaFaixa(fx, c).texto);
      expect(new Set(textos).size).toBe(12);
    }
  });

  it("quem tirar a mesma porcentagem todo mês vê um fato diferente em cada um dos 12 meses", () => {
    for (const p of [1, 2, 3, 5, 8, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]) {
      const vistos = mesesSeguidos("2026-09", 12).map((c) => fatosDoMes([p], c)[0]!.texto);
      expect(new Set(vistos).size, `${p}%`).toBe(12);
    }
  });

  it("nenhum fato toca em temas que incomodam quem tem fé", () => {
    const proibidos = /chimpanz|macaco|neandert|antepassad|ancestra|evolu|extint|milh(õ|o)es de anos|bilh(õ|o)es de anos|big bang/i;
    for (const fx of FAIXAS_DE_FATOS) for (const f of fx.fatos) expect(f.texto, f.texto).not.toMatch(proibidos);
    expect(FAIXAS_DE_FATOS.flatMap((fx) => fx.fatos).filter((f) => f.emoji === "📖").length).toBeGreaterThanOrEqual(20);
  });

  it("no mesmo mês, cada faixa sai uma vez só: a de maior prioridade (a primeira) leva o fato", () => {
    const [a, b, c] = fatosDoMes([15, 16, 72], "2026-10");
    expect(a?.valor).toBeGreaterThanOrEqual(12.5);
    expect(a?.valor).toBeLessThan(17.5);
    expect(b).toBeNull(); // mesma faixa de 15%: um fato de outra faixa citaria outro número
    expect(c?.valor).toBeGreaterThanOrEqual(65);
    expect(fatosDoMes([null, 0.1, 150], "2026-10")).toEqual([null, null, null]);
  });

  it("ninguém vê o mesmo fato duas vezes num ano, mesmo com várias telas por mês", () => {
    // sorteio fixo de porcentagens (5 telas por mês), parecido com o que a retrospectiva mostra
    let semente = 7;
    const sorteio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 100;
    for (let pessoa = 0; pessoa < 40; pessoa++) {
      const vistos: string[] = [];
      for (const comp of mesesSeguidos("2026-03", 12)) {
        const fatos = fatosDoMes(Array.from({ length: 5 }, sorteio), comp);
        for (const x of fatos) if (x) vistos.push(x.texto);
      }
      expect(new Set(vistos).size).toBe(vistos.length);
    }
  });
});
