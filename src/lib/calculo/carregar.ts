import "server-only";
import type { Db } from "@/lib/supabase/tipos";
import { fimCompetencia, hojeNoFuso, inicioCompetencia } from "@/engine/datas";
import type {
  Ajuste,
  Ausencia,
  DefinicaoPlano,
  EntradaApuracao,
  Linha,
  MembroEquipe,
  MetaRegistro,
  Metrica,
} from "@/engine/tipos";

type Cliente = Db;

/** Busca todas as páginas de uma consulta (o PostgREST limita a 1000 linhas por resposta). */
export async function buscarTodos<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanho = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < tamanho) break;
  }
  return out;
}

export interface EquipeRow {
  id: string;
  nome: string;
  dias_trabalho: number[];
  visibilidade_ranking: string;
  etapas_aprovacao: string[];
  prazo_contestacao_dias: number;
}

export interface PlanoVigente {
  plano_id: string;
  nome: string;
  modalidade: string;
  versao_id: string;
  versao_numero: number;
  definicao: DefinicaoPlano;
}

export async function carregarMetricas(db: Cliente): Promise<Record<string, Metrica>> {
  const { data, error } = await db.from("metricas").select("id, codigo, nome, descricao, tipo, unidade, definicao, ativo");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((m) => [m.id, m as Metrica]));
}

export async function planoVigente(db: Cliente, equipeId: string, competencia: string): Promise<PlanoVigente | null> {
  const { data: plano } = await db
    .from("planos")
    .select("id, nome, modalidade")
    .eq("equipe_id", equipeId)
    .eq("status", "ativo")
    .maybeSingle();
  if (!plano) return null;
  const { data: versao } = await db
    .from("plano_versoes")
    .select("id, numero, definicao")
    .eq("plano_id", plano.id)
    .lte("vigente_desde", inicioCompetencia(competencia))
    .order("vigente_desde", { ascending: false })
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!versao) return null;
  return {
    plano_id: plano.id,
    nome: plano.nome,
    modalidade: plano.modalidade,
    versao_id: versao.id,
    versao_numero: versao.numero,
    definicao: versao.definicao as DefinicaoPlano,
  };
}

interface MembroRow {
  colaborador_id: string;
  funcao: "lider" | "membro";
  inicio: string;
  fim: string | null;
  colaboradores: { nome: string; login_klingo: string | null; ativo: boolean } | null;
}

export async function membrosDaEquipe(
  db: Cliente,
  equipeId: string,
  competencia: string,
): Promise<(MembroEquipe & { login_klingo: string | null })[]> {
  const ini = inicioCompetencia(competencia);
  const fim = fimCompetencia(competencia);
  const { data, error } = await db
    .from("equipe_membros")
    .select("colaborador_id, funcao, inicio, fim, colaboradores(nome, login_klingo, ativo)")
    .eq("equipe_id", equipeId)
    .lte("inicio", fim)
    .or(`fim.is.null,fim.gte.${ini}`);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MembroRow[])
    .filter((m) => m.colaboradores)
    .map((m) => ({
      colaborador_id: m.colaborador_id,
      nome: m.colaboradores!.nome,
      funcao: m.funcao,
      inicio: m.inicio,
      fim: m.fim,
      login_klingo: m.colaboradores!.login_klingo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const COLUNAS_KLINGO =
  "chave, data_agendado_em, data_agendado_para, data_realizacao, responsavel_login, procedimento, profissional, operadora, qtd, atendido, situacao, motivo";

/** Linhas do Klingo dos logins informados que tocam a competência por qualquer uma das três datas. */
export async function linhasKlingo(db: Cliente, logins: string[], competencia: string): Promise<Record<string, unknown>[]> {
  if (!logins.length) return [];
  const ini = inicioCompetencia(competencia);
  const fim = fimCompetencia(competencia);
  const filtroDatas = [
    `and(data_agendado_em.gte.${ini},data_agendado_em.lte.${fim})`,
    `and(data_agendado_para.gte.${ini},data_agendado_para.lte.${fim})`,
    `and(data_realizacao.gte.${ini},data_realizacao.lte.${fim})`,
  ].join(",");
  return buscarTodos((de, ate) =>
    db
      .from("klingo_agendamentos")
      .select(COLUNAS_KLINGO)
      .in("responsavel_login", logins.map((l) => l.toLowerCase()))
      .or(filtroDatas)
      .order("chave")
      .range(de, ate),
  );
}

export interface OpcoesEntrada {
  competencia: string;
  hoje?: string;
  /** substitui a definição do plano vigente (simulador) */
  definicao?: DefinicaoPlano;
  /** substitui/acrescenta métricas (teste de métrica em edição) */
  metricasExtras?: Record<string, Metrica>;
}

export interface EntradaMontada {
  entrada: EntradaApuracao;
  plano: PlanoVigente | null;
  equipe: EquipeRow;
}

export async function montarEntrada(db: Cliente, equipe: EquipeRow, op: OpcoesEntrada): Promise<EntradaMontada | null> {
  const { competencia } = op;
  const ini = inicioCompetencia(competencia);
  const fim = fimCompetencia(competencia);
  const plano = await planoVigente(db, equipe.id, competencia);
  const definicao = op.definicao ?? plano?.definicao;
  if (!definicao) return null;

  const [metricasBase, membros] = await Promise.all([carregarMetricas(db), membrosDaEquipe(db, equipe.id, competencia)]);
  const metricas = { ...metricasBase, ...(op.metricasExtras ?? {}) };
  const ids = membros.map((m) => m.colaborador_id);
  const porLogin = new Map(
    membros.filter((m) => m.login_klingo).map((m) => [m.login_klingo!.toLowerCase(), m.colaborador_id]),
  );

  const usaFonte = (f: string) =>
    definicao.indicadores.some((i) => {
      const d = metricas[i.metrica_id]?.definicao;
      if (!d) return false;
      return d.tipo_calculo === "taxa" ? d.numerador.fonte === f || d.denominador.fonte === f : d.fonte === f;
    });

  const [metas, ausencias, feriados, ajustes, klingo, lancamentos] = await Promise.all([
    db
      .from("metas")
      .select("metrica_id, colaborador_id, equipe_id, valor")
      .eq("competencia", ini)
      .then((r) => (r.data ?? []) as MetaRegistro[]),
    ids.length
      ? db
          .from("ausencias")
          .select("colaborador_id, inicio, fim, tipo")
          .in("colaborador_id", ids)
          .lte("inicio", fim)
          .gte("fim", ini)
          .then((r) => (r.data ?? []) as Ausencia[])
      : Promise.resolve([] as Ausencia[]),
    db
      .from("feriados")
      .select("data")
      .gte("data", ini)
      .lte("data", fim)
      .then((r) => (r.data ?? []).map((f) => f.data as string)),
    ids.length
      ? db
          .from("ajustes")
          .select("id, colaborador_id, metrica_id, delta, justificativa")
          .eq("competencia", ini)
          .in("colaborador_id", ids)
          .then((r) => ((r.data ?? []) as Ajuste[]).map((a) => ({ ...a, delta: Number(a.delta) })))
      : Promise.resolve([] as Ajuste[]),
    usaFonte("klingo_agendamentos") ? linhasKlingo(db, Array.from(porLogin.keys()), competencia) : Promise.resolve([]),
    usaFonte("lancamentos") && ids.length
      ? db
          .from("lancamentos")
          .select("id, colaborador_id, data, tipo, valor, descricao")
          .in("colaborador_id", ids)
          .gte("data", ini)
          .lte("data", fim)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const linhasKlingoAtrib: Linha[] = klingo.map((l) => ({
    ...l,
    chave: l.chave as string,
    qtd: Number(l.qtd ?? 1),
    colaborador_id: porLogin.get(String(l.responsavel_login ?? "").toLowerCase()) ?? null,
  }));
  const linhasLanc: Linha[] = (lancamentos as Record<string, unknown>[]).map((l) => ({
    ...l,
    chave: l.id as string,
    valor: Number(l.valor ?? 0),
    colaborador_id: l.colaborador_id as string,
  }));

  const entrada: EntradaApuracao = {
    competencia,
    hoje: op.hoje ?? hojeNoFuso(),
    equipe: { id: equipe.id, nome: equipe.nome, dias_trabalho: equipe.dias_trabalho },
    membros: membros.map(({ login_klingo: _l, ...m }) => m),
    plano: { versao_id: op.definicao ? null : (plano?.versao_id ?? null), definicao },
    metricas,
    metas: metas.map((m) => ({ ...m, valor: Number(m.valor) })),
    ausencias,
    feriados,
    ajustes,
    linhas: { klingo_agendamentos: linhasKlingoAtrib, lancamentos: linhasLanc },
  };
  return { entrada, plano, equipe };
}

export async function equipesAtivas(db: Cliente, ids?: string[]): Promise<EquipeRow[]> {
  let q = db
    .from("equipes")
    .select("id, nome, dias_trabalho, visibilidade_ranking, etapas_aprovacao, prazo_contestacao_dias")
    .eq("ativo", true)
    .order("nome");
  if (ids?.length) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as EquipeRow[];
}
