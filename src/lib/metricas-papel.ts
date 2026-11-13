import type { Contagem, Metrica } from "@/engine/tipos";

/**
 * Papéis fixos que algumas telas precisam encontrar (TV, painel, análise).
 * A métrica é achada primeiro pelo código "clássico" e, se ele foi renomeado,
 * pelo que ela mede (fonte + campo de data + se é só análise). Assim renomear
 * o código de uma métrica não quebra nada.
 */
export type PapelMetrica =
  | "agendamentos"
  | "agendamentos_validos"
  | "realizadas"
  | "conversao"
  | "marcadas_para"
  | "agendamentos_sus"
  | "realizadas_sus";

const ehKlingo = (c: Contagem) => c.fonte === "klingo_agendamentos";
/** Tira remarcações/bloqueios/erros pela situação: é a versão "válidos" de uma contagem. */
const filtraSituacao = (c: Contagem) => c.filtros.some((f) => f.campo === "situacao");

function combina(m: Metrica, papel: PapelMetrica): boolean {
  const d = m.definicao;
  const analise = !!d.somente_analise;
  if (papel === "conversao") return d.tipo_calculo === "taxa" && !analise && ehKlingo(d.numerador);
  if (d.tipo_calculo !== "simples" || !ehKlingo(d)) return false;
  switch (papel) {
    case "agendamentos":
      return !analise && d.campo_data === "data_agendado_em" && !filtraSituacao(d);
    case "agendamentos_validos":
      return !analise && d.campo_data === "data_agendado_em" && filtraSituacao(d);
    case "realizadas":
      return !analise && d.campo_data === "data_realizacao";
    case "marcadas_para":
      return !analise && d.campo_data === "data_agendado_para";
    case "agendamentos_sus":
      return analise && d.campo_data === "data_agendado_em";
    case "realizadas_sus":
      return analise && d.campo_data === "data_realizacao";
  }
}

export function metricaPorPapel(metricas: Metrica[], papel: PapelMetrica): Metrica | null {
  return (
    metricas.find((m) => m.codigo === papel) ??
    metricas.find((m) => m.ativo !== false && combina(m, papel)) ??
    null
  );
}

/** Acha a métrica por id, por código ou (códigos antigos/renomeados) pelo papel. */
export function resolverMetrica(metricas: Metrica[], ref: string): Metrica | null {
  return (
    metricas.find((m) => m.id === ref) ??
    metricas.find((m) => m.codigo === ref) ??
    (PAPEIS.includes(ref as PapelMetrica) ? metricaPorPapel(metricas, ref as PapelMetrica) : null)
  );
}

const PAPEIS: PapelMetrica[] = ["agendamentos", "agendamentos_validos", "realizadas", "conversao", "marcadas_para", "agendamentos_sus", "realizadas_sus"];
