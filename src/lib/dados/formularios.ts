import "server-only";
import type { Sessao } from "@/lib/auth";
import { type Formulario, noPublico, type Pergunta, type Publico, type Respostas, rodadaAtual } from "@/lib/formularios";
import type { Db } from "@/lib/supabase/tipos";

const COLUNAS = "id, titulo, descricao, perguntas, modelo, recorrencia, dia_mes, a_cada_meses, data_unica, inicio, publico, anonimo, ativo";

export function lerFormulario(r: Record<string, unknown>): Formulario {
  const pub = (r.publico ?? {}) as Partial<Publico>;
  return {
    id: String(r.id),
    titulo: String(r.titulo ?? ""),
    descricao: (r.descricao as string | null) ?? null,
    perguntas: Array.isArray(r.perguntas) ? (r.perguntas as Pergunta[]) : [],
    modelo: r.modelo === "sus" ? "sus" : null,
    recorrencia: r.recorrencia === "unica" ? "unica" : "mensal",
    dia_mes: r.dia_mes === null || r.dia_mes === undefined ? null : Number(r.dia_mes),
    a_cada_meses: Number(r.a_cada_meses ?? 1) || 1,
    data_unica: (r.data_unica as string | null) ?? null,
    inicio: String(r.inicio ?? "").slice(0, 10),
    publico: { equipes: Array.isArray(pub.equipes) ? pub.equipes : [], funcoes: Array.isArray(pub.funcoes) && pub.funcoes.length ? pub.funcoes : ["membro", "lider"] },
    anonimo: r.anonimo !== false,
    ativo: r.ativo === true,
  };
}

/**
 * Primeiro formulário ativo que a pessoa ainda não respondeu na rodada aberta.
 * Qualquer erro (ex.: tabelas ainda não criadas) = nada pendente: o site nunca trava por falha aqui.
 */
export async function formularioPendente(db: Db, s: Sessao, hoje: string): Promise<{ formulario: Formulario; rodada: string } | null> {
  try {
    const { data, error } = await db.from("formularios").select(COLUNAS).eq("ativo", true).order("criado_em");
    if (error || !data?.length) return null;
    const abertos = data
      .map(lerFormulario)
      .filter((f) => f.perguntas.length && noPublico(f.publico, s.equipes))
      .map((f) => ({ formulario: f, rodada: rodadaAtual(f, hoje) }))
      .filter((x): x is { formulario: Formulario; rodada: string } => x.rodada !== null);
    if (!abertos.length) return null;
    const { data: envios, error: e2 } = await db
      .from("formulario_envios")
      .select("formulario_id, rodada")
      .eq("colaborador_id", s.colaborador.id)
      .in(
        "formulario_id",
        abertos.map((a) => a.formulario.id),
      );
    if (e2) return null;
    const feitos = new Set((envios ?? []).map((e) => `${e.formulario_id}|${e.rodada}`));
    return abertos.find((a) => !feitos.has(`${a.formulario.id}|${a.rodada}`)) ?? null;
  } catch {
    return null;
  }
}

export async function listarFormularios(db: Db): Promise<{ formularios: Formulario[]; erro: string | null }> {
  const { data, error } = await db.from("formularios").select(COLUNAS).order("criado_em");
  if (error) return { formularios: [], erro: error.message };
  return { formularios: (data ?? []).map(lerFormulario), erro: null };
}

export async function obterFormulario(db: Db, id: string): Promise<Formulario | null> {
  const { data } = await db.from("formularios").select(COLUNAS).eq("id", id).maybeSingle();
  return data ? lerFormulario(data) : null;
}

/** Quantas pessoas do público já responderam cada formulário na rodada aberta. */
export async function contagemRodadas(db: Db, pares: { id: string; rodada: string }[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!pares.length) return out;
  const { data } = await db
    .from("formulario_envios")
    .select("formulario_id, rodada")
    .in(
      "formulario_id",
      pares.map((p) => p.id),
    );
  for (const p of pares) out.set(p.id, (data ?? []).filter((e) => e.formulario_id === p.id && e.rodada === p.rodada).length);
  return out;
}

export interface Resultados {
  rodadas: string[];
  rodada: string | null;
  respostas: { respostas: Respostas; colaborador: string | null; dia: string }[];
  /** quem já respondeu e quem falta na rodada (pelo envio, nunca pela resposta) */
  responderam: string[];
  faltam: string[];
}

export async function resultadosFormulario(db: Db, f: Formulario, rodadaPedida: string | null, hoje: string): Promise<Resultados> {
  const [{ data: env }, { data: membros }, { data: colabs }] = await Promise.all([
    db.from("formulario_envios").select("rodada, colaborador_id").eq("formulario_id", f.id),
    db.from("equipe_membros").select("colaborador_id, equipe_id, funcao, fim"),
    db.from("colaboradores").select("id, nome, ativo"),
  ]);
  const nome = new Map((colabs ?? []).map((c) => [String(c.id), String(c.nome)]));
  const rodadas = Array.from(new Set((env ?? []).map((e) => String(e.rodada)))).sort().reverse();
  const rodada = rodadaPedida && rodadas.includes(rodadaPedida) ? rodadaPedida : (rodadas[0] ?? null);

  const ativos = new Set((colabs ?? []).filter((c) => c.ativo).map((c) => String(c.id)));
  const publico = new Set(
    (membros ?? [])
      .filter((m) => (!m.fim || String(m.fim) >= hoje) && ativos.has(String(m.colaborador_id)))
      .filter((m) => noPublico(f.publico, [{ equipe_id: String(m.equipe_id), funcao: m.funcao as "lider" | "membro" }]))
      .map((m) => String(m.colaborador_id)),
  );
  const resp = new Set((env ?? []).filter((e) => e.rodada === rodada).map((e) => String(e.colaborador_id)));
  const ordenar = (ids: Iterable<string>) => Array.from(ids, (id) => nome.get(id) ?? "—").sort((a, b) => a.localeCompare(b));

  let respostas: Resultados["respostas"] = [];
  if (rodada) {
    const { data } = await db.from("formulario_respostas").select("respostas, colaborador_id, respondido_dia").eq("formulario_id", f.id).eq("rodada", rodada);
    respostas = (data ?? []).map((r) => ({
      respostas: (r.respostas ?? {}) as Respostas,
      colaborador: r.colaborador_id ? (nome.get(String(r.colaborador_id)) ?? null) : null,
      dia: String(r.respondido_dia),
    }));
  }
  return {
    rodadas,
    rodada,
    respostas,
    responderam: ordenar(resp),
    faltam: ordenar([...publico].filter((id) => !resp.has(id))),
  };
}

/** Nota SUS média de cada rodada (para o gráfico de evolução). */
export async function evolucaoSus(db: Db, f: Formulario, calcular: (r: Respostas) => number | null): Promise<{ rodada: string; nota: number; n: number }[]> {
  if (f.modelo !== "sus") return [];
  const { data } = await db.from("formulario_respostas").select("rodada, respostas").eq("formulario_id", f.id);
  const por = new Map<string, number[]>();
  for (const r of data ?? []) {
    const n = calcular((r.respostas ?? {}) as Respostas);
    if (n === null) continue;
    por.set(String(r.rodada), [...(por.get(String(r.rodada)) ?? []), n]);
  }
  return Array.from(por.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rodada, notas]) => ({ rodada, n: notas.length, nota: Math.round((notas.reduce((s, x) => s + x, 0) / notas.length) * 10) / 10 }));
}
