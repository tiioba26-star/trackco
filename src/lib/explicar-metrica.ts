import type { Contagem, DefinicaoMetrica, Filtro } from "@/engine/tipos";
import { ROTULO_SITUACAO } from "@/lib/situacao";

// Explica uma métrica em linguagem do dia a dia (para o atendente entender o próprio extrato).

const PELA_DATA: Record<string, string> = {
  data_agendado_em: "pelo dia em que foi marcado",
  data_agendado_para: "pelo dia da consulta",
  data_realizacao: "pelo dia em que a consulta aconteceu",
  data: "pela data do lançamento",
};

function lista(v: Filtro["valor"]): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function filtroEmPalavras(f: Filtro): string | null {
  const vals = lista(f.valor);
  if (f.campo === "atendido") return f.op === "verdadeiro" ? "o paciente compareceu" : f.op === "falso" ? "o paciente não compareceu" : null;
  if (f.campo === "operadora") {
    if (f.op === "igual" || f.op === "contem" || f.op === "em") return `convênio ${vals.join(" ou ")}`;
    if (f.op === "diferente" || f.op === "nao_em") return `fora ${vals.join(", ")}`;
  }
  if (f.campo === "situacao" && (f.op === "nao_em" || f.op === "diferente"))
    return `sem ${vals.map((v) => (ROTULO_SITUACAO[v]?.t ?? v).toLowerCase()).join(", ")}`;
  if (f.campo === "situacao" && (f.op === "em" || f.op === "igual"))
    return `só ${vals.map((v) => (ROTULO_SITUACAO[v]?.t ?? v).toLowerCase()).join(", ")}`;
  if (f.campo === "tipo") return null; // lançamentos manuais: o nome da métrica já diz
  return null;
}

function condicoes(c: Contagem, ignorar: (f: Filtro) => boolean = () => false): string[] {
  return (c.filtros ?? [])
    .filter((f) => !ignorar(f))
    .map(filtroEmPalavras)
    .filter((t): t is string => !!t);
}

const ateQuando = (d: DefinicaoMetrica) => (d.corte === "ontem" ? "até ontem (dias já encerrados)" : "até hoje");

/**
 * Uma frase curta de "como é contado".
 * Taxa de conversão: "Das consultas marcadas para os dias do mês até ontem (convênio Particular; sem remarcada, …),
 * em quantas o paciente compareceu."
 */
export function explicarMetrica(d: DefinicaoMetrica): string {
  if (d.tipo_calculo === "taxa") {
    const base = condicoes(d.denominador);
    const extras = condicoes(d.numerador, (f) =>
      d.denominador.filtros.some((g) => g.campo === f.campo && g.op === f.op && JSON.stringify(g.valor) === JSON.stringify(f.valor)),
    );
    const mesmoDia = d.numerador.campo_data === d.denominador.campo_data;
    const quais =
      d.denominador.campo_data === "data_agendado_para"
        ? "Das consultas marcadas para os dias deste mês"
        : `Dos registros contados ${PELA_DATA[d.denominador.campo_data] ?? ""} neste mês`;
    return (
      `${quais}, ${ateQuando(d)}${base.length ? ` (${base.join("; ")})` : ""}: ` +
      `${extras.length ? `em quantas ${extras.join(" e ")}` : "quantas entram no número de cima"}` +
      `${mesmoDia ? "" : `, contadas ${PELA_DATA[d.numerador.campo_data] ?? ""}`}. ` +
      "Número de cima ÷ número de baixo = a taxa."
    );
  }
  const cond = condicoes(d);
  const oQue = d.fonte === "lancamentos" ? "Lançamentos manuais contados" : "Marcações do Klingo contadas";
  return `${oQue} ${PELA_DATA[d.campo_data] ?? ""}, ${ateQuando(d)}${cond.length ? `, só quando: ${cond.join("; ")}` : ""}.`;
}
