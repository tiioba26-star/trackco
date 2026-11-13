import "server-only";
import { competenciaDe, datasEntre } from "@/engine/datas";
import { avaliarContagem } from "@/engine/metricas";
import { janelaAnterior, type JanelaPeriodo, mesesDaJanela } from "@/engine/periodos";
import {
  type Categoria,
  contarProducao,
  type PontoDia,
  type Producao,
  producaoPorDia,
  producaoVazia,
  type RegrasProducao,
  regrasProducao,
  somarProducao,
} from "@/engine/producao";
import type { Contagem, Filtro, Linha, Metrica } from "@/engine/tipos";
import { linhasKlingoCacheado } from "@/lib/dados/painel";
import { membrosDaEquipe } from "@/lib/calculo/carregar";
import { metricaPorPapel } from "@/lib/metricas-papel";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import type { Db } from "@/lib/supabase/tipos";

export interface Pessoa {
  id: string;
  login_klingo: string | null;
}

/** Regras de contagem de uma categoria a partir das métricas cadastradas (Particular / SUS). */
export function regrasDaCategoria(metricas: Metrica[], categoria: Categoria): RegrasProducao | null {
  const agend = metricaPorPapel(metricas, categoria === "sus" ? "agendamentos_sus" : "agendamentos");
  return regrasProducao(agend, metricaPorPapel(metricas, "conversao"));
}

/** Linhas do Klingo das pessoas, de todos os meses que a janela toca, já com o colaborador atribuído. */
export async function linhasDasPessoas(db: Db, pessoas: Pessoa[], inicio: string, fim: string): Promise<Linha[]> {
  const comLogin = pessoas.filter((p) => p.login_klingo);
  if (!comLogin.length) return [];
  const porLogin = new Map(comLogin.map((p) => [p.login_klingo!.toLowerCase(), p.id]));
  const logins = Array.from(porLogin.keys());
  const meses = await Promise.all(mesesDaJanela(inicio, fim).map((m) => linhasKlingoCacheado(db, logins, m)));
  const unicas = new Map<string, Linha>();
  for (const mes of meses)
    for (const l of mes)
      unicas.set(String(l.chave), {
        ...l,
        chave: String(l.chave),
        colaborador_id: porLogin.get(String(l.responsavel_login ?? "").toLowerCase()) ?? null,
      });
  return Array.from(unicas.values());
}

export interface ProducaoEquipe {
  porPessoa: Map<string, Producao>;
  total: Producao;
}

export function producaoDe(
  linhas: Linha[],
  regras: RegrasProducao,
  pessoas: string[],
  janela: { inicio: string; fim: string; fimPara?: string },
  hoje: string,
): ProducaoEquipe {
  const mapa = contarProducao(linhas, regras, janela, hoje, { inicio: janela.inicio, fim: janela.fimPara ?? janela.fim });
  const porPessoa = new Map(pessoas.map((id) => [id, mapa.get(id) ?? producaoVazia()]));
  return { porPessoa, total: somarProducao(Array.from(porPessoa.values())) };
}

/** Consultas realizadas (pela data em que aconteceram) das pessoas no período. */
export function realizadasNoPeriodo(linhas: Linha[], regras: RegrasProducao, pessoas: string[], inicio: string, fim: string): number {
  const c: Contagem = {
    fonte: "klingo_agendamentos",
    agregacao: "contar",
    campo_data: "data_realizacao",
    filtros: [...regras.base, { campo: "atendido", op: "verdadeiro" }],
  };
  const mapa = avaliarContagem(c, linhas, { inicio, fim });
  return pessoas.reduce((s, id) => s + (mapa.get(id)?.valor ?? 0), 0);
}

// ---- contagem na clínica inteira (todas as pessoas que marcam no Klingo) ----

type Consulta = ReturnType<ReturnType<Db["from"]>["select"]>;

/** Traduz os filtros da métrica para a consulta do banco (só o que dá para fazer com segurança). */
function aplicarFiltros(q: Consulta, filtros: Filtro[]): Consulta {
  for (const f of filtros) {
    const v = Array.isArray(f.valor) ? f.valor : f.valor != null ? String(f.valor).split(/[;,]/).map((s) => s.trim()) : [];
    switch (f.op) {
      case "igual":
        q = q.ilike(f.campo, v[0] ?? "");
        break;
      case "diferente":
        // "não é X" inclui quem está vazio (no banco, NOT ILIKE descartaria os nulos)
        q = q.or(`${f.campo}.is.null,${f.campo}.not.ilike.${JSON.stringify(v[0] ?? "")}`);
        break;
      case "contem":
        q = q.ilike(f.campo, `%${v[0] ?? ""}%`);
        break;
      case "em":
        q = q.in(f.campo, v);
        break;
      case "nao_em":
        // idem: situação vazia (consulta ainda não verificada) continua contando
        q = q.or(`${f.campo}.is.null,${f.campo}.not.in.(${v.map((x) => `"${x.replace(/"/g, "")}"`).join(",")})`);
        break;
      case "verdadeiro":
        q = q.eq(f.campo, true);
        break;
      case "falso":
        q = q.eq(f.campo, false);
        break;
      case "preenchido":
        q = q.not(f.campo, "is", null);
        break;
      case "vazio":
        q = q.is(f.campo, null);
        break;
    }
  }
  return q;
}

/** Total de consultas realizadas na clínica (qualquer atendente) no período, com os filtros da categoria. */
export async function realizadasDaClinica(db: Db, regras: RegrasProducao, inicio: string, fim: string): Promise<number | null> {
  let q = db
    .from("klingo_agendamentos")
    .select("chave", { count: "exact", head: true })
    .gte("data_realizacao", inicio)
    .lte("data_realizacao", fim) as unknown as Consulta;
  q = aplicarFiltros(q, [...regras.base, { campo: "atendido", op: "verdadeiro" }]);
  const { count, error } = (await q) as unknown as { count: number | null; error: unknown };
  return error ? null : (count ?? 0);
}

// ---- resumo de um período para o Painel ----

export interface ResumoPeriodo {
  regras: RegrasProducao;
  porPessoa: Map<string, Producao>;
  total: Producao;
  /** mesmo ponto do período anterior (para o "▲ ▼") */
  anterior: { nome: string; total: Producao };
  /** dia a dia (até 62 dias); null em períodos longos */
  dias: PontoDia[] | null;
}

/** Produção das pessoas no período, comparação com o período anterior e série diária. */
export async function resumoPeriodo(
  db: Db,
  op: { pessoas: Pessoa[]; metricas: Metrica[]; janela: JanelaPeriodo; hoje: string; categoria: Categoria },
): Promise<ResumoPeriodo | null> {
  const regras = regrasDaCategoria(op.metricas, op.categoria);
  if (!regras) return null;
  const ant = janelaAnterior(op.janela, op.hoje);
  const fimDados = op.janela.fimPara > op.janela.fim ? op.janela.fimPara : op.janela.fim;
  const linhas = await linhasDasPessoas(db, op.pessoas, ant.inicio < op.janela.inicio ? ant.inicio : op.janela.inicio, fimDados);
  const ids = op.pessoas.map((p) => p.id);
  const atual = producaoDe(linhas, regras, ids, op.janela, op.hoje);
  const anterior = producaoDe(linhas, regras, ids, { inicio: ant.inicio, fim: ant.fim }, op.hoje);
  const listaDias = datasEntre(op.janela.inicio, fimDados);
  return {
    regras,
    porPessoa: atual.porPessoa,
    total: atual.total,
    anterior: { nome: ant.nome, total: anterior.total },
    dias: listaDias.length > 1 && listaDias.length <= 62 ? producaoPorDia(linhas, regras, ids, listaDias, op.hoje) : null,
  };
}

/**
 * Posição da pessoa na própria equipe pelos agendamentos Particular do período.
 * Usa a chave de servidor só para contar; devolve apenas a posição dela (nunca os números dos colegas).
 */
export async function minhaPosicao(
  colaboradorId: string,
  equipeId: string,
  metricas: Metrica[],
  janela: JanelaPeriodo,
  hoje: string,
): Promise<{ posicao: number; de: number } | null> {
  const regras = regrasDaCategoria(metricas, "particular");
  if (!regras) return null;
  const admin = criarClienteAdmin();
  const membros = (await membrosDaEquipe(admin, equipeId, competenciaDe(janela.fim))).filter((m) => m.funcao === "membro");
  if (membros.length < 2 || !membros.some((m) => m.colaborador_id === colaboradorId)) return null;
  const linhas = await linhasDasPessoas(
    admin,
    membros.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo })),
    janela.inicio,
    janela.fim,
  );
  const ids = membros.map((m) => m.colaborador_id);
  const p = producaoDe(linhas, regras, ids, { inicio: janela.inicio, fim: janela.fim }, hoje);
  // mesmo critério do ranking da TV: agendamentos válidos (remarcar não sobe posição)
  const meu = p.porPessoa.get(colaboradorId)?.agendouValidos ?? 0;
  const naFrente = ids.filter((id) => (p.porPessoa.get(id)?.agendouValidos ?? 0) > meu).length;
  return { posicao: naFrente + 1, de: ids.length };
}
