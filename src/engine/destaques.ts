// Outras formas de ganhar (além do volume) e os destaques de um mês fechado.
// Tudo em agendamentos VÁLIDOS. Só reconhece: quem não cresceu não aparece (nunca ranking "negativo").
import { fimCompetencia, inicioCompetencia } from "./datas";
import { passaFiltros } from "./metricas";
import { contarProducao, type Producao, type RegrasProducao } from "./producao";
import type { Linha } from "./tipos";

/** Com menos que isso no período anterior, "cresceu X%" engana (de 1 para 3 = +200%). */
export const MIN_BASE_CRESCIMENTO = 5;
/** Taxa de comparecimento só com consultas suficientes em dias que já passaram. */
export const MIN_CONSULTAS_TAXA = 10;

export function crescimento(atual: number, anterior: number): number | null {
  if (anterior < MIN_BASE_CRESCIMENTO) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

export function taxaComparecimento(p: Producao | undefined): number | null {
  if (!p || p.encerradasMarcadas < MIN_CONSULTAS_TAXA) return null;
  return Math.round((p.encerradasCompareceram / p.encerradasMarcadas) * 1000) / 10;
}

export interface Melhorou {
  id: string;
  pct: number;
  atual: number;
  anterior: number;
}

/** Quem cresceu (válidos) contra o mesmo ponto do período anterior, do maior para o menor. Só quem cresceu. */
export function rankingMelhorou(atual: Map<string, Producao>, anterior: Map<string, Producao>, ids: string[]): Melhorou[] {
  return ids
    .map((id) => {
      const a = atual.get(id)?.agendouValidos ?? 0;
      const b = anterior.get(id)?.agendouValidos ?? 0;
      return { id, atual: a, anterior: b, pct: crescimento(a, b) };
    })
    .filter((x): x is Melhorou => x.pct !== null && x.pct > 0)
    .sort((x, y) => y.pct - x.pct || y.atual - x.atual);
}

export interface Comparecimento {
  id: string;
  taxa: number;
  vieram: number;
  marcadas: number;
}

export function rankingComparecimento(atual: Map<string, Producao>, ids: string[]): Comparecimento[] {
  return ids
    .map((id) => {
      const p = atual.get(id);
      return { id, taxa: taxaComparecimento(p), vieram: p?.encerradasCompareceram ?? 0, marcadas: p?.encerradasMarcadas ?? 0 };
    })
    .filter((x): x is Comparecimento => x.taxa !== null)
    .sort((x, y) => y.taxa - x.taxa || y.marcadas - x.marcadas);
}

export interface PessoaNoMes {
  id: string;
  validos: number;
  total: number;
  validosAnt: number;
  crescimento: number | null;
  taxa: number | null;
  taxaAnt: number | null;
  melhorDia: { dia: string; valor: number } | null;
}

export interface DestaquesMes {
  comp: string;
  equipe: {
    validos: number;
    total: number;
    validosAnt: number;
    crescimento: number | null;
    taxa: number | null;
    taxaAnt: number | null;
    melhorDia: { dia: string; valor: number } | null;
  };
  pessoas: PessoaNoMes[];
  vencedores: { volume: string | null; melhorou: string | null; comparecimento: string | null };
}

const somar = (m: Map<string, Producao>, ids: string[], k: "agendouValidos" | "agendou" | "encerradasMarcadas" | "encerradasCompareceram") =>
  ids.reduce((s, id) => s + (m.get(id)?.[k] ?? 0), 0);

/** Fechamento de um mês (comp) comparado com o mês anterior (compAnt). */
export function destaquesDoMes(linhas: Linha[], regras: RegrasProducao, ids: string[], comp: string, compAnt: string, hoje: string): DestaquesMes {
  const janela = { inicio: inicioCompetencia(comp), fim: fimCompetencia(comp) };
  const atual = contarProducao(linhas, regras, janela, hoje);
  const ant = contarProducao(linhas, regras, { inicio: inicioCompetencia(compAnt), fim: fimCompetencia(compAnt) }, hoje);

  // melhor dia de cada pessoa e da equipe (válidos, pelo dia em que marcou)
  const porDia = new Map<string, Map<string, number>>();
  const fora = new Set(regras.fora);
  for (const l of linhas) {
    const em = typeof l.data_agendado_em === "string" ? l.data_agendado_em.slice(0, 10) : null;
    if (!em || em < janela.inicio || em > janela.fim || !l.colaborador_id || !ids.includes(l.colaborador_id)) continue;
    const situacao = typeof l.situacao === "string" ? l.situacao : null;
    if (situacao && fora.has(situacao)) continue;
    if (!passaFiltros(l, regras.base)) continue;
    const m = porDia.get(l.colaborador_id) ?? new Map<string, number>();
    m.set(em, (m.get(em) ?? 0) + 1);
    porDia.set(l.colaborador_id, m);
  }
  const melhor = (m: Map<string, number> | undefined) => {
    let r: { dia: string; valor: number } | null = null;
    for (const [dia, valor] of m ?? []) if (!r || valor > r.valor || (valor === r.valor && dia > r.dia)) r = { dia, valor };
    return r;
  };
  const equipeDia = new Map<string, number>();
  for (const m of porDia.values()) for (const [d, v] of m) equipeDia.set(d, (equipeDia.get(d) ?? 0) + v);

  const pessoas: PessoaNoMes[] = ids.map((id) => {
    const p = atual.get(id);
    const a = ant.get(id);
    return {
      id,
      validos: p?.agendouValidos ?? 0,
      total: p?.agendou ?? 0,
      validosAnt: a?.agendouValidos ?? 0,
      crescimento: crescimento(p?.agendouValidos ?? 0, a?.agendouValidos ?? 0),
      taxa: taxaComparecimento(p),
      taxaAnt: taxaComparecimento(a),
      melhorDia: melhor(porDia.get(id)),
    };
  });

  const volume = [...pessoas].sort((x, y) => y.validos - x.validos)[0];
  const encEq = somar(atual, ids, "encerradasMarcadas");
  const encEqAnt = somar(ant, ids, "encerradasMarcadas");
  const validos = somar(atual, ids, "agendouValidos");
  const validosAnt = somar(ant, ids, "agendouValidos");
  return {
    comp,
    equipe: {
      validos,
      total: somar(atual, ids, "agendou"),
      validosAnt,
      crescimento: crescimento(validos, validosAnt),
      taxa: encEq >= MIN_CONSULTAS_TAXA ? Math.round((somar(atual, ids, "encerradasCompareceram") / encEq) * 1000) / 10 : null,
      taxaAnt: encEqAnt >= MIN_CONSULTAS_TAXA ? Math.round((somar(ant, ids, "encerradasCompareceram") / encEqAnt) * 1000) / 10 : null,
      melhorDia: melhor(equipeDia),
    },
    pessoas,
    vencedores: {
      volume: volume && volume.validos > 0 ? volume.id : null,
      melhorou: rankingMelhorou(atual, ant, ids)[0]?.id ?? null,
      comparecimento: rankingComparecimento(atual, ids)[0]?.id ?? null,
    },
  };
}
