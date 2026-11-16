// Períodos da área Gestão: os atalhos, o período escolhido e a comparação.
// Puro (sem servidor): usado pelo servidor ao ler a URL e pelo seletor no navegador para mostrar as datas na hora.
import { competenciaAnterior, competenciaDe, fimCompetencia, somarDias } from "./datas";
import { janelaAnoAnterior, janelaAnterior, janelaRapida, nomeMes, textoDatas } from "./periodos";

export type PeriodoGestao = "mes" | "mes_passado" | "3m" | "ano" | "12m" | "personalizado";
export type Comparar = "anterior" | "ano" | "nada";

export const PERIODOS_GESTAO: { k: PeriodoGestao; t: string }[] = [
  { k: "mes", t: "Este mês até hoje" },
  { k: "mes_passado", t: "Mês passado" },
  { k: "3m", t: "Últimos 3 meses fechados" },
  { k: "ano", t: "Este ano até hoje" },
  { k: "12m", t: "Últimos 12 meses fechados" },
  { k: "personalizado", t: "Escolher datas…" },
];

export interface JanelaGestao {
  inicio: string;
  fim: string;
  nome: string;
  datas: string;
  emAndamento: boolean;
  periodo: PeriodoGestao;
}

export interface BaseGestao {
  inicio: string;
  fim: string;
  nome: string;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Quantos meses inteiros a janela cobre (do dia 1 ao último dia), ou 0 se não for de meses inteiros. */
export function mesesInteiros(inicio: string, fim: string): number {
  if (inicio.slice(8) !== "01" || fim !== fimCompetencia(competenciaDe(fim)) || fim < inicio) return 0;
  const a = competenciaDe(inicio);
  const b = competenciaDe(fim);
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;
}

/** "outubro de 2026", "agosto a outubro", "novembro de 2025 a outubro de 2026" (o ano só quando precisa). */
function nomeDosMeses(inicio: string, fim: string, anoRef: string): string {
  const a = competenciaDe(inicio);
  const b = competenciaDe(fim);
  const ano = (c: string) => (c.slice(0, 4) === anoRef ? "" : ` de ${c.slice(0, 4)}`);
  if (a === b) return `${nomeMes(a)}${ano(a)}`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${nomeMes(a)} a ${nomeMes(b)}${ano(b)}`;
  return `${nomeMes(a)} de ${a.slice(0, 4)} a ${nomeMes(b)} de ${b.slice(0, 4)}`;
}

/** A janela de um atalho (ou das datas escolhidas, quando o período é "personalizado"). */
export function janelaGestao(p: PeriodoGestao, de: string | null, ate: string | null, hoje: string): JanelaGestao {
  const comp = competenciaDe(hoje);
  const anoRef = hoje.slice(0, 4);
  if (p === "mes" || p === "mes_passado") {
    const j = janelaRapida(p, hoje);
    return { inicio: j.inicio, fim: j.fim, nome: j.nome, datas: j.datas, emAndamento: j.emAndamento, periodo: p };
  }
  if (p === "3m" || p === "12m") {
    const n = p === "3m" ? 3 : 12;
    const inicio = `${competenciaAnterior(comp, n)}-01`;
    const fim = somarDias(`${comp}-01`, -1);
    return {
      inicio,
      fim,
      nome: p === "3m" ? "Últimos 3 meses fechados" : "Últimos 12 meses fechados",
      datas: textoDatas(inicio, fim, anoRef),
      emAndamento: false,
      periodo: p,
    };
  }
  if (p === "ano") {
    const inicio = `${anoRef}-01-01`;
    return { inicio, fim: hoje, nome: `${anoRef} até agora`, datas: textoDatas(inicio, hoje), emAndamento: true, periodo: p };
  }
  let inicio = de ?? `${comp}-01`;
  let fim = ate && ate < hoje ? ate : hoje;
  if (fim < inicio) [inicio, fim] = [fim, inicio];
  // no máximo 2 anos por vez
  if (Date.parse(fim) - Date.parse(inicio) > 731 * 86_400_000) inicio = somarDias(fim, -730);
  const meses = mesesInteiros(inicio, fim);
  return {
    inicio,
    fim,
    nome: meses ? maiuscula(nomeDosMeses(inicio, fim, anoRef)) : "Período escolhido",
    datas: textoDatas(inicio, fim, anoRef),
    emAndamento: fim >= hoje,
    periodo: "personalizado",
  };
}

/**
 * Com o que comparar, sempre de forma justa:
 * - ano anterior: as mesmas datas um ano antes;
 * - mês em andamento: o mês anterior até o mesmo dia;
 * - meses inteiros (mês passado, 3 ou 12 meses fechados, outubro escolhido à mão): os mesmos meses logo antes;
 * - outras datas: o mesmo número de dias logo antes.
 */
export function janelaBase(j: JanelaGestao, comparar: Comparar, hoje: string): BaseGestao | null {
  if (comparar === "nada") return null;
  if (comparar === "ano" || j.periodo === "ano") return janelaAnoAnterior(j, hoje);
  if (j.periodo === "mes") return janelaAnterior({ ...j, fimPara: j.fim, periodo: j.periodo }, hoje);
  const meses = mesesInteiros(j.inicio, j.fim);
  if (meses) {
    const inicio = `${competenciaAnterior(competenciaDe(j.inicio), meses)}-01`;
    const fim = somarDias(j.inicio, -1);
    return { inicio, fim, nome: nomeDosMeses(inicio, fim, hoje.slice(0, 4)) };
  }
  const dias = Math.round((Date.parse(j.fim) - Date.parse(j.inicio)) / 86_400_000) + 1;
  const fim = somarDias(j.inicio, -1);
  const inicio = somarDias(fim, -(dias - 1));
  return { inicio, fim, nome: `${dias} dias antes (${textoDatas(inicio, fim, hoje.slice(0, 4))})` };
}
