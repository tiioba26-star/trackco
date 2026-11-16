import { describe, expect, it } from "vitest";
import { assinatura, categoriaMotivo, tendencia } from "../tendencias";

const serie = (valores: [string, number | null][]) => valores.map(([mes, valor]) => ({ mes, valor }));

describe("tendência", () => {
  it("variações, média de 3 meses, ano anterior e meses seguidos em queda", () => {
    const t = tendencia(
      serie([
        ["2025-10", 100],
        ["2026-06", 120],
        ["2026-07", 130],
        ["2026-08", 125],
        ["2026-09", 110],
        ["2026-10", 99],
      ]),
    );
    expect(t.mes).toBe("2026-10");
    expect(t.vs_mes_anterior).toBe(-10);
    expect(t.media_3_anteriores).toBe(121.7);
    expect(t.vs_media_3).toBe(-18.7); // (99 − 121,7) ÷ 121,7 = −18,65%
    expect(t.mesmo_mes_ano_anterior).toBe(100);
    expect(t.vs_ano_anterior).toBe(-1);
    expect(t.meses_seguidos_em_queda).toBe(3); // ago, set e out caíram
    expect(t.meses_seguidos_em_alta).toBe(0);
    expect(t.ultimos.at(-1)).toEqual({ mes: "2026-10", valor: 99, variacao: -10 });
  });

  it("taxas variam em pontos percentuais; mês faltando interrompe a sequência", () => {
    const t = tendencia(
      serie([
        ["2026-07", 60],
        ["2026-08", 65],
        ["2026-10", 70],
      ]),
      { pp: true },
    );
    expect(t.unidade_variacao).toBe("p.p.");
    expect(t.vs_mes_anterior).toBeNull(); // setembro não existe
    expect(t.meses_seguidos_em_alta).toBe(0);
    expect(tendencia([]).mes).toBeNull();
  });

  it("alta seguida", () => {
    expect(tendencia(serie([["2026-08", 1], ["2026-09", 2], ["2026-10", 3]])).meses_seguidos_em_alta).toBe(2);
  });
});

describe("motivos de cancelamento", () => {
  it("vira categoria e nunca devolve o texto", () => {
    expect(categoriaMotivo("")).toBe("Sem motivo registrado");
    expect(categoriaMotivo(null)).toBe("Sem motivo registrado");
    expect(categoriaMotivo("DESEJA ATENDIMENTO PELO SUS")).toBe("Quer pelo SUS ou convênio");
    expect(categoriaMotivo("vai realizar externo")).toBe("Vai fazer em outro lugar");
    expect(categoriaMotivo("PACIENTE ATENDIDO DIA 20/10")).toBe("Já atendido ou erro de cadastro");
    expect(categoriaMotivo("deseja agendar para novembro, orientei retornar no próximo mês")).toBe("Vai remarcar / outra data");
    expect(categoriaMotivo("a pedido da irmã, paciente foi chamado para trabalhar")).toBe("A pedido do paciente ou da família");
    expect(categoriaMotivo("incorreto")).toBe("Já atendido ou erro de cadastro");
    expect(categoriaMotivo("xyz")).toBe("Outros");
  });
});

describe("assinatura", () => {
  it("ignora mudança pequena e pega mudança real, sem depender da ordem das chaves", () => {
    const a = assinatura({ faturamento: 147265, comparecimento: 67.7, pessoas: [{ n: 85 }] });
    expect(assinatura({ comparecimento: 67.9, faturamento: 147765, pessoas: [{ n: 85 }] })).toBe(a);
    expect(assinatura({ faturamento: 160000, comparecimento: 67.7, pessoas: [{ n: 85 }] })).not.toBe(a);
    expect(assinatura({ faturamento: 147265, comparecimento: 67.7, pessoas: [{ n: 86 }] })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
});
