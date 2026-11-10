import "server-only";
import { competenciaAnterior, fimCompetencia, inicioCompetencia } from "@/engine/datas";
import type { ResultadoApuracao } from "@/engine/tipos";
import { buscarTodos } from "@/lib/calculo/carregar";
import type { Db } from "@/lib/supabase/tipos";

export interface FiltrosRelatorio {
  de: string;
  ate: string;
  equipeId?: string;
  colaboradorId?: string;
}

export interface LinhaRelatorio {
  competencia: string;
  colaborador_id: string;
  nome: string;
  funcao: string;
  equipe_id: string;
  nota: number | null;
  nivel: string | null;
  oficial: boolean;
  resultado: Omit<ResultadoApuracao, "itens">;
}

export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let c = ate; c >= de && out.length < 36; c = competenciaAnterior(c)) out.unshift(c);
  return out;
}

/** Uma linha por pessoa/mês: usa o resultado final do fechamento quando existir, senão o parcial. */
export async function linhasRelatorio(db: Db, f: FiltrosRelatorio): Promise<LinhaRelatorio[]> {
  // o query builder do supabase-js é mutável: cada página monta uma consulta nova
  const montar = () => {
    let q = db
      .from("apuracoes")
      .select("tipo, competencia, colaborador_id, funcao, equipe_id, nota, nivel, resultado")
      .gte("competencia", inicioCompetencia(f.de))
      .lte("competencia", inicioCompetencia(f.ate));
    if (f.equipeId) q = q.eq("equipe_id", f.equipeId);
    if (f.colaboradorId) q = q.eq("colaborador_id", f.colaboradorId);
    return q;
  };
  const rows = await buscarTodos<{
    tipo: string;
    competencia: string;
    colaborador_id: string;
    funcao: string;
    equipe_id: string;
    nota: number | null;
    nivel: string | null;
    resultado: Omit<ResultadoApuracao, "itens">;
  }>((de, ate) => montar().order("competencia").order("colaborador_id").order("tipo").range(de, ate));
  const mapa = new Map<string, LinhaRelatorio>();
  for (const r of rows) {
    const k = `${r.competencia}|${r.equipe_id}|${r.colaborador_id}`;
    const atual = mapa.get(k);
    if (atual?.oficial) continue;
    mapa.set(k, {
      competencia: String(r.competencia).slice(0, 7),
      colaborador_id: r.colaborador_id,
      nome: r.resultado.nome,
      funcao: r.funcao,
      equipe_id: r.equipe_id,
      nota: r.nota === null ? null : Number(r.nota),
      nivel: r.nivel,
      oficial: r.tipo === "final",
      resultado: r.resultado,
    });
  }
  return Array.from(mapa.values()).sort(
    (a, b) => a.competencia.localeCompare(b.competencia) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export interface Quebra {
  rotulo: string;
  agendados: number;
  realizados: number;
}

/** Agendamentos (pela data do agendamento) e realizados, quebrados por um campo. */
export async function quebraKlingo(
  db: Db,
  f: FiltrosRelatorio & { logins?: string[] },
  campo: "operadora" | "procedimento" | "profissional",
): Promise<Quebra[]> {
  if (f.logins && !f.logins.length) return [];
  const montar = () => {
    let q = db
      .from("klingo_agendamentos")
      .select(`chave, ${campo}, atendido`)
      .gte("data_agendado_em", inicioCompetencia(f.de))
      .lte("data_agendado_em", fimCompetencia(f.ate));
    if (f.logins) q = q.in("responsavel_login", f.logins);
    return q;
  };
  const linhas = await buscarTodos<Record<string, unknown>>((de, ate) => montar().order("chave").range(de, ate));
  const m = new Map<string, Quebra>();
  for (const l of linhas) {
    const k = String(l[campo] ?? "—") || "—";
    const cur = m.get(k) ?? { rotulo: k, agendados: 0, realizados: 0 };
    cur.agendados++;
    if (l.atendido === true) cur.realizados++;
    m.set(k, cur);
  }
  return Array.from(m.values()).sort((a, b) => b.agendados - a.agendados);
}
