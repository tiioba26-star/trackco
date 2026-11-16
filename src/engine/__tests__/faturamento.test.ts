import { describe, expect, it } from "vitest";
import {
  ehCortesia,
  grupoOperadora,
  nomeOperadora,
  procedimentosSemProducao,
  tabelaPreco,
  tipoAgenda,
  titulo,
} from "../classificacao";
import { decompor, faixaDoQuartil, maioresVariacoes, quartis, resumoFaturamento, variacao } from "../faturamento";
import { janelaAnoAnterior } from "../periodos";

describe("classificação", () => {
  it("separa médico de agenda de exame", () => {
    expect(tipoAgenda("ANDRÉ BORN")).toBe("medico");
    expect(tipoAgenda("AGENDA TOMOGRAFIA")).toBe("exame");
    expect(tipoAgenda("Sala de Colírio")).toBe("exame");
    expect(tipoAgenda("Pré-operatório Cirúrgico")).toBe("exame");
  });
  it("reconhece cortesia", () => {
    expect(ehCortesia("CONSULTA CORTESIA")).toBe(true);
    expect(ehCortesia("Retorno - cortesia")).toBe(true);
    expect(ehCortesia("CONSULTA OFTALMOLOGICA")).toBe(false);
  });
  it("agrupa operadoras do 2331 e do 319", () => {
    expect(grupoOperadora("Particular")).toBe("Particular");
    expect(grupoOperadora("Particular - M. M. VASCONCELOS")).toBe("Particular");
    expect(grupoOperadora("SUS - SUS")).toBe("SUS");
    expect(grupoOperadora("SUS")).toBe("SUS");
    expect(grupoOperadora("BRADESCO SAÚDE")).toBe("Convênios");
    expect(grupoOperadora("SUSTENTARE")).toBe("Convênios");
    expect(nomeOperadora("Particular - PARTICULAR")).toBe("Particular");
    expect(tabelaPreco("Particular - M. M. VASCONCELOS")).toBe("M. M. VASCONCELOS");
    expect(tabelaPreco("SUS")).toBe("SUS");
  });
  it("título com partículas minúsculas", () => {
    expect(titulo("ANDRÉ BORN DE SOUZA")).toBe("André Born de Souza");
  });
  it("procedimentos que quase nunca viram faturamento ficam fora da taxa", () => {
    const s = procedimentosSemProducao([
      { procedimento: "ENTREGA DE EXAME", verificaveis: 40, atendidas: 1 },
      { procedimento: "CONSULTA", verificaveis: 100, atendidas: 70 },
      { procedimento: "RARO", verificaveis: 2, atendidas: 0 },
    ]);
    expect([...s]).toEqual(["ENTREGA DE EXAME"]);
  });
});

describe("faturamento", () => {
  const dia = (data: string, qtd: number, valor: number) => ({ data, qtd, valor });

  it("resume total, procedimentos, dias e valor médio", () => {
    const r = resumoFaturamento([dia("2026-10-01", 2, 300), dia("2026-10-01", 1, 100), dia("2026-10-02", 1, 200)]);
    expect(r).toEqual({ valor: 600, qtd: 4, dias: 2, valorMedio: 150, porDia: 2 });
    expect(resumoFaturamento([]).valorMedio).toBeNull();
  });

  it("os três efeitos somam exatamente a diferença", () => {
    const a = resumoFaturamento([dia("2026-09-01", 10, 1000), dia("2026-09-02", 10, 1000)]);
    const b = resumoFaturamento([dia("2026-10-01", 12, 1500), dia("2026-10-02", 12, 1500), dia("2026-10-03", 9, 999.99)]);
    const d = decompor(a, b);
    expect(d.diferenca).toBe(1999.99);
    expect(Math.round((d.dias + d.volume + d.valorMedio) * 100) / 100).toBe(d.diferenca);
    expect(d.dias).toBe(1000); // um dia a mais × 10 proc/dia × R$ 100
    expect(d.volume).toBeGreaterThan(0);
    expect(d.valorMedio).toBeGreaterThan(0);
  });

  it("sem base, a diferença inteira fica em dias", () => {
    const d = decompor(resumoFaturamento([]), resumoFaturamento([dia("2026-10-01", 1, 50)]));
    expect(d).toEqual({ diferenca: 50, dias: 50, volume: 0, valorMedio: 0 });
  });

  it("maiores ganhos e quedas", () => {
    const v = maioresVariacoes(new Map([["A", 100], ["B", 50], ["C", 10]]), new Map([["A", 80], ["B", 90], ["D", 5]]));
    expect(v.ganhos.map((x) => x.rotulo)).toEqual(["B", "D"]);
    expect(v.quedas.map((x) => x.rotulo)).toEqual(["A", "C"]);
  });

  it("quartis e faixa", () => {
    const q = quartis([1, 2, 3, 4, 5])!;
    expect(q).toEqual({ q1: 2, mediana: 3, q3: 4 });
    expect(faixaDoQuartil(5, q)).toBe("acima");
    expect(faixaDoQuartil(3, q)).toBe("media_alta");
    expect(faixaDoQuartil(2.5, q)).toBe("media_baixa");
    expect(faixaDoQuartil(1, q)).toBe("abaixo");
    expect(quartis([])).toBeNull();
  });

  it("variação e ano anterior", () => {
    expect(variacao(100, 150)).toBe(50);
    expect(variacao(0, 10)).toBeNull();
    expect(janelaAnoAnterior({ inicio: "2028-02-01", fim: "2028-02-29" }, "2028-03-10")).toMatchObject({
      inicio: "2027-02-01",
      fim: "2027-02-28",
    });
  });
});
