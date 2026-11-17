import "server-only";
import { competenciaAnterior, datasEntre, fimCompetencia, inicioCompetencia, nomeCompetencia } from "@/engine/datas";
import { calcularMetrica } from "@/engine/metricas";
import type { DefinicaoMetrica, Linha, Metrica } from "@/engine/tipos";
import { linhasKlingoCacheado as linhasKlingo } from "@/lib/dados/painel";
import { metricaPorPapel } from "@/lib/metricas-papel";
import type { Db } from "@/lib/supabase/tipos";

export type Granularidade = "dia" | "mes";

export interface PontoAnalise {
  chave: string; // AAAA-MM-DD ou AAAA-MM
  rotulo: string;
  /** um valor por métrica, na ordem escolhida */
  valores: (number | null)[];
  /** atalhos para as duas primeiras (gráfico de A × B) */
  a: number | null;
  b: number | null;
  futuro: boolean;
}

export interface ResultadoAnalise {
  pontos: PontoAnalise[];
  /** total de cada métrica no período */
  totais: number[];
  totalA: number;
  totalB: number;
}

/** Até quantas métricas a análise livre compara. */
export const MAX_METRICAS = 10;

/** Só métricas do Klingo entram na análise livre (lançamentos manuais ficam no extrato/relatórios). */
export function usaSoKlingo(d: DefinicaoMetrica): boolean {
  return d.tipo_calculo === "taxa"
    ? d.numerador.fonte === "klingo_agendamentos" && d.denominador.fonte === "klingo_agendamentos"
    : d.fonte === "klingo_agendamentos";
}

/** "Marcadas para o período": a métrica cadastrada ou, se ainda não existir, a base da taxa de comparecimento. */
export function metricaMarcadasPara(metricas: Metrica[]): Metrica | null {
  const cadastrada = metricaPorPapel(metricas, "marcadas_para");
  if (cadastrada) return cadastrada;
  const conv = metricaPorPapel(metricas, "conversao");
  if (!conv || conv.definicao.tipo_calculo !== "taxa") return null;
  return {
    id: "marcadas_para",
    codigo: "marcadas_para",
    nome: "Consultas marcadas para o período (Particular)",
    tipo: "quantitativa",
    unidade: "un",
    definicao: { tipo_calculo: "simples", corte: "hoje", ...conv.definicao.denominador },
  };
}

function atribuir(brutas: Record<string, unknown>[], porLogin: Map<string, string>): Linha[] {
  return brutas.map((l) => ({
    ...l,
    chave: l.chave as string,
    colaborador_id: porLogin.get(String(l.responsavel_login ?? "").toLowerCase()) ?? null,
  }));
}

/**
 * Série comparando métricas no tempo (uma ou mais; as perguntas prontas usam A e B).
 * - dia: um ponto por dia do mês "de"; dias futuros mostram o que já está marcado para eles.
 * - mes: um ponto por mês entre "de" e "ate" (no máx. 36).
 * - acumulado: soma desde o início do período (para taxas, a taxa acumulada).
 */
export async function serieAnalise(
  db: Db,
  op: {
    metricas: Metrica[];
    colaboradores: { id: string; login_klingo: string | null }[];
    granularidade: Granularidade;
    de: string;
    ate: string;
    acumulado: boolean;
    hoje: string;
  },
): Promise<ResultadoAnalise> {
  const comLogin = op.colaboradores.filter((c) => c.login_klingo);
  const porLogin = new Map(comLogin.map((c) => [c.login_klingo!.toLowerCase(), c.id]));
  const logins = Array.from(porLogin.keys());
  const ids = op.colaboradores.map((c) => c.id);
  // taxa sem nenhuma consulta na base (ex.: fim de semana) não é 0%: fica sem valor
  const valor = (m: Metrica | null, linhas: Linha[], ini: string, fim: string, hoje: string) => {
    if (!m) return null;
    const r = calcularMetrica(m.definicao, () => linhas, { inicio: ini, fim }, hoje, ids);
    return r.denominador === 0 ? null : r.valor;
  };

  const mets = op.metricas.slice(0, MAX_METRICAS);
  const ponto = (chave: string, rotulo: string, valores: (number | null)[], futuro: boolean): PontoAnalise => ({
    chave,
    rotulo,
    valores,
    a: valores[0] ?? null,
    b: mets.length > 1 ? (valores[1] ?? null) : null,
    futuro,
  });
  const resultado = (pontos: PontoAnalise[], totais: number[]): ResultadoAnalise => ({
    pontos,
    totais,
    totalA: totais[0] ?? 0,
    totalB: totais[1] ?? 0,
  });

  if (op.granularidade === "dia") {
    const ini = inicioCompetencia(op.de);
    const fim = fimCompetencia(op.de);
    const linhas = atribuir(await linhasKlingo(db, logins, op.de), porLogin);
    const pontos = datasEntre(ini, fim).map((dia) => {
      const futuro = dia > op.hoje;
      // dia futuro: conta o que já está marcado para ele (o "hoje" do cálculo passa a ser o próprio dia)
      const hojeCalc = futuro ? dia : op.hoje;
      const de = op.acumulado ? ini : dia;
      return ponto(dia, dia.slice(8, 10), mets.map((m) => valor(m, linhas, de, dia, hojeCalc)), futuro);
    });
    return resultado(pontos, mets.map((m) => valor(m, linhas, ini, fim, fim) ?? 0));
  }

  const meses: string[] = [];
  for (let c = op.ate; c >= op.de && meses.length < 36; c = competenciaAnterior(c)) meses.unshift(c);
  const linhasPorMes = await Promise.all(meses.map((m) => linhasKlingo(db, logins, m)));
  const somas = mets.map(() => 0);
  const pontos = meses.map((mes, i) => {
    const linhas = atribuir(linhasPorMes[i], porLogin);
    const valores = mets.map((m, k) => {
      const v = valor(m, linhas, inicioCompetencia(mes), fimCompetencia(mes), op.hoje);
      somas[k] += v ?? 0;
      return op.acumulado && m.unidade !== "%" ? somas[k] : v;
    });
    return ponto(mes, nomeCompetencia(mes, true), valores, mes > op.hoje.slice(0, 7));
  });
  return resultado(pontos, somas);
}
