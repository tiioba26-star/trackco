import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { carinhaPara, type Carinha } from "@/engine/apuracao";
import { competenciaAnterior, competenciaDe, datasEntre, diaDaSemanaISO, fimCompetencia, hojeNoFuso, inicioCompetencia } from "@/engine/datas";
import { janelaRapida, type JanelaPeriodo } from "@/engine/periodos";
import { type ConfigTv, normalizarConfig } from "@/lib/tv-config";
import type { Categoria } from "@/engine/producao";
import type { Metrica } from "@/engine/tipos";
import { membrosDaEquipe } from "@/lib/calculo/carregar";
import { codigosTv } from "@/lib/codigo-tv";
import { linhasDasPessoas, producaoDe, realizadasDaClinica, realizadasNoPeriodo, regrasDaCategoria } from "@/lib/dados/producao";
import { metricaPorPapel } from "@/lib/metricas-papel";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Modo TV: link público sem login. NUNCA devolve nome, foto, iniciais, login, R$, comissão ou pontos.
// Cada pessoa aparece só pelo código de 4 dígitos (ela vê o próprio código no Painel).

export { BLOCOS_TV, CONFIG_TV_PADRAO, normalizarConfig } from "@/lib/tv-config";
export type { BlocoTv, ConfigTv, ModoTv } from "@/lib/tv-config";

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ItemBarra {
  /** código de 4 dígitos da pessoa (estável, para animar as barras) */
  id: string;
  valor: number;
  atingimento: number | null;
  carinha: Carinha;
}

export interface PeriodoTela {
  nome: string;
  datas: string;
  emAndamento: boolean;
}

export interface TelaTv {
  tipo: "barras" | "pessoa" | "equipe";
  titulo: string;
  /** de quando são os números desta tela */
  periodo?: PeriodoTela;
  /** a tela fica o dobro do tempo (ranking principal) */
  destaque?: boolean;
  unidade?: string;
  itens?: ItemBarra[];
  /** soma da equipe no canto (ranking) */
  total?: number;
  pessoa?: {
    codigo: string;
    posicao: number;
    carinha: Carinha;
    periodos: { nome: string; datas: string; marcadas: number; realizadas: number }[];
  };
  equipe?: {
    pessoas: number;
    agendamentosParticular: number;
    agendamentosSus: number;
    realizadasParticular: { equipe: number; clinica: number | null };
    realizadasSus: { equipe: number; clinica: number | null };
  };
}

export interface PayloadTv {
  nome: string;
  equipes: string[];
  competencia: string;
  atualizado_em: string | null;
  config: ConfigTv;
  telas: TelaTv[];
}

const periodoTela = (j: JanelaPeriodo): PeriodoTela => ({ nome: j.nome, datas: j.datas, emAndamento: j.emAndamento });

/** Dias de trabalho no intervalo (sem feriados: é só para a meta proporcional da TV). */
function diasDeTrabalho(inicio: string, fim: string, dias: number[]): number {
  return datasEntre(inicio, fim).filter((d) => dias.includes(diaDaSemanaISO(d))).length;
}

export async function dadosTv(token: string): Promise<PayloadTv | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const db = criarClienteAdmin();
  const { data: painel } = await db
    .from("paineis_tv")
    .select("id, nome, equipes, config, ativo, ultimo_acesso")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!painel || !painel.ativo) return null;

  // registra o acesso no máximo a cada 10 min
  if (!painel.ultimo_acesso || Date.now() - new Date(painel.ultimo_acesso).getTime() > 10 * 60_000) {
    await db.from("paineis_tv").update({ ultimo_acesso: new Date().toISOString() }).eq("id", painel.id);
  }
  return payloadDoPainel(painel as PainelRow);
}

interface PainelRow {
  id: string;
  nome: string;
  equipes: string[];
  config: unknown;
}

/** Monta as telas de um painel (separado do token para poder testar com dados reais). */
export async function payloadDoPainel(painel: PainelRow, hoje = hojeNoFuso()): Promise<PayloadTv> {
  const db = criarClienteAdmin();
  const config = normalizarConfig(painel.config as Partial<ConfigTv>);
  const comp = competenciaDe(hoje);
  const compAnt = competenciaAnterior(comp);

  const [{ data: equipes }, { data: metricasRows }, { data: sync }, codigos] = await Promise.all([
    db.from("equipes").select("id, nome, dias_trabalho").in("id", painel.equipes as string[]).eq("ativo", true),
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo").eq("ativo", true),
    db.from("sync_execucoes").select("finalizado_em").eq("status", "ok").order("iniciado_em", { ascending: false }).limit(1).maybeSingle(),
    codigosTv(),
  ]);
  const metricas = (metricasRows ?? []) as Metrica[];
  const equipeIds = (equipes ?? []).map((e) => e.id);
  const diasTrabalho = ((equipes ?? [])[0]?.dias_trabalho as number[] | undefined) ?? [1, 2, 3, 4, 5];

  // membros (sem o líder) de todas as equipes do painel
  const membros = (await Promise.all(equipeIds.map((id) => membrosDaEquipe(db, id, comp)))).flat().filter((m) => m.funcao === "membro");
  const unicos = Array.from(new Map(membros.map((m) => [m.colaborador_id, m])).values());
  const ids = unicos.map((m) => m.colaborador_id);
  const codigoDe = (id: string) => codigos.get(id) ?? "0000";

  const janelas = config.periodos!.map((p) => janelaRapida(p, hoje));
  const inicioDados = janelas.reduce((m, j) => (j.inicio < m ? j.inicio : m), inicioCompetencia(comp));
  const agend = metricaPorPapel(metricas, "agendamentos");
  const regras = { particular: regrasDaCategoria(metricas, "particular"), sus: regrasDaCategoria(metricas, "sus") };

  const [linhas, { data: metas }, { data: aps }] = await Promise.all([
    linhasDasPessoas(
      db,
      unicos.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo })),
      inicioDados,
      hoje,
    ),
    ids.length && agend
      ? db.from("metas").select("colaborador_id, competencia, valor").eq("metrica_id", agend.id).in("competencia", [inicioCompetencia(comp), inicioCompetencia(compAnt)]).in("colaborador_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db.from("apuracoes").select("colaborador_id, nota").eq("tipo", "parcial").eq("competencia", inicioCompetencia(comp)).in("colaborador_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const notaDe = new Map((aps ?? []).map((a) => [a.colaborador_id as string, a.nota === null ? null : Number(a.nota)]));
  const metaDe = (id: string, c: string) =>
    Number((metas ?? []).find((m) => m.colaborador_id === id && String(m.competencia).startsWith(c))?.valor ?? 0) || null;
  const uteisMes = diasDeTrabalho(inicioCompetencia(comp), fimCompetencia(comp), diasTrabalho);

  /** % da meta de agendamentos no período (meta do mês proporcional aos dias de trabalho do período). */
  const atingimento = (id: string, valor: number, j: JanelaPeriodo): number | null => {
    if (j.periodo === "mes_passado") {
      const meta = metaDe(id, compAnt);
      return meta ? Math.round((valor / meta) * 1000) / 10 : null;
    }
    const meta = metaDe(id, comp);
    if (!meta) return j.periodo === "mes" ? (notaDe.get(id) ?? null) : null;
    const fracao = j.periodo === "mes" ? 1 : diasDeTrabalho(j.inicio, j.fim, diasTrabalho) / Math.max(1, uteisMes);
    const metaPeriodo = meta * fracao;
    return metaPeriodo > 0 ? Math.round((valor / metaPeriodo) * 1000) / 10 : null;
  };
  const carinhaMes = (id: string) => carinhaPara(notaDe.get(id) ?? null, config.limites);

  // produção de cada período (até agora), por categoria
  const prod = (cat: Categoria, j: JanelaPeriodo) => {
    const r = regras[cat];
    return r ? producaoDe(linhas, r, ids, { inicio: j.inicio, fim: j.fim }, hoje) : null;
  };

  const telas: TelaTv[] = [];
  const blocos = config.modos.map((m) => m.bloco);

  // total de consultas realizadas na clínica inteira, por período (só se o bloco "equipe" estiver ligado)
  const clinica = blocos.includes("equipe")
    ? await Promise.all(
        janelas.map(async (j) => ({
          particular: regras.particular ? await realizadasDaClinica(db, regras.particular, j.inicio, j.fim) : null,
          sus: regras.sus ? await realizadasDaClinica(db, regras.sus, j.inicio, j.fim) : null,
        })),
      )
    : [];

  for (const bloco of blocos) {
    if (bloco === "ranking_particular" || bloco === "ranking_sus") {
      const cat: Categoria = bloco === "ranking_sus" ? "sus" : "particular";
      for (const j of janelas) {
        const p = prod(cat, j);
        if (!p) continue;
        const itens: ItemBarra[] = ids
          .map((id) => {
            const valor = p.porPessoa.get(id)?.agendou ?? 0;
            const ating = cat === "particular" ? atingimento(id, valor, j) : null;
            return {
              id: codigoDe(id),
              valor,
              atingimento: ating,
              carinha: ating !== null ? carinhaPara(ating, config.limites) : carinhaMes(id),
            };
          })
          .sort((a, b) => b.valor - a.valor || a.id.localeCompare(b.id));
        telas.push({
          tipo: "barras",
          titulo: cat === "sus" ? "SUS · Agendamentos" : "Agendamentos Particular",
          periodo: periodoTela(j),
          destaque: cat === "particular" && j.periodo === "mes",
          unidade: "un",
          itens,
          total: p.total.agendou,
        });
      }
    } else if (bloco === "pessoas") {
      // ordem: ranking de agendamentos Particular do mês, do 1º ao último
      const mes = janelaRapida("mes", hoje);
      const pm = prod("particular", mes);
      if (!pm) continue;
      const ordem = [...ids].sort((a, b) => (pm.porPessoa.get(b)?.agendou ?? 0) - (pm.porPessoa.get(a)?.agendou ?? 0) || codigoDe(a).localeCompare(codigoDe(b)));
      const porPeriodo = janelas.map((j) => ({ j, p: prod("particular", j) }));
      ordem.forEach((id, i) => {
        const ating = atingimento(id, pm.porPessoa.get(id)?.agendou ?? 0, mes);
        telas.push({
          tipo: "pessoa",
          titulo: "Consultas marcadas × realizadas",
          pessoa: {
            codigo: codigoDe(id),
            posicao: i + 1,
            carinha: ating !== null ? carinhaPara(ating, config.limites) : carinhaMes(id),
            periodos: porPeriodo.map(({ j, p }) => ({
              nome: j.nome,
              datas: j.datas,
              marcadas: p?.porPessoa.get(id)?.marcadasPara ?? 0,
              realizadas: p?.porPessoa.get(id)?.compareceram ?? 0,
            })),
          },
        });
      });
    } else if (bloco === "equipe") {
      janelas.forEach((j, k) => {
        const pp = prod("particular", j);
        const ps = prod("sus", j);
        const clinPart = clinica[k]?.particular ?? null;
        const clinSus = clinica[k]?.sus ?? null;
        telas.push({
          tipo: "equipe",
          titulo: "Visão Geral da Equipe",
          periodo: periodoTela(j),
          equipe: {
            pessoas: ids.length,
            agendamentosParticular: pp?.total.agendou ?? 0,
            agendamentosSus: ps?.total.agendou ?? 0,
            realizadasParticular: {
              equipe: regras.particular ? realizadasNoPeriodo(linhas, regras.particular, ids, j.inicio, j.fim) : 0,
              clinica: clinPart,
            },
            realizadasSus: {
              equipe: regras.sus ? realizadasNoPeriodo(linhas, regras.sus, ids, j.inicio, j.fim) : 0,
              clinica: clinSus,
            },
          },
        });
      });
    }
  }

  return {
    nome: painel.nome,
    equipes: (equipes ?? []).map((e) => e.nome),
    competencia: comp,
    atualizado_em: sync?.finalizado_em ?? null,
    config,
    telas,
  };
}
