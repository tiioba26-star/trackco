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
  a: number | null;
  b: number | null;
  futuro: boolean;
}

export interface ResultadoAnalise {
  pontos: PontoAnalise[];
  totalA: number;
  totalB: number;
}

/** Só métricas do Klingo entram na análise livre (lançamentos manuais ficam no extrato/relatórios). */
export function usaSoKlingo(d: DefinicaoMetrica): boolean {
  return d.tipo_calculo === "taxa"
    ? d.numerador.fonte === "klingo_agendamentos" && d.denominador.fonte === "klingo_agendamentos"
    : d.fonte === "klingo_agendamentos";
}

/** "Marcadas para o período": a métrica cadastrada ou, se ainda não existir, a base da taxa de conversão. */
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
 * Série comparando duas métricas no tempo.
 * - dia: um ponto por dia do mês "de"; dias futuros mostram o que já está marcado para eles.
 * - mes: um ponto por mês entre "de" e "ate" (no máx. 36).
 * - acumulado: soma desde o início do período (para taxas, a taxa acumulada).
 */
export async function serieAnalise(
  db: Db,
  op: {
    a: Metrica;
    b: Metrica | null;
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
  const valor = (m: Metrica | null, linhas: Linha[], ini: string, fim: string, hoje: string) =>
    m ? calcularMetrica(m.definicao, () => linhas, { inicio: ini, fim }, hoje, ids).valor : null;

  if (op.granularidade === "dia") {
    const ini = inicioCompetencia(op.de);
    const fim = fimCompetencia(op.de);
    const linhas = atribuir(await linhasKlingo(db, logins, op.de), porLogin);
    const pontos = datasEntre(ini, fim).map((dia) => {
      const futuro = dia > op.hoje;
      // dia futuro: conta o que já está marcado para ele (o "hoje" do cálculo passa a ser o próprio dia)
      const hojeCalc = futuro ? dia : op.hoje;
      const de = op.acumulado ? ini : dia;
      return {
        chave: dia,
        rotulo: dia.slice(8, 10),
        a: valor(op.a, linhas, de, dia, hojeCalc),
        b: valor(op.b, linhas, de, dia, hojeCalc),
        futuro,
      };
    });
    return {
      pontos,
      totalA: valor(op.a, linhas, ini, fim, fim) ?? 0,
      totalB: valor(op.b, linhas, ini, fim, fim) ?? 0,
    };
  }

  const meses: string[] = [];
  for (let c = op.ate; c >= op.de && meses.length < 36; c = competenciaAnterior(c)) meses.unshift(c);
  const linhasPorMes = await Promise.all(meses.map((m) => linhasKlingo(db, logins, m)));
  let somaA = 0;
  let somaB = 0;
  const pontos = meses.map((m, i) => {
    const linhas = atribuir(linhasPorMes[i], porLogin);
    const va = valor(op.a, linhas, inicioCompetencia(m), fimCompetencia(m), op.hoje);
    const vb = valor(op.b, linhas, inicioCompetencia(m), fimCompetencia(m), op.hoje);
    somaA += va ?? 0;
    somaB += vb ?? 0;
    const taxaA = op.a.unidade === "%";
    const taxaB = op.b?.unidade === "%";
    return {
      chave: m,
      rotulo: nomeCompetencia(m, true),
      a: op.acumulado && !taxaA ? somaA : va,
      b: op.b ? (op.acumulado && !taxaB ? somaB : vb) : null,
      futuro: m > op.hoje.slice(0, 7),
    };
  });
  return { pontos, totalA: somaA, totalB: somaB };
}
