// Atalhos de período em MESES (Análise e Relatórios trabalham mês a mês).
// Mesmos nomes da Gestão, para a pessoa aprender uma vez só. Puro: serve ao servidor e ao navegador.
import { competenciaAnterior, nomeCompetencia } from "./datas";

export type AtalhoMeses = "mes" | "mes_passado" | "6m" | "3m" | "ano" | "12m" | "personalizado";

export const ATALHOS_MESES: { k: AtalhoMeses; t: string }[] = [
  { k: "mes", t: "Este mês" },
  { k: "mes_passado", t: "Mês passado" },
  { k: "6m", t: "Últimos 6 meses (até este)" },
  { k: "3m", t: "Últimos 3 meses fechados" },
  { k: "ano", t: "Este ano" },
  { k: "12m", t: "Últimos 12 meses fechados" },
  { k: "personalizado", t: "Escolher meses…" },
];

/** De/até (AAAA-MM) de um atalho, contado a partir do mês atual. */
export function mesesDoAtalho(a: Exclude<AtalhoMeses, "personalizado">, atual: string): { de: string; ate: string } {
  const passado = competenciaAnterior(atual);
  switch (a) {
    case "mes":
      return { de: atual, ate: atual };
    case "mes_passado":
      return { de: passado, ate: passado };
    case "6m":
      return { de: competenciaAnterior(atual, 5), ate: atual };
    case "3m":
      return { de: competenciaAnterior(atual, 3), ate: passado };
    case "ano":
      return { de: `${atual.slice(0, 4)}-01`, ate: atual };
    case "12m":
      return { de: competenciaAnterior(atual, 12), ate: passado };
  }
}

/** Qual atalho corresponde a este de/até (ou "personalizado"). */
export function atalhoDosMeses(de: string, ate: string, atual: string): AtalhoMeses {
  for (const { k } of ATALHOS_MESES) {
    if (k === "personalizado") continue;
    const m = mesesDoAtalho(k, atual);
    if (m.de === de && m.ate === ate) return k;
  }
  return "personalizado";
}

/** "junho a novembro de 2026", "novembro de 2026", "dezembro de 2025 a março de 2026". */
export function textoMeses(de: string, ate: string): string {
  if (de === ate) return nomeCompetencia(de);
  const [a, b] = [nomeCompetencia(de), nomeCompetencia(ate)];
  return de.slice(0, 4) === ate.slice(0, 4) ? `${a.replace(/ de \d{4}$/, "")} a ${b}` : `${a} a ${b}`;
}
