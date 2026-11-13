// Recordes pessoais: a pessoa se compara com ela mesma (não com as colegas).
// Tudo em agendamentos VÁLIDOS, para remarcar não "bater recorde".
import { competenciaDe } from "./datas";
import { passaFiltros } from "./metricas";
import type { RegrasProducao } from "./producao";
import type { Linha } from "./tipos";

export interface Recordes {
  melhorDia: { valor: number; dia: string } | null;
  melhorMes: { valor: number; comp: string } | null;
  /** melhor taxa de comparecimento num mês fechado (com pelo menos MIN_CONSULTAS) */
  melhorTaxa: { valor: number; comp: string } | null;
  /** válidos de hoje e do mês corrente, para mostrar "faltam X para o recorde" */
  hoje: number;
  mesAtual: number;
}

/** Abaixo disso a taxa do mês oscila demais para ser recorde. */
export const MIN_CONSULTAS = 20;

const dia = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);

export function calcularRecordes(linhas: Linha[], regras: RegrasProducao, pessoa: string, hoje: string, desde: string): Recordes {
  const fora = new Set(regras.fora);
  const mesHoje = competenciaDe(hoje);
  const porDia = new Map<string, number>();
  const porMes = new Map<string, number>();
  const consultas = new Map<string, { marcadas: number; vieram: number }>();

  for (const l of linhas) {
    if (l.colaborador_id !== pessoa || !passaFiltros(l, regras.base)) continue;
    const situacao = typeof l.situacao === "string" ? l.situacao : null;
    if (situacao && fora.has(situacao)) continue;

    const em = dia(l.data_agendado_em);
    if (em && em >= desde && em <= hoje) {
      porDia.set(em, (porDia.get(em) ?? 0) + 1);
      const c = competenciaDe(em);
      porMes.set(c, (porMes.get(c) ?? 0) + 1);
    }

    const para = dia(l.data_agendado_para);
    if (para && para >= desde && competenciaDe(para) < mesHoje) {
      const c = competenciaDe(para);
      const t = consultas.get(c) ?? { marcadas: 0, vieram: 0 };
      t.marcadas++;
      if (l.atendido === true) t.vieram++;
      consultas.set(c, t);
    }
  }

  // empate: fica o mais recente (igualar o recorde também é recorde)
  const maior = <K extends string>(m: Map<K, number>): [K, number] | null => {
    let melhor: [K, number] | null = null;
    for (const [k, v] of [...m.entries()].sort(([a], [b]) => a.localeCompare(b))) if (!melhor || v >= melhor[1]) melhor = [k, v];
    return melhor;
  };
  const d = maior(porDia);
  const m = maior(porMes);

  let taxa: Recordes["melhorTaxa"] = null;
  for (const [c, t] of [...consultas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (t.marcadas < MIN_CONSULTAS) continue;
    const valor = Math.round((t.vieram / t.marcadas) * 1000) / 10;
    if (!taxa || valor >= taxa.valor) taxa = { valor, comp: c };
  }

  return {
    melhorDia: d ? { dia: d[0], valor: d[1] } : null,
    melhorMes: m ? { comp: m[0], valor: m[1] } : null,
    melhorTaxa: taxa,
    hoje: porDia.get(hoje) ?? 0,
    mesAtual: porMes.get(mesHoje) ?? 0,
  };
}
