import { describe, expect, it } from "vitest";
import { apurarEquipe, calcularDias, carinhaPara, encontrarFaixa } from "../apuracao";
import { contarDiasUteis, fimCompetencia, hojeNoFuso, somarDias } from "../datas";
import { calcularMetrica, janelaEfetiva, passaFiltro } from "../metricas";
import type { DefinicaoPlano, EntradaApuracao, Linha, Metrica } from "../tipos";

const SEG_SEX = [1, 2, 3, 4, 5];

const AGENDAMENTOS: Metrica = {
  id: "m-ag",
  codigo: "agendamentos",
  nome: "Agendamentos",
  tipo: "quantitativa",
  unidade: "un",
  definicao: {
    tipo_calculo: "simples",
    fonte: "klingo_agendamentos",
    agregacao: "contar",
    campo_data: "data_agendado_em",
    filtros: [{ campo: "operadora", op: "igual", valor: "Particular" }],
  },
};

const REALIZADAS: Metrica = {
  id: "m-re",
  codigo: "realizadas",
  nome: "Consultas realizadas",
  tipo: "qualitativa",
  unidade: "un",
  definicao: {
    tipo_calculo: "simples",
    fonte: "klingo_agendamentos",
    agregacao: "contar",
    campo_data: "data_realizacao",
    filtros: [
      { campo: "operadora", op: "igual", valor: "Particular" },
      { campo: "atendido", op: "verdadeiro" },
    ],
  },
};

const CONVERSAO: Metrica = {
  id: "m-cv",
  codigo: "conversao",
  nome: "Taxa de conversão",
  tipo: "qualitativa",
  unidade: "%",
  definicao: {
    tipo_calculo: "taxa",
    corte: "hoje",
    numerador: {
      fonte: "klingo_agendamentos",
      agregacao: "contar",
      campo_data: "data_realizacao",
      filtros: [{ campo: "atendido", op: "verdadeiro" }],
    },
    denominador: {
      fonte: "klingo_agendamentos",
      agregacao: "contar",
      campo_data: "data_agendado_para",
      filtros: [],
    },
  },
};

function linha(p: Partial<Linha> & { chave: string; colaborador_id: string | null }): Linha {
  return {
    operadora: "Particular",
    data_agendado_em: null,
    data_agendado_para: null,
    data_realizacao: null,
    atendido: null,
    ...p,
  };
}

const PLANO: DefinicaoPlano = {
  indicadores: [
    { id: "i1", metrica_id: "m-ag", escopo: "individual", aplica_a: "membros", peso: 50, teto_pct: 150, meta_proporcional: true },
    { id: "i2", metrica_id: "m-re", escopo: "individual", aplica_a: "membros", peso: 50, teto_pct: 150, meta_proporcional: true },
    { id: "i3", metrica_id: "m-ag", escopo: "equipe", aplica_a: "lider", peso: 50, teto_pct: 150, meta_proporcional: true },
    { id: "i4", metrica_id: "m-re", escopo: "equipe", aplica_a: "lider", peso: 50, teto_pct: 150, meta_proporcional: true },
  ],
  faixas: [
    { id: "f1", de_pct: 0, ate_pct: 80, nivel: "Em desenvolvimento" },
    { id: "f2", de_pct: 80, ate_pct: 100, nivel: "Quase lá" },
    { id: "f3", de_pct: 100, ate_pct: 120, nivel: "Meta batida", recompensa: { tipo: "reconhecimento", descricao: "Selo" } },
    { id: "f4", de_pct: 120, ate_pct: null, nivel: "Destaque", recompensa: { tipo: "reconhecimento", descricao: "Destaque" } },
  ],
  condicoes: [],
};

function entradaBase(over: Partial<EntradaApuracao> = {}): EntradaApuracao {
  return {
    competencia: "2026-10",
    hoje: "2026-11-10",
    equipe: { id: "eq", nome: "Comercial", dias_trabalho: SEG_SEX },
    membros: [
      { colaborador_id: "ana", nome: "Ana", funcao: "membro", inicio: "2026-01-01", fim: null },
      { colaborador_id: "bia", nome: "Bia", funcao: "membro", inicio: "2026-01-01", fim: null },
      { colaborador_id: "leo", nome: "Léo", funcao: "lider", inicio: "2026-01-01", fim: null },
    ],
    plano: { versao_id: "v1", definicao: PLANO },
    metricas: { "m-ag": AGENDAMENTOS, "m-re": REALIZADAS, "m-cv": CONVERSAO },
    metas: [
      { metrica_id: "m-ag", colaborador_id: "ana", valor: 10 },
      { metrica_id: "m-ag", colaborador_id: "bia", valor: 10 },
      { metrica_id: "m-re", colaborador_id: "ana", valor: 4 },
      { metrica_id: "m-re", colaborador_id: "bia", valor: 4 },
    ],
    ausencias: [],
    feriados: [],
    ajustes: [],
    linhas: { klingo_agendamentos: [] },
    ...over,
  };
}

describe("datas", () => {
  it("conta dias úteis seg-sex de outubro/2026", () => {
    // out/2026: começa numa quinta; 22 dias úteis
    expect(contarDiasUteis("2026-10-01", fimCompetencia("2026-10"), SEG_SEX, new Set())).toBe(22);
  });
  it("desconta feriados", () => {
    expect(contarDiasUteis("2026-10-01", "2026-10-31", SEG_SEX, new Set(["2026-10-12"]))).toBe(21);
  });
  it("hoje no fuso da Bahia", () => {
    // 02:00 UTC de 11/11 ainda é 10/11 em Salvador (UTC-3)
    expect(hojeNoFuso(new Date("2026-11-11T02:00:00Z"))).toBe("2026-11-10");
  });
});

describe("filtros e janelas", () => {
  it("compara texto sem acento e sem caixa", () => {
    const l = linha({ chave: "1", colaborador_id: "ana", operadora: "  PARTÍCULAR " });
    expect(passaFiltro(l, { campo: "operadora", op: "igual", valor: "particular" })).toBe(true);
    expect(passaFiltro(l, { campo: "operadora", op: "em", valor: "SUS, Particular" })).toBe(true);
    expect(passaFiltro(l, { campo: "operadora", op: "nao_em", valor: ["SUS"] })).toBe(true);
  });
  it("corte 'ontem' fecha a janela no dia anterior", () => {
    expect(janelaEfetiva({ inicio: "2026-11-01", fim: "2026-11-30" }, "2026-11-10", "ontem")).toEqual({
      inicio: "2026-11-01",
      fim: "2026-11-09",
    });
    expect(janelaEfetiva({ inicio: "2026-11-01", fim: "2026-11-30" }, "2026-11-01", "ontem")).toBeNull();
  });
});

describe("Q7: quantitativo pela data do agendamento; qualitativo pela data de realização", () => {
  it("consulta agendada em outubro e realizada em novembro conta como realizada em novembro", () => {
    const linhas = [
      linha({ chave: "a", colaborador_id: "ana", data_agendado_em: "2026-10-28", data_agendado_para: "2026-11-05", data_realizacao: "2026-11-05", atendido: true }),
    ];
    const porFonte = () => linhas;
    const out = calcularMetrica(AGENDAMENTOS.definicao, porFonte, { inicio: "2026-10-01", fim: "2026-10-31" }, "2026-11-10", ["ana"]);
    const nov = calcularMetrica(AGENDAMENTOS.definicao, porFonte, { inicio: "2026-11-01", fim: "2026-11-30" }, "2026-11-10", ["ana"]);
    expect(out.valor).toBe(1);
    expect(nov.valor).toBe(0);
    const reOut = calcularMetrica(REALIZADAS.definicao, porFonte, { inicio: "2026-10-01", fim: "2026-10-31" }, "2026-11-10", ["ana"]);
    const reNov = calcularMetrica(REALIZADAS.definicao, porFonte, { inicio: "2026-11-01", fim: "2026-11-30" }, "2026-11-10", ["ana"]);
    expect(reOut.valor).toBe(0);
    expect(reNov.valor).toBe(1);
    expect(reNov.itens).toEqual([{ chave: "a", papel: "realizado" }]);
  });

  it("taxa de conversão = realizadas ÷ marcadas para o período", () => {
    const linhas = [
      linha({ chave: "1", colaborador_id: "ana", data_agendado_para: "2026-11-03", data_realizacao: "2026-11-03", atendido: true }),
      linha({ chave: "2", colaborador_id: "ana", data_agendado_para: "2026-11-04", atendido: false }),
      linha({ chave: "3", colaborador_id: "ana", data_agendado_para: "2026-11-20", atendido: null }), // futura: fora da janela
    ];
    const v = calcularMetrica(CONVERSAO.definicao, () => linhas, { inicio: "2026-11-01", fim: "2026-11-30" }, "2026-11-10", ["ana"]);
    expect(v.numerador).toBe(1);
    expect(v.denominador).toBe(2);
    expect(v.valor).toBe(50);
  });
});

describe("apuração da equipe", () => {
  const linhasOut: Linha[] = [
    ...Array.from({ length: 12 }, (_, i) =>
      linha({ chave: `ana-${i}`, colaborador_id: "ana", data_agendado_em: "2026-10-05", data_agendado_para: "2026-10-15", data_realizacao: i < 4 ? "2026-10-15" : null, atendido: i < 4 }),
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      linha({ chave: `bia-${i}`, colaborador_id: "bia", data_agendado_em: "2026-10-06", data_agendado_para: "2026-10-16", data_realizacao: i < 2 ? "2026-10-16" : null, atendido: i < 2 }),
    ),
    linha({ chave: "conv", colaborador_id: "ana", operadora: "Unimed", data_agendado_em: "2026-10-07" }),
    linha({ chave: "outro", colaborador_id: null, data_agendado_em: "2026-10-07" }),
  ];

  it("calcula atingimento, nota ponderada, faixa e memorial", () => {
    const res = apurarEquipe(entradaBase({ linhas: { klingo_agendamentos: linhasOut } }));
    const ana = res.find((r) => r.colaborador_id === "ana")!;
    expect(ana.indicadores.map((i) => i.realizado)).toEqual([12, 4]); // convênio fica de fora
    expect(ana.indicadores[0].atingimento_pct).toBe(120);
    expect(ana.indicadores[1].atingimento_pct).toBe(100);
    expect(ana.nota_pct).toBe(110);
    expect(ana.faixa?.nivel).toBe("Meta batida");
    expect(ana.recompensa?.tipo).toBe("reconhecimento");
    expect(ana.itens.filter((i) => i.metrica_id === "m-ag")).toHaveLength(12);
    expect(ana.memorial.join("\n")).toContain("Agendamentos");

    const bia = res.find((r) => r.colaborador_id === "bia")!;
    expect(bia.nota_pct).toBe(50); // (50% + 50%)/2
    expect(bia.faixa?.nivel).toBe("Em desenvolvimento");
  });

  it("líder é medido pelo agregado da equipe (soma das metas individuais)", () => {
    const res = apurarEquipe(entradaBase({ linhas: { klingo_agendamentos: linhasOut } }));
    const leo = res.find((r) => r.colaborador_id === "leo")!;
    const [ag, re] = leo.indicadores;
    expect(ag.escopo).toBe("equipe");
    expect(ag.realizado).toBe(17);
    expect(ag.meta).toBe(20);
    expect(ag.atingimento_pct).toBe(85);
    expect(re.realizado).toBe(6);
    expect(re.meta).toBe(8);
    expect(re.atingimento_pct).toBe(75);
    expect(leo.nota_pct).toBe(80);
    expect(leo.faixa?.nivel).toBe("Quase lá");
  });

  it("meta proporcional com férias e ajuste manual", () => {
    // Ana de férias de 19 a 30/10 (10 dias úteis) → 12/22 disponíveis
    const res = apurarEquipe(
      entradaBase({
        linhas: { klingo_agendamentos: linhasOut },
        ausencias: [{ colaborador_id: "ana", inicio: "2026-10-19", fim: "2026-10-30" }],
        ajustes: [{ id: "aj", colaborador_id: "bia", metrica_id: "m-ag", delta: 1, justificativa: "Agendamento lançado no login de outra pessoa" }],
      }),
    );
    const ana = res.find((r) => r.colaborador_id === "ana")!;
    expect(ana.dias.disponiveis_total).toBe(12);
    expect(ana.indicadores[0].meta_ajustada).toBe(5.45);
    expect(ana.indicadores[0].atingimento_considerado_pct).toBe(150); // teto
    const bia = res.find((r) => r.colaborador_id === "bia")!;
    expect(bia.indicadores[0].realizado).toBe(6);
    expect(bia.memorial.some((m) => m.includes("outra pessoa"))).toBe(true);
  });

  it("condição bloqueia a recompensa", () => {
    const plano: DefinicaoPlano = {
      ...PLANO,
      indicadores: [...PLANO.indicadores, { id: "i5", metrica_id: "m-cv", escopo: "individual", aplica_a: "membros", peso: 0, teto_pct: 100, meta_proporcional: false }],
      condicoes: [{ id: "c1", descricao: "Conversão mínima de 50%", indicador_id: "i5", base: "realizado", operador: ">=", valor: 50, efeito: "bloquear_recompensa" }],
    };
    const res = apurarEquipe(entradaBase({ plano: { versao_id: "v2", definicao: plano }, linhas: { klingo_agendamentos: linhasOut } }));
    const ana = res.find((r) => r.colaborador_id === "ana")!;
    // 4 realizadas / 12 marcadas = 33%
    expect(ana.condicoes[0].ok).toBe(false);
    expect(ana.faixa?.nivel).toBe("Meta batida");
    expect(ana.recompensa).toBeNull();
  });

  it("mês corrente calcula projeção e ritmo necessário", () => {
    const linhas = Array.from({ length: 6 }, (_, i) =>
      linha({ chave: `n${i}`, colaborador_id: "ana", data_agendado_em: "2026-11-03" }),
    );
    const res = apurarEquipe(entradaBase({ competencia: "2026-11", hoje: "2026-11-10", linhas: { klingo_agendamentos: linhas } }));
    const ag = res.find((r) => r.colaborador_id === "ana")!.indicadores[0];
    // nov/2026: 21 dias úteis; até 10/11: 7 decorridos; restantes contando hoje: 15
    expect(ag.projecao).toBe(18);
    expect(ag.ritmo_necessario_dia).toBe(0.3);
  });

  it("membro que entrou no meio do mês tem meta proporcional", () => {
    const d = calcularDias(entradaBase(), { colaborador_id: "x", nome: "X", funcao: "membro", inicio: "2026-10-16", fim: null });
    expect(d.uteis_total).toBe(22);
    expect(d.disponiveis_total).toBe(11);
    expect(d.fator_proporcional).toBe(0.5);
  });
});

describe("faixas e carinhas", () => {
  it("encontra a faixa pelo intervalo [de, até)", () => {
    expect(encontrarFaixa(PLANO.faixas, 79.9)?.id).toBe("f1");
    expect(encontrarFaixa(PLANO.faixas, 80)?.id).toBe("f2");
    expect(encontrarFaixa(PLANO.faixas, 250)?.id).toBe("f4");
    expect(encontrarFaixa(PLANO.faixas, null)).toBeNull();
  });
  it("carinha nunca é triste", () => {
    expect(carinhaPara(0)).toBe("neutra");
    expect(carinhaPara(null)).toBe("neutra");
    expect(carinhaPara(85)).toBe("feliz");
    expect(carinhaPara(130)).toBe("mega_feliz");
  });
  it("somarDias atravessa meses", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("métricas somente de análise (SUS)", () => {
  it("nunca entram na nota, mesmo se alguém colocar no plano", () => {
    const sus: Metrica = {
      ...AGENDAMENTOS,
      id: "m-sus",
      codigo: "agendamentos_sus",
      definicao: { ...AGENDAMENTOS.definicao, somente_analise: true, filtros: [{ campo: "operadora", op: "contem", valor: "SUS" }] } as Metrica["definicao"],
    };
    const plano: DefinicaoPlano = {
      ...PLANO,
      indicadores: [
        { id: "i1", metrica_id: "m-ag", escopo: "individual", aplica_a: "membros", peso: 50, teto_pct: 150, meta_proporcional: false },
        { id: "isus", metrica_id: "m-sus", escopo: "individual", aplica_a: "membros", peso: 50, teto_pct: 150, meta_proporcional: false },
      ],
    };
    const linhas = [
      linha({ chave: "p", colaborador_id: "ana", data_agendado_em: "2026-10-05" }),
      ...Array.from({ length: 50 }, (_, i) => linha({ chave: `s${i}`, colaborador_id: "ana", operadora: "SUS", data_agendado_em: "2026-10-05" })),
    ];
    const res = apurarEquipe(
      entradaBase({
        plano: { versao_id: "v", definicao: plano },
        metricas: { "m-ag": AGENDAMENTOS, "m-sus": sus },
        metas: [
          { metrica_id: "m-ag", colaborador_id: "ana", valor: 10 },
          { metrica_id: "m-sus", colaborador_id: "ana", valor: 10 },
        ],
        linhas: { klingo_agendamentos: linhas },
      }),
    );
    const ana = res.find((r) => r.colaborador_id === "ana")!;
    expect(ana.indicadores.map((i) => i.metrica_id)).toEqual(["m-ag"]);
    expect(ana.nota_pct).toBe(10); // só o Particular (1 de 10), o SUS (500%) não conta
    expect(ana.memorial.join(" ")).toContain("somente análise");
  });
});
