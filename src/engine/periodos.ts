// Períodos usados no Painel e na TV, sempre com as datas escritas por extenso
// para ninguém ter dúvida "de quando é esse número".
import { competenciaAnterior, competenciaDe, diaDaSemanaISO, fimCompetencia, inicioCompetencia, somarDias } from "./datas";

export type PeriodoRapido = "hoje" | "semana" | "mes" | "mes_passado";
export const PERIODOS_RAPIDOS: PeriodoRapido[] = ["hoje", "semana", "mes", "mes_passado"];

export interface JanelaPeriodo {
  periodo: PeriodoRapido | "personalizado";
  inicio: string;
  fim: string;
  /** "Hoje", "Esta semana", "Novembro até agora", "Outubro (mês passado)" */
  nome: string;
  /** "sex, 13/11", "09/11 a 13/11", "01/11 a 13/11" */
  datas: string;
  /** o período ainda está acontecendo (os números vão mudar) */
  emAndamento: boolean;
  /** até quando contar as consultas marcadas PARA o período (mês corrente: o mês inteiro) */
  fimPara: string;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function nomeMes(comp: string): string {
  const m = Number(comp.slice(5, 7));
  return MESES[m - 1] ?? comp;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "13/11" */
export function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "13/11/2026" quando o ano for outro que o de referência. */
function diaMesAno(iso: string, anoRef: string): string {
  return iso.slice(0, 4) === anoRef ? diaMes(iso) : `${diaMes(iso)}/${iso.slice(0, 4)}`;
}

export function textoDatas(inicio: string, fim: string, anoRef = fim.slice(0, 4)): string {
  if (inicio === fim) return `${SEMANA[diaDaSemanaISO(inicio) - 1]}, ${diaMesAno(inicio, anoRef)}`;
  return `${diaMesAno(inicio, anoRef)} a ${diaMesAno(fim, anoRef)}`;
}

export function janelaRapida(periodo: PeriodoRapido, hoje: string): JanelaPeriodo {
  const comp = competenciaDe(hoje);
  switch (periodo) {
    case "hoje":
      return { periodo, inicio: hoje, fim: hoje, fimPara: hoje, nome: "Hoje", datas: textoDatas(hoje, hoje), emAndamento: true };
    case "semana": {
      const inicio = somarDias(hoje, 1 - diaDaSemanaISO(hoje)); // segunda-feira
      return { periodo, inicio, fim: hoje, fimPara: somarDias(inicio, 6), nome: "Esta semana", datas: textoDatas(inicio, hoje), emAndamento: true };
    }
    case "mes": {
      const inicio = inicioCompetencia(comp);
      return {
        periodo,
        inicio,
        fim: hoje,
        fimPara: fimCompetencia(comp),
        nome: `${maiuscula(nomeMes(comp))} até agora`,
        datas: textoDatas(inicio, hoje),
        emAndamento: true,
      };
    }
    case "mes_passado": {
      const ant = competenciaAnterior(comp);
      const inicio = inicioCompetencia(ant);
      const fim = fimCompetencia(ant);
      return { periodo, inicio, fim, fimPara: fim, nome: `${maiuscula(nomeMes(ant))} (mês passado)`, datas: textoDatas(inicio, fim), emAndamento: false };
    }
  }
}

/** Mês fechado (ou o atual até hoje) de uma competência AAAA-MM. */
export function janelaDoMes(comp: string, hoje: string): JanelaPeriodo {
  const atual = competenciaDe(hoje);
  if (comp === atual) return janelaRapida("mes", hoje);
  if (comp === competenciaAnterior(atual)) return janelaRapida("mes_passado", hoje);
  const inicio = inicioCompetencia(comp);
  const fim = fimCompetencia(comp);
  return {
    periodo: "personalizado",
    inicio,
    fim,
    fimPara: fim,
    nome: `${maiuscula(nomeMes(comp))} de ${comp.slice(0, 4)}`,
    datas: textoDatas(inicio, fim, hoje.slice(0, 4)),
    emAndamento: false,
  };
}

export function janelaPersonalizada(inicio: string, fim: string, hoje: string): JanelaPeriodo {
  const f = fim > hoje ? hoje : fim;
  return {
    periodo: "personalizado",
    inicio,
    fim: f,
    fimPara: fim,
    nome: "Período escolhido",
    datas: textoDatas(inicio, f, hoje.slice(0, 4)),
    emAndamento: f >= hoje,
  };
}

/** Meses (AAAA-MM) que a janela toca: para buscar as linhas mês a mês. */
export function mesesDaJanela(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let c = competenciaDe(fim); c >= competenciaDe(inicio); c = competenciaAnterior(c)) out.unshift(c);
  return out;
}

/**
 * Período anterior "no mesmo ponto", para comparar de forma justa:
 * hoje → mesmo dia da semana passada; semana → semana passada até o mesmo dia;
 * mês corrente → mês anterior até o mesmo dia; mês fechado → mês anterior inteiro.
 */
export function janelaAnterior(j: JanelaPeriodo, hoje: string): { inicio: string; fim: string; nome: string } {
  if (j.periodo === "hoje") {
    const d = somarDias(j.inicio, -7);
    return { inicio: d, fim: d, nome: `${SEMANA[diaDaSemanaISO(d) - 1]} passada (${diaMes(d)})` };
  }
  if (j.periodo === "semana") {
    return { inicio: somarDias(j.inicio, -7), fim: somarDias(j.fim, -7), nome: "semana passada até o mesmo dia" };
  }
  const ehMesInteiro = j.inicio.slice(8) === "01" && (j.fim === fimCompetencia(j.inicio) || j.periodo === "mes");
  if (ehMesInteiro) {
    const ant = competenciaAnterior(competenciaDe(j.inicio));
    const inicio = inicioCompetencia(ant);
    const fimAnt = fimCompetencia(ant);
    if (j.emAndamento && j.fim < fimCompetencia(j.inicio)) {
      const mesmoDia = `${ant}-${j.fim.slice(8)}`;
      const fim = mesmoDia > fimAnt ? fimAnt : mesmoDia;
      return { inicio, fim, nome: `${nomeMes(ant)} até o dia ${fim.slice(8)}` };
    }
    return { inicio, fim: fimAnt, nome: nomeMes(ant) };
  }
  // período escolhido: o mesmo número de dias logo antes
  const dias = Math.round((Date.parse(j.fim) - Date.parse(j.inicio)) / 86_400_000) + 1;
  const fim = somarDias(j.inicio, -1);
  const inicio = somarDias(fim, -(dias - 1));
  return { inicio, fim, nome: `${textoDatas(inicio, fim, hoje.slice(0, 4))}` };
}
