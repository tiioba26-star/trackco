import "server-only";
import type { Db } from "@/lib/supabase/tipos";
import { datasEntre, fimCompetencia, inicioCompetencia, menorData } from "@/engine/datas";
import { calcularMetrica } from "@/engine/metricas";
import type { Linha, Metrica, ResultadoApuracao } from "@/engine/tipos";
import { linhasKlingo } from "@/lib/calculo/carregar";

export interface ApuracaoRow {
  id: string;
  colaborador_id: string;
  equipe_id: string;
  funcao: "lider" | "membro";
  nota: number | null;
  nivel: string | null;
  calculado_em: string;
  plano_versao_id: string | null;
  resultado: Omit<ResultadoApuracao, "itens">;
  colaboradores?: { nome: string } | null;
}

export async function ultimaSync(db: Db) {
  const { data } = await db
    .from("sync_execucoes")
    .select("iniciado_em, finalizado_em, status, mensagem")
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { iniciado_em: string; finalizado_em: string | null; status: string; mensagem: string | null } | null;
}

export async function apuracoesDaEquipe(db: Db, equipeId: string, competencia: string): Promise<ApuracaoRow[]> {
  const { data } = await db
    .from("apuracoes")
    .select("id, colaborador_id, equipe_id, funcao, nota, nivel, calculado_em, plano_versao_id, resultado, colaboradores(nome)")
    .eq("tipo", "parcial")
    .eq("equipe_id", equipeId)
    .eq("competencia", inicioCompetencia(competencia));
  return ((data ?? []) as unknown as ApuracaoRow[]).sort(
    (a, b) => (b.nota ?? -1) - (a.nota ?? -1) || a.resultado.nome.localeCompare(b.resultado.nome, "pt-BR"),
  );
}

export async function minhasApuracoes(db: Db, colaboradorId: string, competencia: string): Promise<ApuracaoRow[]> {
  const { data } = await db
    .from("apuracoes")
    .select("id, colaborador_id, equipe_id, funcao, nota, nivel, calculado_em, plano_versao_id, resultado")
    .eq("tipo", "parcial")
    .eq("colaborador_id", colaboradorId)
    .eq("competencia", inicioCompetencia(competencia));
  return (data ?? []) as unknown as ApuracaoRow[];
}

export interface PosicaoRanking {
  posicao: number;
  colaborador_id: string | null;
  nome: string | null;
  eu: boolean;
  nota: number | null;
  nivel: string | null;
}

export async function rankingEquipe(db: Db, equipeId: string, competencia: string): Promise<PosicaoRanking[]> {
  const { data } = await db.rpc("ranking_equipe", { p_equipe: equipeId, p_competencia: inicioCompetencia(competencia) });
  return ((data ?? []) as PosicaoRanking[]).map((r) => ({ ...r, nota: r.nota === null ? null : Number(r.nota) }));
}

export interface PontoSerie {
  dia: string;
  [serie: string]: number | string | null;
}

/**
 * Série acumulada dia a dia de cada métrica (até hoje), para o gráfico de evolução.
 * Inclui a linha de "ritmo da meta" (meta distribuída linearmente pelos dias do mês).
 */
export async function serieDiaria(
  db: Db,
  opcoes: {
    competencia: string;
    hoje: string;
    metricas: Metrica[];
    colaboradores: { id: string; login_klingo: string | null }[];
    metas?: Record<string, number | null>;
  },
): Promise<PontoSerie[]> {
  const { competencia, hoje, metricas, colaboradores } = opcoes;
  const ini = inicioCompetencia(competencia);
  const fim = fimCompetencia(competencia);
  if (hoje < ini) return [];
  const limite = menorData(fim, hoje);
  const logins = colaboradores.filter((c) => c.login_klingo).map((c) => c.login_klingo!.toLowerCase());
  const porLogin = new Map(colaboradores.filter((c) => c.login_klingo).map((c) => [c.login_klingo!.toLowerCase(), c.id]));
  const brutas = await linhasKlingo(db, logins, competencia);
  const linhas: Linha[] = brutas.map((l) => ({
    ...l,
    chave: l.chave as string,
    colaborador_id: porLogin.get(String(l.responsavel_login ?? "").toLowerCase()) ?? null,
  }));
  const ids = colaboradores.map((c) => c.id);
  const dias = datasEntre(ini, fim);
  const totalDias = dias.length;

  return dias.map((dia, i) => {
    const ponto: PontoSerie = { dia: dia.slice(8, 10) };
    for (const m of metricas) {
      if (m.unidade === "%") continue;
      ponto[m.codigo] =
        dia <= limite ? calcularMetrica(m.definicao, () => linhas, { inicio: ini, fim: dia }, dia, ids).valor : null;
      const meta = opcoes.metas?.[m.codigo];
      if (meta) ponto[`meta_${m.codigo}`] = Math.round((meta * (i + 1) * 10) / totalDias) / 10;
    }
    return ponto;
  });
}

export async function alertasGestao(db: Db, competencia: string) {
  const [contest, sync, semVinculo] = await Promise.all([
    db.from("contestacoes").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_analise"]),
    ultimaSync(db),
    db.from("colaboradores").select("id", { count: "exact", head: true }).eq("ativo", true).is("login_klingo", null),
  ]);
  return {
    contestacoesAbertas: contest.count ?? 0,
    sync,
    semLoginKlingo: semVinculo.count ?? 0,
    competencia,
  };
}
