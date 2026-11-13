// Séries para os gráficos da TV: dia a dia, semana a semana, dia da semana e calendário do mês.
// Agendamentos sempre em VÁLIDOS (pelo dia em que foram marcados).
import { competenciaDe, datasEntre, diaDaSemanaISO, fimCompetencia, inicioCompetencia, somarDias } from "./datas";
import { passaFiltros } from "./metricas";
import type { RegrasProducao } from "./producao";
import type { Linha } from "./tipos";

const dia = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);
const situacao = (l: Linha) => (typeof l.situacao === "string" ? l.situacao : null);

/** Agendamentos válidos por dia (data em que foi marcado), entre de e ate. */
export function validosPorDia(linhas: Linha[], regras: RegrasProducao, de: string, ate: string): Map<string, number> {
  const fora = new Set(regras.fora);
  const out = new Map<string, number>();
  for (const l of linhas) {
    const em = dia(l.data_agendado_em);
    if (!em || em < de || em > ate || !passaFiltros(l, regras.base)) continue;
    const s = situacao(l);
    if (s && fora.has(s)) continue;
    out.set(em, (out.get(em) ?? 0) + 1);
  }
  return out;
}

/** Segundas-feiras das últimas n semanas (a última é a semana de hoje). */
export function semanasAte(hoje: string, n: number): string[] {
  const seg = somarDias(hoje, 1 - diaDaSemanaISO(hoje));
  return Array.from({ length: n }, (_, i) => somarDias(seg, -7 * (n - 1 - i)));
}

export function somaPorSemana(porDia: Map<string, number>, semanas: string[]): number[] {
  return semanas.map((s) => datasEntre(s, somarDias(s, 6)).reduce((t, d) => t + (porDia.get(d) ?? 0), 0));
}

/** Comparecimento por semana da consulta (só dias que já passaram). */
export function comparecimentoPorSemana(
  linhas: Linha[],
  regras: RegrasProducao,
  semanas: string[],
  hoje: string,
): { marcadas: number; vieram: number; taxa: number | null }[] {
  const fora = new Set(regras.fora);
  const idx = new Map<string, number>();
  semanas.forEach((s, i) => datasEntre(s, somarDias(s, 6)).forEach((d) => idx.set(d, i)));
  const out = semanas.map(() => ({ marcadas: 0, vieram: 0, taxa: null as number | null }));
  for (const l of linhas) {
    const para = dia(l.data_agendado_para);
    if (!para || para >= hoje || !idx.has(para) || !passaFiltros(l, regras.base)) continue;
    const s = situacao(l);
    if (s && fora.has(s)) continue;
    const t = out[idx.get(para)!];
    t.marcadas++;
    if (l.atendido === true) t.vieram++;
  }
  for (const t of out) t.taxa = t.marcadas >= 10 ? Math.round((t.vieram / t.marcadas) * 1000) / 10 : null;
  return out;
}

export const NOMES_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Média de agendamentos válidos por dia da semana (dias sem nada contam como 0, domingo só se tiver movimento). */
export function mediaPorDiaDaSemana(porDia: Map<string, number>, de: string, ate: string): { dow: number; rotulo: string; media: number; total: number }[] {
  const tot = Array(8).fill(0);
  const qtd = Array(8).fill(0);
  for (const d of datasEntre(de, ate)) {
    const w = diaDaSemanaISO(d);
    tot[w] += porDia.get(d) ?? 0;
    qtd[w]++;
  }
  return [1, 2, 3, 4, 5, 6, 7]
    .filter((w) => w < 7 || tot[7] > 0)
    .map((w) => ({ dow: w, rotulo: NOMES_DIA[w - 1], total: tot[w], media: qtd[w] ? Math.round((tot[w] / qtd[w]) * 10) / 10 : 0 }));
}

export interface DiaCalendario {
  data: string;
  dia: number;
  /** linha do calendário (0 = primeira semana do mês) */
  semana: number;
  dow: number;
  valor: number | null;
  hoje: boolean;
}

/** Calendário do mês (semanas × dias da semana) com o valor de cada dia; dias futuros sem valor. */
export function calendarioDoMes(comp: string, porDia: Map<string, number>, hoje: string): DiaCalendario[] {
  const ini = inicioCompetencia(comp);
  const desloc = diaDaSemanaISO(ini) - 1;
  return datasEntre(ini, fimCompetencia(comp)).map((d, i) => ({
    data: d,
    dia: Number(d.slice(8)),
    semana: Math.floor((i + desloc) / 7),
    dow: diaDaSemanaISO(d),
    valor: d > hoje ? null : (porDia.get(d) ?? 0),
    hoje: d === hoje,
  }));
}

/** Total por mês (AAAA-MM) a partir da contagem por dia. */
export function somaPorMes(porDia: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [d, v] of porDia) out.set(competenciaDe(d), (out.get(competenciaDe(d)) ?? 0) + v);
  return out;
}
