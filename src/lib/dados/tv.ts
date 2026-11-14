import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { carinhaPara, type Carinha } from "@/engine/apuracao";
import { competenciaAnterior, competenciaDe, datasEntre, diaDaSemanaISO, fimCompetencia, hojeNoFuso, inicioCompetencia, somarDias } from "@/engine/datas";
import { destaquesDoMes, rankingComparecimento, rankingMelhorou } from "@/engine/destaques";
import { diaMes, janelaAnterior, janelaRapida, type JanelaPeriodo, nomeMes } from "@/engine/periodos";
import { calcularRecordes } from "@/engine/recordes";
import { calendarioDoMes, type DiaCalendario, mediaPorDiaDaSemana, somaPorMes, somaPorSemana, validosPorDia } from "@/engine/series";
import { seriesLongas } from "@/lib/dados/series-tv";
import { type BlocoTv, type ConfigTv, normalizarConfig, segundosDoBloco } from "@/lib/tv-config";
import { type Fatia, ontem, participacaoPorEquipe, recordesAnteriores } from "@/lib/dados/participacao";
import type { Categoria, Producao, RegrasProducao } from "@/engine/producao";
import type { Metrica } from "@/engine/tipos";
import { membrosDaEquipe } from "@/lib/calculo/carregar";
import { codigosTv } from "@/lib/codigo-tv";
import { linhasDasPessoas, producaoDe, realizadasDaClinica, realizadasNoPeriodo, regrasDaCategoria } from "@/lib/dados/producao";
import { producaoPorDia } from "@/engine/producao";
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

/**
 * Nome do canal do controle remoto de um painel. Sai de um segredo do servidor: só quem abre a TV
 * (pelo link) ou o controle (logado, com acesso ao painel) recebe o nome.
 */
export function canalControle(painelId: string): string {
  const segredo = process.env.SUPABASE_SECRET_KEY ?? "trackco";
  return `tv-ctrl-${createHmac("sha256", segredo).update(`controle|${painelId}`).digest("hex").slice(0, 32)}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ItemBarra {
  /** código de 4 dígitos da pessoa (estável, para animar as barras) */
  id: string;
  /** agendamentos válidos (é o que ordena o ranking) */
  valor: number;
  /** total marcado, com remarcações, bloqueios e erros */
  bruto?: number;
  /** texto pequeno embaixo do número (substitui o "de X no total") */
  detalhe?: string;
  atingimento: number | null;
  carinha: Carinha;
}

export interface PeriodoTela {
  nome: string;
  datas: string;
  emAndamento: boolean;
}

/** Uma coluna da tela "todos os períodos lado a lado". */
export interface ColunaTv {
  periodo: PeriodoTela;
  itens: ItemBarra[];
  total?: number;
  totalBruto?: number;
  comparadoCom?: string;
  /** texto quando a coluna não tem ninguém (ex.: ninguém cresceu ainda) */
  vazio?: string;
}

export type GraficoTv =
  | {
      tipo: "mes_dia_a_dia";
      mes: string;
      mesAnterior: string;
      /** data = dia do mês atual (AAAA-MM-DD) para a letra do dia da semana no eixo */
      dias: { d: string; data: string | null; atual: number | null; anterior: number | null }[];
      calendario: DiaCalendario[];
      totalAtual: number;
      totalAnteriorMesmoPonto: number;
    }
  | { tipo: "consultas_dia_a_dia"; mes: string; dias: { d: string; data: string; marcadas: number; compareceram: number | null; futuro: boolean }[] }
  | { tipo: "semanas"; semanas: { rotulo: string; particular: number; sus: number }[] }
  | { tipo: "comparecimento_semanas"; semanas: { rotulo: string; taxa: number | null; marcadas: number }[]; media: number | null }
  | { tipo: "dia_semana"; de: string; ate: string; dias: { rotulo: string; media: number; total: number }[] }
  | { tipo: "doze_meses"; meses: { rotulo: string; validos: number; meta: number | null }[] };

export interface TelaTv {
  tipo: "barras" | "pessoa" | "equipe" | "participacao" | "destaques" | "multi" | "grafico";
  /** tela "todos os períodos lado a lado" */
  colunas?: ColunaTv[];
  grafico?: GraficoTv;
  titulo: string;
  /** bloco de origem (tempo e ordem) */
  bloco?: BlocoTv;
  /** quanto tempo esta tela fica (s) */
  segundos?: number;
  /** frases dentro das barras desta tela (no lugar das de meta) */
  mensagens?: string[];
  /** mostra "+" antes do número (crescimento) */
  mais?: boolean;
  /** com o que o período foi comparado (ex.: "outubro até o dia 13") */
  comparadoCom?: string;
  participacao?: { nome: string; datas: string; fatias: Fatia[] }[];
  destaques?: {
    mes: string;
    mesAnterior: string;
    equipe: { validos: number; total: number; crescimento: number | null; taxa: number | null; taxaAnt: number | null; melhorDia: { dia: string; valor: number } | null };
    vencedores: { titulo: string; codigo: string; valor: string; detalhe: string }[];
    metaBatida: string[];
  };
  /** de quando são os números desta tela */
  periodo?: PeriodoTela;
  /** a tela fica o dobro do tempo (ranking principal) */
  destaque?: boolean;
  unidade?: string;
  itens?: ItemBarra[];
  /** soma da equipe no canto (ranking): válidos e total marcado */
  total?: number;
  totalBruto?: number;
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
    /** total marcado (com remarcações, bloqueios e erros) */
    brutoParticular?: number;
    brutoSus?: number;
    /** válidos por dia no período da tela (hoje: últimos 14 dias), com o período de comparação tracejado */
    linha?: LinhaEquipe;
    realizadasParticular: { equipe: number; clinica: number | null };
    realizadasSus: { equipe: number; clinica: number | null };
  };
}

export interface LinhaEquipe {
  /** "dia a dia" ou "últimos 14 dias" (tela de hoje) */
  rotulo: string;
  /** período tracejado (ex.: "setembro", "outubro até o dia 14"); null = sem comparação */
  comparado: string | null;
  dias: string[];
  particular: number[];
  sus: number[];
  particularAnt: (number | null)[] | null;
  susAnt: (number | null)[] | null;
  /** a tela é de hoje: destaca o último ponto */
  hoje: boolean;
}

export interface PayloadTv {
  nome: string;
  equipes: string[];
  competencia: string;
  atualizado_em: string | null;
  config: ConfigTv;
  telas: TelaTv[];
  /** recordes pessoais batidos agora (faixa comemorativa) */
  recordes?: string[];
  /** canal do controle remoto */
  canal?: string;
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
    codigosTv(hoje),
  ]);
  const metricas = (metricasRows ?? []) as Metrica[];
  const equipeIds = (equipes ?? []).map((e) => e.id);
  const diasTrabalho = ((equipes ?? [])[0]?.dias_trabalho as number[] | undefined) ?? [1, 2, 3, 4, 5];

  // membros (sem o líder) de todas as equipes do painel
  const todosDaEquipe = (await Promise.all(equipeIds.map((id) => membrosDaEquipe(db, id, comp)))).flat();
  const membros = todosDaEquipe.filter((m) => m.funcao === "membro");
  const unicos = Array.from(new Map(membros.map((m) => [m.colaborador_id, m])).values());
  const ids = unicos.map((m) => m.colaborador_id);
  const codigoDe = (id: string) => codigos.get(id) ?? "0000";

  const janelas = config.periodos!.map((p) => janelaRapida(p, hoje));
  // dados desde o mais antigo que alguma tela precisa: períodos, comparações e o mês retrasado (destaques)
  const inicioDados = [...janelas.map((j) => j.inicio), ...janelas.map((j) => janelaAnterior(j, hoje).inicio), inicioCompetencia(competenciaAnterior(comp, 2))].reduce(
    (m, d) => (d < m ? d : m),
    inicioCompetencia(comp),
  );
  const agend = metricaPorPapel(metricas, "agendamentos");
  const validos = metricaPorPapel(metricas, "agendamentos_validos");
  const idsMeta = [agend?.id, validos?.id].filter(Boolean) as string[];
  const regras = { particular: regrasDaCategoria(metricas, "particular"), sus: regrasDaCategoria(metricas, "sus") };

  const [linhas, { data: metas }, { data: aps }, { data: apsAnt }] = await Promise.all([
    linhasDasPessoas(
      db,
      unicos.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo })),
      inicioDados,
      hoje,
    ),
    ids.length && idsMeta.length
      ? db
          .from("metas")
          .select("metrica_id, colaborador_id, competencia, valor")
          .in("metrica_id", idsMeta)
          .in("competencia", [inicioCompetencia(comp), inicioCompetencia(compAnt)])
          .in("colaborador_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db.from("apuracoes").select("colaborador_id, nota").eq("tipo", "parcial").eq("competencia", inicioCompetencia(comp)).in("colaborador_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db.from("apuracoes").select("colaborador_id, nota, tipo").eq("competencia", inicioCompetencia(compAnt)).in("colaborador_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const notaDe = new Map((aps ?? []).map((a) => [a.colaborador_id as string, a.nota === null ? null : Number(a.nota)]));
  // a meta pode estar no total ou nos válidos (o que o plano usar naquele mês); se tiver nos dois, vale a dos válidos
  const metaEmValidos = (c: string) => !!validos && (metas ?? []).some((m) => m.metrica_id === validos.id && String(m.competencia).startsWith(c));
  const metaDe = (id: string, c: string) => {
    const metrica = metaEmValidos(c) ? validos!.id : agend?.id;
    return Number((metas ?? []).find((m) => m.metrica_id === metrica && m.colaborador_id === id && String(m.competencia).startsWith(c))?.valor ?? 0) || null;
  };
  /** o número comparado com a meta: válidos ou total, conforme onde a meta foi lançada */
  const paraMeta = (p: Producao | undefined, c: string) => (metaEmValidos(c) ? (p?.agendouValidos ?? 0) : (p?.agendou ?? 0));
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
      const colunas: ColunaTv[] = [];
      for (const j of janelas) {
        const p = prod(cat, j);
        if (!p) continue;
        const compJ = j.periodo === "mes_passado" ? compAnt : comp;
        const itens: ItemBarra[] = ids
          .map((id) => {
            const pp = p.porPessoa.get(id);
            const ating = cat === "particular" ? atingimento(id, paraMeta(pp, compJ), j) : null;
            return {
              id: codigoDe(id),
              valor: pp?.agendouValidos ?? 0,
              bruto: pp?.agendou ?? 0,
              atingimento: ating,
              carinha: ating !== null ? carinhaPara(ating, config.limites) : carinhaMes(id),
            };
          })
          .sort((a, b) => b.valor - a.valor || (b.bruto ?? 0) - (a.bruto ?? 0) || a.id.localeCompare(b.id));
        if (cat === "sus") {
          colunas.push({ periodo: periodoTela(j), itens, total: p.total.agendouValidos, totalBruto: p.total.agendou });
          continue;
        }
        telas.push({
          tipo: "barras",
          bloco,
          titulo: "Agendamentos válidos · Particular",
          periodo: periodoTela(j),
          destaque: j.periodo === "mes",
          unidade: "un",
          itens,
          total: p.total.agendouValidos,
          totalBruto: p.total.agendou,
        });
      }
      if (colunas.length) telas.push({ tipo: "multi", bloco, titulo: "SUS · Agendamentos válidos", unidade: "un", colunas });
    } else if (bloco === "pessoas") {
      // ordem: ranking de agendamentos Particular do mês, do 1º ao último
      const mes = janelaRapida("mes", hoje);
      const pm = prod("particular", mes);
      if (!pm) continue;
      const v = (id: string) => pm.porPessoa.get(id)?.agendouValidos ?? 0;
      const ordem = [...ids].sort((a, b) => v(b) - v(a) || codigoDe(a).localeCompare(codigoDe(b)));
      const porPeriodo = janelas.map((j) => ({ j, p: prod("particular", j) }));
      ordem.forEach((id, i) => {
        const ating = atingimento(id, paraMeta(pm.porPessoa.get(id), comp), mes);
        telas.push({
          tipo: "pessoa",
          bloco,
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
      // a linha embaixo do card acompanha o período da tela (outubro mostra outubro) e traz o período anterior
      // tracejado; só a tela de "hoje" usa os últimos 14 dias (um dia sozinho não faz linha)
      const serie = (r: RegrasProducao | null, de: string, ate: string, datas: string[]) => {
        const m = r ? validosPorDia(linhas, r, de, ate) : new Map<string, number>();
        return datas.map((d) => m.get(d) ?? 0);
      };
      const linhaDe = (j: JanelaPeriodo): LinhaEquipe => {
        const curto = j.periodo === "hoje";
        const de = curto ? somarDias(hoje, -13) : j.inicio;
        const ate = curto ? hoje : j.fim;
        const datas = datasEntre(de, ate);
        const ant = curto ? null : janelaAnterior(j, hoje);
        const datasAnt = ant ? datasEntre(ant.inicio, ant.fim) : [];
        const alinhar = (v: number[]) => datas.map((_, k) => (k < v.length ? v[k] : null));
        return {
          rotulo: curto ? "últimos 14 dias" : "dia a dia",
          comparado: ant?.nome ?? null,
          dias: datas.map(diaMes),
          particular: serie(regras.particular, de, ate, datas),
          sus: serie(regras.sus, de, ate, datas),
          particularAnt: ant ? alinhar(serie(regras.particular, ant.inicio, ant.fim, datasAnt)) : null,
          susAnt: ant ? alinhar(serie(regras.sus, ant.inicio, ant.fim, datasAnt)) : null,
          hoje: curto,
        };
      };
      janelas.forEach((j, k) => {
        const pp = prod("particular", j);
        const ps = prod("sus", j);
        const clinPart = clinica[k]?.particular ?? null;
        const clinSus = clinica[k]?.sus ?? null;
        telas.push({
          tipo: "equipe",
          bloco,
          titulo: "Visão Geral da Equipe",
          periodo: periodoTela(j),
          equipe: {
            pessoas: ids.length,
            agendamentosParticular: pp?.total.agendouValidos ?? 0,
            agendamentosSus: ps?.total.agendouValidos ?? 0,
            brutoParticular: pp?.total.agendou ?? 0,
            brutoSus: ps?.total.agendou ?? 0,
            linha: linhaDe(j),
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

  // ---- outras formas de ganhar, comparação com outras equipes e destaques do mês passado ----
  const rp = regras.particular;
  const nomePainel = (equipes ?? []).map((e) => e.nome).join(" + ") || painel.nome;
  for (const bloco of blocos) {
    if (bloco === "melhorou" && rp) {
      const colunas: ColunaTv[] = janelas
        .filter((j) => j.periodo !== "hoje") // um dia só oscila demais para falar em "melhorou"
        .map((j) => {
          const ant = janelaAnterior(j, hoje);
          const lista = rankingMelhorou(
            producaoDe(linhas, rp, ids, { inicio: j.inicio, fim: j.fim }, hoje).porPessoa,
            producaoDe(linhas, rp, ids, { inicio: ant.inicio, fim: ant.fim }, hoje).porPessoa,
            ids,
          );
          return {
            periodo: periodoTela(j),
            comparadoCom: ant.nome,
            vazio: "Ninguém cresceu ainda neste período",
            itens: lista.map((x) => ({ id: codigoDe(x.id), valor: x.pct, detalhe: `${x.atual} agora · ${x.anterior} antes`, atingimento: null, carinha: carinhaMes(x.id) })),
          };
        });
      if (colunas.length)
        telas.push({ tipo: "multi", bloco, titulo: "Quem mais melhorou · válidos Particular", unidade: "%", mais: true, colunas });
    } else if (bloco === "comparecimento" && rp) {
      const colunas: ColunaTv[] = janelas
        .filter((j) => j.periodo !== "hoje") // o dia de hoje ainda não terminou
        .map((j) => ({
          periodo: periodoTela(j),
          vazio: "Ainda sem 10 consultas encerradas",
          itens: rankingComparecimento(producaoDe(linhas, rp, ids, { inicio: j.inicio, fim: j.fim }, hoje).porPessoa, ids).map((x) => ({
            id: codigoDe(x.id),
            valor: x.taxa,
            detalhe: `${x.vieram} de ${x.marcadas} vieram`,
            atingimento: null,
            carinha: carinhaMes(x.id),
          })),
        }));
      if (colunas.length) telas.push({ tipo: "multi", bloco, titulo: "Melhor comparecimento · Particular", unidade: "%", colunas });
    } else if (bloco === "participacao") {
      const logins = todosDaEquipe.map((m) => m.login_klingo).filter((l): l is string => !!l);
      const fatias = await participacaoPorEquipe(db, nomePainel, logins, janelas);
      telas.push({
        tipo: "participacao",
        bloco,
        titulo: `${nomePainel} × outras equipes`,
        participacao: janelas.map((j, k) => ({ nome: j.nome, datas: j.datas, fatias: fatias[k] })),
      });
    } else if (bloco === "mes_dia_a_dia" && rp) {
      const porDia = validosPorDia(linhas, rp, inicioCompetencia(compAnt), hoje);
      const dAtual = datasEntre(inicioCompetencia(comp), fimCompetencia(comp));
      const dAnt = datasEntre(inicioCompetencia(compAnt), fimCompetencia(compAnt));
      const n = Math.max(dAtual.length, dAnt.length);
      const dias = Array.from({ length: n }, (_, k) => ({
        d: String(k + 1).padStart(2, "0"),
        data: dAtual[k] ?? null,
        atual: dAtual[k] && dAtual[k] <= hoje ? (porDia.get(dAtual[k]) ?? 0) : null,
        anterior: dAnt[k] ? (porDia.get(dAnt[k]) ?? 0) : null,
      }));
      const ate = Number(hoje.slice(8));
      telas.push({
        tipo: "grafico",
        bloco,
        titulo: "Mês dia a dia · válidos Particular",
        periodo: periodoTela(janelaRapida("mes", hoje)),
        grafico: {
          tipo: "mes_dia_a_dia",
          mes: nomeMes(comp),
          mesAnterior: nomeMes(compAnt),
          dias,
          calendario: calendarioDoMes(comp, porDia, hoje),
          totalAtual: dias.slice(0, ate).reduce((t, x) => t + (x.atual ?? 0), 0),
          totalAnteriorMesmoPonto: dias.slice(0, ate).reduce((t, x) => t + (x.anterior ?? 0), 0),
        },
      });
    } else if (bloco === "consultas_dia_a_dia" && rp) {
      const dAtual = datasEntre(inicioCompetencia(comp), fimCompetencia(comp));
      telas.push({
        tipo: "grafico",
        bloco,
        titulo: "Consultas do mês dia a dia · Particular",
        periodo: periodoTela(janelaRapida("mes", hoje)),
        grafico: {
          tipo: "consultas_dia_a_dia",
          mes: nomeMes(comp),
          dias: producaoPorDia(linhas, rp, ids, dAtual, hoje).map((x) => ({
            d: x.dia.slice(8),
            data: x.dia,
            marcadas: x.marcadas,
            compareceram: x.futuro ? null : x.compareceram,
            futuro: x.futuro,
          })),
        },
      });
    } else if ((bloco === "semanas" || bloco === "comparecimento_semanas" || bloco === "dia_semana" || bloco === "doze_meses") && rp) {
      const sl = await seriesLongas(db, unicos.map((x) => ({ id: x.colaborador_id, login_klingo: x.login_klingo })), regras, hoje);
      const part = new Map(sl.particular);
      const rot = (seg: string) => diaMes(seg);
      if (bloco === "semanas") {
        const pS = somaPorSemana(part, sl.semanas);
        const sS = somaPorSemana(new Map(sl.sus), sl.semanas);
        telas.push({
          tipo: "grafico",
          bloco,
          titulo: "Últimas 26 semanas · agendamentos válidos",
          periodo: { nome: "26 semanas", datas: `${diaMes(sl.semanas[0])} a ${diaMes(hoje)}`, emAndamento: true },
          grafico: { tipo: "semanas", semanas: sl.semanas.map((s2, k) => ({ rotulo: rot(s2), particular: pS[k], sus: sS[k] })) },
        });
      } else if (bloco === "comparecimento_semanas") {
        const com = sl.comparecimento;
        const m = com.reduce((t, x) => t + x.marcadas, 0);
        const v = com.reduce((t, x) => t + x.vieram, 0);
        telas.push({
          tipo: "grafico",
          bloco,
          titulo: "Comparecimento por semana · Particular",
          periodo: { nome: "26 semanas", datas: `${diaMes(sl.semanas[0])} a ${diaMes(somarDias(hoje, -1))}`, emAndamento: true },
          grafico: {
            tipo: "comparecimento_semanas",
            semanas: sl.semanas.map((s2, k) => ({ rotulo: rot(s2), taxa: com[k]?.taxa ?? null, marcadas: com[k]?.marcadas ?? 0 })),
            media: m >= 10 ? Math.round((v / m) * 1000) / 10 : null,
          },
        });
      } else if (bloco === "dia_semana") {
        const de = sl.semanas[sl.semanas.length - 13];
        const ate = somarDias(sl.semanas[sl.semanas.length - 1], -1); // só semanas completas
        telas.push({
          tipo: "grafico",
          bloco,
          titulo: "Melhor dia da semana · válidos Particular",
          periodo: { nome: "Últimas 12 semanas", datas: `${diaMes(de)} a ${diaMes(ate)}`, emAndamento: false },
          grafico: { tipo: "dia_semana", de: diaMes(de), ate: diaMes(ate), dias: mediaPorDiaDaSemana(part, de, ate) },
        });
      } else {
        const meses = somaPorMes(part);
        const comps = Array.from({ length: 12 }, (_, k) => competenciaAnterior(comp, 11 - k));
        const { data: metasEq } = await db
          .from("metas")
          .select("competencia, valor")
          .is("colaborador_id", null)
          .in("equipe_id", equipeIds)
          .eq("metrica_id", validos?.id ?? "00000000-0000-0000-0000-000000000000");
        const metaDe = (c: string) => {
          const ms = (metasEq ?? []).filter((x) => String(x.competencia).startsWith(c));
          return ms.length ? ms.reduce((t, x) => t + Number(x.valor), 0) : null;
        };
        telas.push({
          tipo: "grafico",
          bloco,
          titulo: "12 meses × meta · válidos Particular",
          periodo: { nome: "12 meses", datas: `${nomeMes(comps[0])}/${comps[0].slice(2, 4)} a ${nomeMes(comp)}/${comp.slice(2, 4)}`, emAndamento: true },
          grafico: { tipo: "doze_meses", meses: comps.map((c) => ({ rotulo: `${nomeMes(c).slice(0, 3)}/${c.slice(2, 4)}`, validos: meses.get(c) ?? 0, meta: metaDe(c) })) },
        });
      }
    } else if (bloco === "destaques_mes" && rp) {
      const d = destaquesDoMes(linhas, rp, ids, compAnt, competenciaAnterior(compAnt), hoje);
      const nota = new Map<string, number>();
      // a apuração final (se houver) vale mais que a parcial
      for (const a of [...(apsAnt ?? [])].sort((x, y) => (x.tipo === "final" ? 1 : 0) - (y.tipo === "final" ? 1 : 0)))
        if (a.nota !== null) nota.set(a.colaborador_id as string, Number(a.nota));
      const pessoa = (id: string | null) => d.pessoas.find((x) => x.id === id);
      const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
      const vencedores: NonNullable<TelaTv["destaques"]>["vencedores"] = [];
      const v = pessoa(d.vencedores.volume);
      if (v) vencedores.push({ titulo: "Mais agendamentos válidos", codigo: codigoDe(v.id), valor: String(v.validos), detalhe: `${v.total} no total` });
      const m = pessoa(d.vencedores.melhorou);
      if (m && m.crescimento !== null)
        vencedores.push({ titulo: "Quem mais melhorou", codigo: codigoDe(m.id), valor: `+${pct(m.crescimento)}`, detalhe: `${m.validos} contra ${m.validosAnt} em ${nomeMes(competenciaAnterior(compAnt))}` });
      const c = pessoa(d.vencedores.comparecimento);
      if (c && c.taxa !== null) vencedores.push({ titulo: "Melhor comparecimento", codigo: codigoDe(c.id), valor: pct(c.taxa), detalhe: "dos pacientes vieram" });
      telas.push({
        tipo: "destaques",
        bloco,
        titulo: `Destaques de ${nomeMes(compAnt)}`,
        periodo: periodoTela(janelaRapida("mes_passado", hoje)),
        destaques: {
          mes: nomeMes(compAnt),
          mesAnterior: nomeMes(competenciaAnterior(compAnt)),
          equipe: { ...d.equipe, melhorDia: d.equipe.melhorDia && { dia: diaMes(d.equipe.melhorDia.dia), valor: d.equipe.melhorDia.valor } },
          vencedores,
          metaBatida: ids.filter((id) => (nota.get(id) ?? 0) >= 100).map(codigoDe),
        },
      });
    }
  }
  // cada tela no tempo do seu tipo (a tela por pessoa é mais curta) e na ordem dos blocos do painel
  for (const t of telas) t.segundos ??= segundosDoBloco(config, t.bloco ?? "ranking_particular");
  const ordenadas = telas
    .map((t, i) => ({ t, i }))
    .sort((a, b) => blocos.indexOf(a.t.bloco ?? "ranking_particular") - blocos.indexOf(b.t.bloco ?? "ranking_particular") || a.i - b.i)
    .map((x) => x.t);

  // recorde pessoal batido agora: vira uma faixa comemorativa em todas as telas
  const recordes: string[] = [];
  if (rp && ids.length) {
    const hist = await recordesAnteriores(db, unicos.map((x) => ({ id: x.colaborador_id, login_klingo: x.login_klingo })), rp, hoje);
    const pHoje = producaoDe(linhas, rp, ids, { inicio: hoje, fim: hoje }, hoje).porPessoa;
    const pMes = producaoDe(linhas, rp, ids, { inicio: inicioCompetencia(comp), fim: hoje }, hoje).porPessoa;
    for (const id of ids) {
      const h = hist.get(id);
      if (!h) continue;
      const doMes = ontem(hoje) >= inicioCompetencia(comp) ? (calcularRecordes(linhas, rp, id, ontem(hoje), inicioCompetencia(comp)).melhorDia?.valor ?? 0) : 0;
      const dia = pHoje.get(id)?.agendouValidos ?? 0;
      if (h.melhorDia >= 3 && dia > Math.max(h.melhorDia, doMes)) recordes.push(`#${codigoDe(id)} bateu o recorde pessoal do dia: ${dia} agendamentos válidos hoje!`);
      const mes = pMes.get(id)?.agendouValidos ?? 0;
      if (h.melhorMes >= 20 && mes > h.melhorMes) recordes.push(`#${codigoDe(id)} já fez o melhor mês dos últimos 12: ${mes} agendamentos válidos!`);
    }
  }

  return {
    nome: painel.nome,
    equipes: (equipes ?? []).map((e) => e.nome),
    competencia: comp,
    atualizado_em: sync?.finalizado_em ?? null,
    config,
    telas: ordenadas,
    recordes,
    canal: canalControle(painel.id),
  };
}
