import { describe, expect, it } from "vitest";
import type { Filtro, Metrica } from "@/engine/tipos";
import { explicarMetrica } from "@/lib/explicar-metrica";
import { metricaPorPapel, resolverMetrica } from "@/lib/metricas-papel";

const particular = { campo: "operadora", op: "igual" as const, valor: "Particular" };
const sus = { campo: "operadora", op: "contem" as const, valor: "SUS" };
const compareceu = { campo: "atendido", op: "verdadeiro" as const };
const k = (campo_data: string, filtros: Filtro[]) => ({
  fonte: "klingo_agendamentos" as const,
  agregacao: "contar" as const,
  campo_data,
  filtros,
});

// códigos renomeados de propósito, como aconteceu em produção
const METRICAS: Metrica[] = [
  { id: "1", codigo: "agendamentosparticular", nome: "Agendamentos Particular", tipo: "quantitativa", unidade: "un", definicao: { tipo_calculo: "simples", ...k("data_agendado_em", [particular]) } },
  { id: "2", codigo: "agendamentos_sus", nome: "Agendamentos SUS", tipo: "quantitativa", unidade: "un", definicao: { tipo_calculo: "simples", somente_analise: true, ...k("data_agendado_em", [sus]) } },
  { id: "3", codigo: "realizadasparticular", nome: "Realizadas", tipo: "qualitativa", unidade: "un", definicao: { tipo_calculo: "simples", ...k("data_realizacao", [particular, compareceu]) } },
  {
    id: "4",
    codigo: "conversaoparticular",
    nome: "Conversão",
    tipo: "qualitativa",
    unidade: "%",
    definicao: {
      tipo_calculo: "taxa",
      corte: "ontem",
      numerador: k("data_agendado_para", [particular, compareceu]),
      denominador: k("data_agendado_para", [particular, { campo: "situacao", op: "nao_em", valor: ["remarcada"] }]),
    },
  },
];

describe("métricas por papel", () => {
  it("acha a métrica mesmo com o código renomeado", () => {
    expect(metricaPorPapel(METRICAS, "agendamentos")?.id).toBe("1");
    expect(metricaPorPapel(METRICAS, "agendamentos_sus")?.id).toBe("2");
    expect(metricaPorPapel(METRICAS, "realizadas")?.id).toBe("3");
    expect(metricaPorPapel(METRICAS, "conversao")?.id).toBe("4");
    expect(metricaPorPapel(METRICAS, "marcadas_para")).toBeNull();
  });

  it("separa agendamentos (total) de agendamentos válidos (sem remarques), qualquer que seja a ordem", () => {
    const fora = { campo: "situacao", op: "nao_em" as const, valor: ["remarcada", "falta_remarcada", "bloqueio_clinica", "erro"] };
    const validos: Metrica = {
      id: "5",
      codigo: "validos_x",
      nome: "Válidos",
      tipo: "quantitativa",
      unidade: "un",
      definicao: { tipo_calculo: "simples", ...k("data_agendado_em", [particular, fora]) },
    };
    for (const lista of [[validos, ...METRICAS], [...METRICAS, validos]]) {
      expect(metricaPorPapel(lista, "agendamentos")?.id).toBe("1");
      expect(metricaPorPapel(lista, "agendamentos_validos")?.id).toBe("5");
    }
    expect(metricaPorPapel(METRICAS, "agendamentos_validos")).toBeNull();
    expect(resolverMetrica([validos, ...METRICAS], "agendamentos_validos")?.id).toBe("5");
  });

  it("resolve por id, por código e por código antigo (painéis de TV antigos)", () => {
    expect(resolverMetrica(METRICAS, "3")?.codigo).toBe("realizadasparticular");
    expect(resolverMetrica(METRICAS, "agendamentos_sus")?.id).toBe("2");
    expect(resolverMetrica(METRICAS, "realizadas")?.id).toBe("3");
    expect(resolverMetrica(METRICAS, "nao-existe")).toBeNull();
  });

  it("explica a taxa de conversão em palavras simples", () => {
    const t = explicarMetrica(METRICAS[3].definicao);
    expect(t).toContain("marcadas para os dias deste mês");
    expect(t).toContain("até ontem");
    expect(t).toContain("sem remarcada");
    expect(t).toContain("em quantas o paciente compareceu");
  });
});
