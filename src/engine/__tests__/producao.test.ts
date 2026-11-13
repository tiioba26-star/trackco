import { describe, expect, it } from "vitest";
import { janelaAnterior, janelaDoMes, janelaPersonalizada, janelaRapida, mesesDaJanela, textoDatas } from "../periodos";
import { contarProducao, regrasProducao, somarProducao } from "../producao";
import type { Linha, Metrica } from "../tipos";

const HOJE = "2026-11-13"; // sexta

describe("período anterior no mesmo ponto (comparação justa)", () => {
  it("dia, semana, mês corrente, mês fechado e período escolhido", () => {
    expect(janelaAnterior(janelaRapida("hoje", HOJE), HOJE)).toMatchObject({ inicio: "2026-11-06", fim: "2026-11-06" });
    expect(janelaAnterior(janelaRapida("semana", HOJE), HOJE)).toMatchObject({ inicio: "2026-10-31", fim: "2026-11-06", nome: "7 dias antes (31/10 a 06/11)" });
    expect(janelaAnterior(janelaRapida("mes", HOJE), HOJE)).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-13", nome: "outubro até o dia 13" });
    expect(janelaAnterior(janelaRapida("mes", "2026-03-31"), "2026-03-31")).toMatchObject({ fim: "2026-02-28" });
    expect(janelaAnterior(janelaRapida("mes_passado", HOJE), HOJE)).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30" });
    expect(janelaAnterior(janelaPersonalizada("2026-10-11", "2026-10-20", HOJE), HOJE)).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-10" });
  });
});

describe("períodos com datas por extenso", () => {
  it("hoje, últimos 7 dias, mês até agora e mês passado", () => {
    expect(janelaRapida("hoje", HOJE)).toMatchObject({ inicio: HOJE, fim: HOJE, nome: "Hoje", datas: "sex, 13/11" });
    expect(janelaRapida("semana", HOJE)).toMatchObject({ inicio: "2026-11-07", fim: HOJE, fimPara: HOJE, nome: "Últimos 7 dias", datas: "07/11 a 13/11" });
    expect(janelaRapida("mes", HOJE)).toMatchObject({ inicio: "2026-11-01", fim: HOJE, nome: "Novembro até agora", datas: "01/11 a 13/11" });
    expect(janelaRapida("mes_passado", HOJE)).toMatchObject({
      inicio: "2026-10-01",
      fim: "2026-10-31",
      nome: "Outubro (mês passado)",
      emAndamento: false,
    });
  });

  it("7 dias que começam no mês anterior e meses de outro ano", () => {
    expect(janelaRapida("semana", "2026-12-02").inicio).toBe("2026-11-26");
    expect(mesesDaJanela("2026-11-30", "2026-12-02")).toEqual(["2026-11", "2026-12"]);
    expect(janelaDoMes("2025-03", HOJE)).toMatchObject({ nome: "Março de 2025", datas: "01/03/2025 a 31/03/2025" });
    expect(textoDatas("2026-01-05", "2026-01-05")).toBe("seg, 05/01");
  });
});

const particular = { campo: "operadora", op: "igual" as const, valor: "Particular" };
const AGEND: Metrica = {
  id: "a",
  codigo: "agendamentosparticular",
  nome: "Agendamentos",
  tipo: "quantitativa",
  unidade: "un",
  definicao: { tipo_calculo: "simples", fonte: "klingo_agendamentos", agregacao: "contar", campo_data: "data_agendado_em", filtros: [particular] },
};

let n = 0;
const linha = (o: Partial<Linha> & Record<string, unknown>): Linha => ({
  chave: `k${n++}`,
  colaborador_id: "ana",
  operadora: "Particular",
  atendido: null,
  situacao: null,
  ...o,
});

describe("produção por pessoa", () => {
  const regras = regrasProducao(AGEND, null)!;
  const janela = { inicio: "2026-11-01", fim: HOJE };

  it("separa agendou, remarques e válidos; marcadas para e o desfecho de cada consulta", () => {
    const linhas = [
      // marcou em novembro, consulta em novembro, veio
      linha({ data_agendado_em: "2026-11-03", data_agendado_para: "2026-11-05", atendido: true, situacao: "realizada" }),
      // marcou, depois remarcou (a original fica "remarcada"; a nova é outra linha)
      linha({ data_agendado_em: "2026-11-04", data_agendado_para: "2026-11-06", situacao: "remarcada" }),
      linha({ data_agendado_em: "2026-11-06", data_agendado_para: "2026-11-10", situacao: "cancelada" }),
      // marcada em outubro PARA novembro: não conta como "agendou" em novembro, mas conta em "marcadas para"
      linha({ data_agendado_em: "2026-10-20", data_agendado_para: "2026-11-11", situacao: "nao_realizada" }),
      // futura
      linha({ data_agendado_em: "2026-11-12", data_agendado_para: "2026-11-20" }),
      // erro de cadastro
      linha({ data_agendado_em: "2026-11-12", data_agendado_para: "2026-11-12", situacao: "erro" }),
      // SUS não entra na categoria Particular
      linha({ data_agendado_em: "2026-11-12", data_agendado_para: "2026-11-12", operadora: "SUS", atendido: true }),
    ];
    const p = contarProducao(linhas, regras, janela, HOJE, { inicio: "2026-11-01", fim: "2026-11-30" }).get("ana")!;
    expect(p.agendou).toBe(5);
    expect(p.agendouRemarcadas).toBe(1);
    expect(p.agendouOutras).toBe(1);
    expect(p.agendouValidos).toBe(3);
    expect(p.marcadasPara).toBe(4); // 05, 10, 11 e 20 (o mês inteiro; 06 foi remarcada, 12 foi erro)
    expect(p.remarcadasPara).toBe(1);
    expect(p.compareceram).toBe(1);
    expect(p.desmarcaram).toBe(1);
    expect(p.faltaram).toBe(1);
    expect(p.aguardando).toBe(1);
    // taxa só com dias encerrados: 05, 10 e 11 → 1 de 3
    expect(p.encerradasMarcadas).toBe(3);
    expect(p.conversao).toBe(33.3);
  });

  it("até agora: sem a janela do mês inteiro, a consulta futura fica de fora", () => {
    const linhas = [linha({ data_agendado_em: "2026-11-12", data_agendado_para: "2026-11-20" })];
    const p = contarProducao(linhas, regras, janela, HOJE).get("ana")!;
    expect(p.agendou).toBe(1);
    expect(p.marcadasPara).toBe(0);
  });

  it("soma a equipe e recalcula a taxa pelo total (não pela média)", () => {
    const linhas = [
      linha({ colaborador_id: "ana", data_agendado_em: "2026-11-02", data_agendado_para: "2026-11-03", atendido: true }),
      linha({ colaborador_id: "bia", data_agendado_em: "2026-11-02", data_agendado_para: "2026-11-03" , situacao: "nao_realizada"}),
      linha({ colaborador_id: "bia", data_agendado_em: "2026-11-02", data_agendado_para: "2026-11-04", situacao: "nao_realizada" }),
    ];
    const t = somarProducao(Array.from(contarProducao(linhas, regras, janela, HOJE).values()));
    expect(t.agendou).toBe(3);
    expect(t.conversao).toBe(33.3);
  });
});
