import "server-only";
import { grupoOperadora, tabelaPreco, titulo } from "@/engine/classificacao";
import { competenciaAnterior, competenciaDe, contarDiasUteis, fimCompetencia, formatarDataBR, somarDias } from "@/engine/datas";
import { ROTULO_FAIXA } from "@/engine/faturamento";
import { textoDatas } from "@/engine/periodos";
import { assinatura, categoriaMotivo, tendencia, type PontoMes, type Tendencia } from "@/engine/tendencias";
import {
  COMPARACOES_IA,
  NOME_RECORTE,
  NOME_SECAO,
  PERIODOS_IA,
  RECORTES_IA,
  SECOES_IA,
  ARQUIVO_GERAL,
  nomeArquivo,
  type ComparacaoIA,
  type PeriodoIA,
  type RecorteIA,
  type SecaoIA,
} from "@/lib/analises/arquivos";
import {
  abaConversao,
  abaEquipes,
  abaFaturamento,
  abaPerdas,
  abaQuem,
  baseMarcacoes,
  coberturaFaturamento,
  desfechos,
  desfechosPorProfissional,
  lerFiltros,
  perdasPeriodo,
  pessoasDaClinica,
  producaoMensal,
  seriesMensais,
  type FiltrosGestao,
  type LinhaDesfecho,
  type LinhaSerie,
  type Pessoa,
} from "@/lib/dados/gestao";
import { linhasRelatorio } from "@/lib/dados/relatorios";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Monta, para cada análise da IA, um JSON compacto com os números já calculados.
// Regras: nada de paciente; motivo de cancelamento só como categoria; contestações só em contagem.

type Db = ReturnType<typeof criarClienteAdmin>;

const r1 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const variacao = (atual: number | null | undefined, base: number | null | undefined) =>
  atual === null || atual === undefined || !base ? null : r1(((atual - base) / Math.abs(base)) * 100);
const fatia = (parte: number, total: number) => (total ? r1((parte / total) * 100) : null);
const noRecorte = (operadora: string, recorte: RecorteIA) => recorte === "todas" || grupoOperadora(operadora) === "Particular";

/** Tendência resumida (menos texto para a IA ler). */
function resumoTendencia(t: Tendencia) {
  return {
    vs_mes_anterior: t.vs_mes_anterior,
    vs_media_3_meses: t.vs_media_3,
    vs_mesmo_mes_ano_anterior: t.vs_ano_anterior,
    meses_seguidos_em_queda: t.meses_seguidos_em_queda,
    meses_seguidos_em_alta: t.meses_seguidos_em_alta,
    unidade_das_variacoes: t.unidade_variacao,
    ultimos_meses: t.ultimos.map((u) => [u.mes, u.valor]),
  };
}

// ------------------------------------------------------------------ referência de datas

export interface Referencia {
  hoje: string;
  ontem: string;
  /** dia 1: refaz tudo o que fechou */
  virouMes: boolean;
  /** meses fechados para tendências (os 13 antes do mês de hoje) */
  mesesFechados: string[];
}

export function referencia(hoje: string): Referencia {
  const comp = competenciaDe(hoje);
  const mesesFechados = Array.from({ length: 13 }, (_, i) => competenciaAnterior(comp, 13 - i));
  return { hoje, ontem: somarDias(hoje, -1), virouMes: hoje.slice(8) === "01", mesesFechados };
}

/** Filtros de uma análise: "este mês" e "este ano" terminam ontem; os fechados usam o calendário de hoje. */
function filtrosDe(periodo: PeriodoIA, comparacao: ComparacaoIA, recorte: RecorteIA, ref: Referencia): FiltrosGestao | null {
  const emAndamento = periodo === "mes" || periodo === "ano";
  if (periodo === "mes" && competenciaDe(ref.ontem) !== competenciaDe(ref.hoje)) return null; // dia 1: o mês novo ainda não tem dados
  if (periodo === "ano" && ref.ontem.slice(0, 4) !== ref.hoje.slice(0, 4)) return null; // 1º de janeiro
  const f = lerFiltros({ p: periodo, comparar: comparacao }, emAndamento ? ref.ontem : ref.hoje);
  return { ...f, operadora: recorte === "particular" ? "Particular" : "todas" };
}

/** Os mesmos filtros, olhando a janela de comparação (para os números "de antes"). */
function naComparacao(f: FiltrosGestao): FiltrosGestao | null {
  if (!f.base) return null;
  return {
    ...f,
    janela: { ...f.janela, inicio: f.base.inicio, fim: f.base.fim, nome: f.base.nome, datas: textoDatas(f.base.inicio, f.base.fim) },
    base: null,
  };
}

// ------------------------------------------------------------------ dados compartilhados da rodada

interface Compartilhado {
  db: Db;
  ref: Referencia;
  series: LinhaSerie[];
  desfechosMeses: LinhaDesfecho[];
  prodMensal: { mes: string; operadora: string; categoria: string; qtd: number; valor: number }[];
  pessoas: Pessoa[];
  equipeDe: (login: string) => string;
  nomeDe: (login: string) => string;
  feriados: Set<string>;
}

async function compartilhado(db: Db, ref: Referencia): Promise<Compartilhado> {
  const ini = `${ref.mesesFechados[0]}-01`;
  const fim = fimCompetencia(ref.mesesFechados[ref.mesesFechados.length - 1]);
  const [series, desfechosMeses, prodMensal, pessoas, fer] = await Promise.all([
    seriesMensais(db, ini, fim, ref.ontem),
    desfechos(db, ini, fim),
    producaoMensal(db),
    pessoasDaClinica(db),
    db.from("feriados").select("data"),
  ]);
  const quem = new Map(pessoas.map((p) => [p.login, p]));
  return {
    db,
    ref,
    series,
    desfechosMeses,
    prodMensal,
    pessoas,
    equipeDe: (l) => quem.get(l)?.equipe ?? "Sem equipe",
    nomeDe: (l) => quem.get(l)?.nome ?? (l || "Sem responsável"),
    feriados: new Set((fer.data ?? []).map((x) => String(x.data))),
  };
}

/** Série mensal (meses fechados) somada por uma chave, no recorte. */
function seriePor(c: Compartilhado, recorte: RecorteIA, chave: (l: LinhaSerie) => string) {
  const m = new Map<string, Map<string, { n: number; verificaveis: number; atendidas: number; valor: number }>>();
  for (const l of c.series) {
    if (!noRecorte(l.operadora, recorte)) continue;
    const k = chave(l);
    const porMes = m.get(k) ?? new Map();
    const o = porMes.get(l.mes) ?? { n: 0, verificaveis: 0, atendidas: 0, valor: 0 };
    o.n += l.n;
    o.verificaveis += l.verificaveis;
    o.atendidas += l.atendidas;
    o.valor += l.valor;
    porMes.set(l.mes, o);
    m.set(k, porMes);
  }
  return m;
}

const pontos = (
  meses: string[],
  porMes: Map<string, { n: number; verificaveis: number; atendidas: number; valor: number }> | undefined,
  valor: (o: { n: number; verificaveis: number; atendidas: number; valor: number }) => number | null,
): PontoMes[] => meses.map((mes) => ({ mes, valor: porMes?.get(mes) ? valor(porMes.get(mes)!) : 0 }));

function contexto(secao: string, f: FiltrosGestao, recorte: RecorteIA, ref: Referencia) {
  return {
    secao,
    recorte: NOME_RECORTE[recorte],
    periodo: f.janela.nome,
    datas: f.janela.datas,
    inicio: f.janela.inicio,
    fim: f.janela.fim,
    periodo_em_andamento: f.janela.emAndamento,
    comparacao: f.base?.nome ?? null,
    comparacao_inicio: f.base?.inicio ?? null,
    comparacao_fim: f.base?.fim ?? null,
    dados_ate: formatarDataBR(ref.ontem),
  };
}

// ------------------------------------------------------------------ seções

async function dadosFaturamento(f: FiltrosGestao, recorte: RecorteIA, c: Compartilhado) {
  const fb = naComparacao(f);
  const [d, dB] = await Promise.all([abaFaturamento(f, "categoria", c.db), fb ? abaFaturamento(fb, "categoria", c.db) : null]);
  const res = (r: typeof d.atual) => ({
    faturamento: r2(r.valor),
    procedimentos: r.qtd,
    valor_medio: r2(r.valorMedio),
    dias_de_atendimento: r.dias,
    procedimentos_por_dia: r1(r.porDia),
  });
  const variacoes = (l: { rotulo: string; antes: number; depois: number; diferenca: number }[]) =>
    l.map((v) => ({ nome: v.rotulo, antes: r2(v.antes), depois: r2(v.depois), diferenca: r2(v.diferenca) }));
  const mix = (chave: (l: (typeof d.linhas)[number]) => string) => {
    const soma = (ls: typeof d.linhas) => {
      const m = new Map<string, number>();
      for (const l of ls) m.set(chave(l), (m.get(chave(l)) ?? 0) + l.valor);
      return m;
    };
    const a = soma(d.linhas);
    const b = dB ? soma(dB.linhas) : new Map<string, number>();
    const totalA = [...a.values()].reduce((x, y) => x + y, 0);
    return [...a.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 8)
      .map(([nome, v]) => ({ nome, atual: r2(v), comparacao: dB ? r2(b.get(nome) ?? 0) : null, variacao_pct: dB ? variacao(v, b.get(nome) ?? 0) : null, fatia_pct: fatia(v, totalA) }));
  };
  // série mensal (meses fechados) e sazonalidade, no recorte
  const porMes = new Map<string, { valor: number; qtd: number }>();
  for (const m of c.prodMensal) {
    if (!noRecorte(m.operadora, recorte)) continue;
    const o = porMes.get(m.mes) ?? { valor: 0, qtd: 0 };
    o.valor += m.valor;
    o.qtd += m.qtd;
    porMes.set(m.mes, o);
  }
  const serie = c.ref.mesesFechados.map((mes) => {
    const o = porMes.get(mes);
    return { mes, faturamento: r2(o?.valor ?? 0), procedimentos: o?.qtd ?? 0, valor_medio: o?.qtd ? r2(o.valor / o.qtd) : null };
  });
  const fechados = [...porMes.entries()].filter(([mes]) => mes < competenciaDe(c.ref.hoje));
  const mediaGeral = fechados.length ? fechados.reduce((s, [, o]) => s + o.valor, 0) / fechados.length : 0;
  const mesesDaJanela = Array.from(new Set([f.janela.inicio, f.janela.fim].map((x) => x.slice(5, 7)))).slice(0, 2);
  const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const sazonalidade = mesesDaJanela.map((mm) => {
    const doMes = fechados.filter(([mes]) => mes.slice(5, 7) === mm);
    const media = doMes.length ? doMes.reduce((s, [, o]) => s + o.valor, 0) / doMes.length : null;
    return {
      mes_do_ano: NOMES[Number(mm) - 1],
      anos_com_dado: doMes.length,
      media_historica: r2(media),
      indice_vs_media_de_todos_os_meses: media && mediaGeral ? r2(media / mediaGeral) : null,
    };
  });
  const extra: Record<string, unknown> = {};
  if (recorte === "particular") {
    const toda = await abaFaturamento({ ...f, operadora: "todas" }, "categoria", c.db);
    extra.contexto_clinica_toda = {
      faturamento_clinica_toda: r2(toda.atual.valor),
      faturamento_clinica_toda_comparacao: toda.base ? r2(toda.base.valor) : null,
      variacao_pct: toda.base ? variacao(toda.atual.valor, toda.base.valor) : null,
      fatia_do_particular_pct: fatia(d.atual.valor, toda.atual.valor),
    };
  } else {
    const grupo = (ls: typeof d.linhas) => {
      const m = new Map<string, number>();
      for (const l of ls) m.set(grupoOperadora(l.operadora), (m.get(grupoOperadora(l.operadora)) ?? 0) + l.valor);
      return m;
    };
    const a = grupo(d.linhas);
    const b = dB ? grupo(dB.linhas) : new Map<string, number>();
    const ta = [...a.values()].reduce((x, y) => x + y, 0);
    const tb = [...b.values()].reduce((x, y) => x + y, 0);
    extra.operadoras = [...a.entries()].map(([g, v]) => ({
      grupo: g,
      atual: r2(v),
      comparacao: dB ? r2(b.get(g) ?? 0) : null,
      variacao_pct: dB ? variacao(v, b.get(g) ?? 0) : null,
      fatia_pct: fatia(v, ta),
      fatia_comparacao_pct: dB ? fatia(b.get(g) ?? 0, tb) : null,
    }));
  }
  return {
    kpis: {
      atual: res(d.atual),
      comparacao: d.base ? res(d.base) : null,
      variacao_pct: d.base
        ? {
            faturamento: variacao(d.atual.valor, d.base.valor),
            procedimentos: variacao(d.atual.qtd, d.base.qtd),
            valor_medio: variacao(d.atual.valorMedio, d.base.valorMedio),
            dias_de_atendimento: variacao(d.atual.dias, d.base.dias),
          }
        : null,
    },
    decomposicao: d.decomposicao
      ? {
          diferenca_rs: d.decomposicao.diferenca,
          efeito_dias_de_atendimento_rs: d.decomposicao.dias,
          efeito_procedimentos_por_dia_rs: d.decomposicao.volume,
          efeito_valor_medio_rs: d.decomposicao.valorMedio,
        }
      : null,
    medicos: d.porMedico ? { mais_cresceram: variacoes(d.porMedico.ganhos), mais_cairam: variacoes(d.porMedico.quedas) } : null,
    procedimentos: d.porProcedimento ? { mais_cresceram: variacoes(d.porProcedimento.ganhos), mais_cairam: variacoes(d.porProcedimento.quedas) } : null,
    mix: { por_categoria: mix((l) => titulo(l.categoria) || "Sem categoria"), por_tabela_de_preco: mix((l) => tabelaPreco(l.operadora)) },
    serie_mensal: serie,
    tendencia: resumoTendencia(tendencia(serie.map((s) => ({ mes: s.mes, valor: s.faturamento })))),
    sazonalidade,
    ...extra,
  };
}

async function dadosMarcacao(f: FiltrosGestao, recorte: RecorteIA, c: Compartilhado) {
  const d = await abaConversao(f, c.db);
  const funil = (fu: typeof d.funil) => ({
    marcadas: fu.marcadas,
    conferiveis: fu.verificaveis,
    aconteceram: fu.atendidas,
    comparecimento_pct: fatia(fu.atendidas, fu.verificaveis),
    rs_gerado: r2(fu.valor),
    rs_por_consulta: fu.atendidas ? r2(fu.valor / fu.atendidas) : null,
  });
  const porPessoa = seriePor(c, recorte, (l) => l.login);
  const meses = c.ref.mesesFechados;
  const pessoas = d.pessoas
    .filter((p) => p.marcacoes >= 5)
    .slice(0, 40)
    .map((p) => {
      const s = porPessoa.get(p.login);
      return {
        nome: p.nome,
        equipe: p.equipe,
        marcacoes: p.marcacoes,
        marcacoes_comparacao: p.marcacoesBase,
        variacao_marcacoes_pct: variacao(p.marcacoes, p.marcacoesBase),
        comparecimento_pct: r1(p.comparecimento),
        rs_gerado: r2(p.valor),
        rs_por_consulta: r2(p.valorMedio),
        posicao: p.faixa ? ROTULO_FAIXA[p.faixa] : null,
        poucos_dados: p.marcacoes < 10 || p.verificaveis < 20,
        tendencia_marcacoes: resumoTendencia(tendencia(pontos(meses, s, (o) => o.n))),
        tendencia_comparecimento: resumoTendencia(
          tendencia(
            meses.map((mes) => {
              const o = s?.get(mes);
              return { mes, valor: o && o.verificaveis >= 10 ? r1((o.atendidas / o.verificaveis) * 100) : null };
            }),
            { pp: true },
          ),
        ),
      };
    });
  const porEquipe = new Map<string, { marc: number[]; comp: number[] }>();
  for (const p of d.pessoas.filter((x) => x.marcacoes >= 10)) {
    const o = porEquipe.get(p.equipe) ?? { marc: [], comp: [] };
    o.marc.push(p.marcacoes);
    if (p.comparecimento !== null) o.comp.push(p.comparecimento);
    porEquipe.set(p.equipe, o);
  }
  const mediana = (v: number[]) => {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  return {
    funil: { atual: funil(d.funil), comparacao: d.funilBase ? funil(d.funilBase) : null },
    pessoas,
    medianas_por_equipe: [...porEquipe.entries()].map(([equipe, o]) => ({
      equipe,
      pessoas_com_10_ou_mais: o.marc.length,
      mediana_marcacoes: r1(mediana(o.marc)),
      mediana_comparecimento_pct: r1(mediana(o.comp)),
    })),
    quartis_marcacoes: d.quartis ? { q1: r1(d.quartis.q1), mediana: r1(d.quartis.mediana), q3: r1(d.quartis.q3) } : null,
    sem_producao: { quantidade: d.semProducao.length, exemplos: d.semProducao.slice(0, 5) },
  };
}

async function dadosEquipes(f: FiltrosGestao, recorte: RecorteIA, c: Compartilhado) {
  const d = await abaEquipes(f, c.db);
  let ultimo = -1;
  d.acumulado.forEach((p, i) => {
    if (p.atual !== null) ultimo = i;
  });
  const ponto = ultimo >= 0 ? d.acumulado[ultimo] : null;
  const porEquipe = seriePor(c, recorte, (l) => c.equipeDe(l.login));
  const meses = c.ref.mesesFechados;
  let projecao: Record<string, unknown> | null = null;
  if (f.janela.periodo === "mes") {
    const dias = [1, 2, 3, 4, 5, 6];
    const passados = contarDiasUteis(f.janela.inicio, f.janela.fim, dias, c.feriados);
    const doMes = contarDiasUteis(f.janela.inicio, fimCompetencia(competenciaDe(f.janela.inicio)), dias, c.feriados);
    const mesAnterior = competenciaAnterior(competenciaDe(f.janela.inicio));
    let totalAnterior = 0;
    for (const porMes of porEquipe.values()) totalAnterior += porMes.get(mesAnterior)?.n ?? 0;
    projecao = {
      marcacoes_ate_agora: d.totalAtual,
      dias_uteis_passados: passados,
      dias_uteis_no_mes: doMes,
      projecao_fim_do_mes: passados ? Math.round((d.totalAtual / passados) * doMes) : null,
      mes_anterior_inteiro: totalAnterior || null,
      como_foi_calculada: "ritmo por dia útil (segunda a sábado, sem feriados) × dias úteis do mês",
    };
  }
  return {
    equipes: d.equipes.map((e) => ({
      equipe: e.equipe,
      pessoas: e.pessoas,
      marcacoes: e.marcacoes,
      marcacoes_comparacao: e.marcacoesBase,
      variacao_pct: variacao(e.marcacoes, e.marcacoesBase),
      participacao_pct: r1(e.participacao),
      viraram_consulta_pct: fatia(e.atendidas, e.marcacoes),
      rs_gerado: r2(e.valor),
    })),
    total: { marcacoes: d.totalAtual, comparacao: d.totalBase, variacao_pct: variacao(d.totalAtual, d.totalBase) },
    ritmo: ponto
      ? {
          dia_do_periodo: ponto.dia,
          acumulado: ponto.atual,
          acumulado_da_comparacao_no_mesmo_dia: ponto.base,
          diferenca_pct: variacao(ponto.atual, ponto.base),
        }
      : null,
    projecao,
    tendencia_por_equipe: d.equipes.slice(0, 6).map((e) => ({
      equipe: e.equipe,
      tendencia_marcacoes: resumoTendencia(tendencia(pontos(meses, porEquipe.get(e.equipe), (o) => o.n))),
    })),
  };
}

async function dadosQuem(f: FiltrosGestao, recorte: RecorteIA, c: Compartilhado) {
  const fb = naComparacao(f);
  const [d, dB, linhas] = await Promise.all([abaQuem(f, c.db), fb ? abaQuem(fb, c.db) : null, baseMarcacoes(f, c.db)]);
  void recorte;
  const totalBase = new Map<string, number>();
  if (dB) dB.profissionais.forEach((p, i) => totalBase.set(p, dB.totalPorProfissional[i]));
  const comp = new Map<string, { verificaveis: number; atendidas: number }>();
  for (const l of linhas) {
    const k = titulo(l.profissional) || "—";
    const o = comp.get(k) ?? { verificaveis: 0, atendidas: 0 };
    o.verificaveis += l.verificaveis;
    o.atendidas += l.atendidas;
    comp.set(k, o);
  }
  const celulaBase = new Map<string, { total: number; por: Map<string, number> }>();
  if (dB)
    for (const l of dB.linhas) {
      const por = new Map<string, number>();
      dB.profissionais.forEach((p, i) => por.set(p, l.celulas[i]));
      celulaBase.set(l.login, { total: l.total, por });
    }
  const profissionais = d.profissionais
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p !== "Outros")
    .map(({ p, i }) => {
      const total = d.totalPorProfissional[i];
      const topo = d.linhas.reduce((m, l) => (l.celulas[i] > m.n ? { nome: l.nome, n: l.celulas[i] } : m), { nome: "", n: 0 });
      const cp = comp.get(p);
      return {
        profissional: p,
        marcacoes: total,
        marcacoes_comparacao: dB ? (totalBase.get(p) ?? 0) : null,
        variacao_pct: dB ? variacao(total, totalBase.get(p) ?? 0) : null,
        comparecimento_pct: cp && cp.verificaveis >= 20 ? fatia(cp.atendidas, cp.verificaveis) : null,
        quem_mais_marca: topo.nome || null,
        fatia_de_quem_mais_marca_pct: fatia(topo.n, total),
      };
    });
  return {
    profissionais,
    pessoas: d.linhas.slice(0, 20).map((l) => {
      const base = celulaBase.get(l.login);
      const destinos = d.profissionais
        .map((p, i) => ({ p, n: l.celulas[i] }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 3)
        .map((x) => ({
          profissional: x.p,
          marcacoes: x.n,
          fatia_pct: fatia(x.n, l.total),
          fatia_comparacao_pct: base ? fatia(base.por.get(x.p) ?? 0, base.total) : null,
        }));
      return { nome: l.nome, equipe: l.equipe, marcacoes: l.total, principais_destinos: destinos };
    }),
    dependencia: profissionais
      .filter((p) => p.marcacoes >= 20 && (p.fatia_de_quem_mais_marca_pct ?? 0) > 50)
      .map((p) => ({ profissional: p.profissional, pessoa: p.quem_mais_marca, fatia_pct: p.fatia_de_quem_mais_marca_pct })),
  };
}

function taxasDe(linhas: { operadora: string; situacao: string; n: number }[], recorte: RecorteIA) {
  const t = { total: 0, realizadas: 0, faltas: 0, canceladas: 0, remarcadas: 0, sem_desfecho: 0 };
  for (const l of linhas) {
    if (!noRecorte(l.operadora, recorte)) continue;
    t.total += l.n;
    if (l.situacao === "realizada") t.realizadas += l.n;
    else if (l.situacao === "falta" || l.situacao === "nao_realizada") t.faltas += l.n;
    else if (l.situacao === "cancelada") t.canceladas += l.n;
    else if (l.situacao === "remarcada" || l.situacao === "falta_remarcada") t.remarcadas += l.n;
    else if (l.situacao === "sem_desfecho") t.sem_desfecho += l.n;
  }
  const baseTaxa = t.realizadas + t.faltas + t.canceladas;
  return {
    consultas_marcadas_para_o_periodo: t.total,
    aconteceram: t.realizadas,
    faltas: t.faltas,
    cancelamentos: t.canceladas,
    remarcacoes: t.remarcadas,
    ainda_sem_desfecho: t.sem_desfecho,
    taxa_falta_pct: fatia(t.faltas, baseTaxa),
    taxa_cancelamento_pct: fatia(t.canceladas, baseTaxa),
    taxa_remarcacao_pct: fatia(t.remarcadas, t.total),
  };
}

async function dadosPerdas(f: FiltrosGestao, recorte: RecorteIA, c: Compartilhado) {
  const fb = naComparacao(f);
  const [d, dB, dsA, dsB, pA, pB, porProf] = await Promise.all([
    abaPerdas(f, c.db),
    fb ? abaPerdas(fb, c.db) : null,
    desfechos(c.db, f.janela.inicio, f.janela.fim),
    f.base ? desfechos(c.db, f.base.inicio, f.base.fim) : null,
    perdasPeriodo(c.db, f.janela.inicio, f.janela.fim),
    f.base ? perdasPeriodo(c.db, f.base.inicio, f.base.fim) : null,
    desfechosPorProfissional(c.db, f.janela.inicio, f.janela.fim),
  ]);
  // motivos: só categorias (o texto livre pode ter nome de paciente e nunca sai daqui)
  const motivos = (ls: typeof pA) => {
    const m = new Map<string, number>();
    for (const l of ls) {
      if (l.situacao !== "cancelada" || !noRecorte(l.operadora, recorte)) continue;
      const k = categoriaMotivo(l.motivo);
      m.set(k, (m.get(k) ?? 0) + l.n);
    }
    return m;
  };
  const mA = motivos(pA);
  const mB = pB ? motivos(pB) : null;
  const totalCanc = [...mA.values()].reduce((a, b) => a + b, 0);
  // taxas por médico/agenda
  const prof = new Map<string, { realizadas: number; faltas: number; canceladas: number }>();
  for (const l of porProf) {
    if (!noRecorte(l.operadora, recorte)) continue;
    const k = titulo(l.profissional) || "—";
    const o = prof.get(k) ?? { realizadas: 0, faltas: 0, canceladas: 0 };
    if (l.situacao === "realizada") o.realizadas += l.n;
    else if (l.situacao === "falta" || l.situacao === "nao_realizada") o.faltas += l.n;
    else if (l.situacao === "cancelada") o.canceladas += l.n;
    prof.set(k, o);
  }
  const mixGrupo = (ls: { grupo: string; n?: number; valor?: number }[] | undefined, campo: "n" | "valor") => {
    const m = new Map<string, number>();
    for (const l of ls ?? []) m.set(l.grupo, (m.get(l.grupo) ?? 0) + (l[campo] ?? 0));
    const t = [...m.values()].reduce((a, b) => a + b, 0);
    return { m, t };
  };
  const operadoras = (campo: "n" | "valor", a: { grupo: string }[], b: { grupo: string }[] | undefined) => {
    const A = mixGrupo(a as { grupo: string; n?: number; valor?: number }[], campo);
    const B = b ? mixGrupo(b as { grupo: string; n?: number; valor?: number }[], campo) : null;
    return [...A.m.entries()].map(([grupo, v]) => ({
      grupo,
      atual: campo === "valor" ? r2(v) : v,
      fatia_pct: fatia(v, A.t),
      fatia_comparacao_pct: B ? fatia(B.m.get(grupo) ?? 0, B.t) : null,
    }));
  };
  const meses = c.ref.mesesFechados;
  const porMes = (k: "taxa_falta_pct" | "taxa_cancelamento_pct") =>
    meses.map((mes) => ({ mes, valor: taxasDe(c.desfechosMeses.filter((l) => l.mes === mes), recorte)[k] }));
  const contar = (l: { faltas: number; canceladas: number; remarcadas: number; rotulo: string }) => ({
    nome: l.rotulo,
    faltas: l.faltas,
    cancelamentos: l.canceladas,
    remarcacoes: l.remarcadas,
  });
  return {
    taxas: { atual: taxasDe(dsA, recorte), comparacao: dsB ? taxasDe(dsB, recorte) : null },
    tendencia_taxa_falta: resumoTendencia(tendencia(porMes("taxa_falta_pct"), { pp: true })),
    tendencia_taxa_cancelamento: resumoTendencia(tendencia(porMes("taxa_cancelamento_pct"), { pp: true })),
    motivos: {
      cancelamentos: totalCanc,
      categorias: [...mA.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([categoria, n]) => ({ categoria, cancelamentos: n, fatia_pct: fatia(n, totalCanc), comparacao: mB ? (mB.get(categoria) ?? 0) : null })),
      sem_motivo_registrado_pct: fatia(mA.get("Sem motivo registrado") ?? 0, totalCanc),
    },
    onde: {
      por_medico_ou_agenda: [...prof.entries()]
        .map(([nome, o]) => {
          const base = o.realizadas + o.faltas + o.canceladas;
          return { nome, consultas: base, faltas: o.faltas, cancelamentos: o.canceladas, taxa_falta_pct: base >= 20 ? fatia(o.faltas, base) : null };
        })
        .sort((a, b) => b.faltas + b.cancelamentos - (a.faltas + a.cancelamentos))
        .slice(0, 10),
      por_procedimento: d.porProcedimento.slice(0, 10).map(contar),
      por_quem_marcou: d.porPessoa.slice(0, 10).map(contar),
    },
    operadoras: {
      marcacoes: operadoras("n", d.mixMarcacoes, dB?.mixMarcacoes),
      faturamento: operadoras("valor", d.mixFaturamento, dB?.mixFaturamento),
    },
  };
}

const MONTADORES: Record<SecaoIA, (f: FiltrosGestao, r: RecorteIA, c: Compartilhado) => Promise<Record<string, unknown>>> = {
  faturamento: dadosFaturamento,
  marcacao: dadosMarcacao,
  equipes: dadosEquipes,
  quem: dadosQuem,
  perdas: dadosPerdas,
};

// ------------------------------------------------------------------ análise geral

async function dadosGeral(c: Compartilhado) {
  const { db, ref } = c;
  const manchetes: Record<string, unknown>[] = [];
  for (const recorte of RECORTES_IA) {
    for (const [periodo, comparacao] of [
      ["mes", "anterior"],
      ["mes_passado", "anterior"],
      ["12m", "ano"],
    ] as const) {
      const f = filtrosDe(periodo, comparacao, recorte, ref);
      if (!f) continue;
      const [fat, conv, dsA, dsB] = await Promise.all([
        abaFaturamento(f, "categoria", db),
        abaConversao(f, db),
        desfechos(db, f.janela.inicio, f.janela.fim),
        f.base ? desfechos(db, f.base.inicio, f.base.fim) : null,
      ]);
      const tA = taxasDe(dsA, recorte);
      const tB = dsB ? taxasDe(dsB, recorte) : null;
      const comp = (fu: typeof conv.funil) => fatia(fu.atendidas, fu.verificaveis);
      manchetes.push({
        recorte: NOME_RECORTE[recorte],
        periodo: f.janela.nome,
        datas: f.janela.datas,
        comparacao: f.base?.nome ?? null,
        faturamento: { atual: r2(fat.atual.valor), comparacao: fat.base ? r2(fat.base.valor) : null, variacao_pct: fat.base ? variacao(fat.atual.valor, fat.base.valor) : null },
        marcacoes: { atual: conv.funil.marcadas, comparacao: conv.funilBase?.marcadas ?? null, variacao_pct: variacao(conv.funil.marcadas, conv.funilBase?.marcadas) },
        comparecimento_pct: { atual: comp(conv.funil), comparacao: conv.funilBase ? comp(conv.funilBase) : null },
        rs_gerado_pelas_marcacoes: { atual: r2(conv.funil.valor), comparacao: conv.funilBase ? r2(conv.funilBase.valor) : null },
        taxa_falta_pct: { atual: tA.taxa_falta_pct, comparacao: tB?.taxa_falta_pct ?? null },
        taxa_cancelamento_pct: { atual: tA.taxa_cancelamento_pct, comparacao: tB?.taxa_cancelamento_pct ?? null },
      });
    }
  }

  // desempenho de cada pessoa do Trackco (notas, níveis e metas dos últimos 6 meses) + ausências + tendência
  const comp = competenciaDe(ref.hoje);
  const [rel, colabs, aus, cont, fech, syncs, cobertura] = await Promise.all([
    linhasRelatorio(db as unknown as Parameters<typeof linhasRelatorio>[0], { de: competenciaAnterior(comp, 6), ate: comp }),
    db.from("colaboradores").select("id, nome, login_klingo, ativo"),
    db
      .from("ausencias")
      .select("colaborador_id, inicio, fim, tipo")
      .gte("fim", `${competenciaAnterior(comp, 3)}-01`),
    db.from("contestacoes").select("status, criado_em, respondido_em"),
    db.from("fechamentos").select("status, competencia, equipes(nome)").eq("competencia", `${competenciaAnterior(comp)}-01`),
    db.from("sync_execucoes").select("status, iniciado_em").gte("iniciado_em", `${somarDias(ref.hoje, -7)}T00:00:00Z`),
    coberturaFaturamento(db, 6),
  ]);
  const colab = new Map((colabs.data ?? []).map((x) => [String(x.id), x]));
  const porLogin = seriePor(c, "todas", (l) => l.login);
  const pessoas = new Map<string, Record<string, unknown> & { meses: unknown[] }>();
  for (const l of rel) {
    const k = l.colaborador_id;
    const login = String(colab.get(k)?.login_klingo ?? "").toLowerCase();
    const p =
      pessoas.get(k) ??
      ({
        nome: l.nome,
        equipe: c.equipeDe(login),
        funcao: l.funcao,
        meses: [] as unknown[],
        tendencia_marcacoes: login ? resumoTendencia(tendencia(pontos(ref.mesesFechados, porLogin.get(login), (o) => o.n))) : null,
      } as Record<string, unknown> & { meses: unknown[] });
    p.meses.push({
      mes: l.competencia,
      oficial: l.oficial,
      nivel: l.nivel,
      nota_pct: r1(l.nota),
      indicadores: l.resultado.indicadores.map((i) => ({
        nome: i.nome,
        realizado: r1(i.realizado),
        meta_ajustada: r1(i.meta_ajustada),
        atingimento_pct: r1(i.atingimento_pct),
      })),
    });
    pessoas.set(k, p);
  }
  const ausencias = (aus.data ?? []).map((a) => ({
    nome: colab.get(String(a.colaborador_id))?.nome ?? "—",
    inicio: a.inicio,
    fim: a.fim,
    tipo: a.tipo,
  }));
  const contestacoes = cont.data ?? [];
  const abertas = contestacoes.filter((x) => x.status === "aberta" || x.status === "em_analise");
  const maisAntiga = abertas.reduce((m, x) => (!m || String(x.criado_em) < m ? String(x.criado_em) : m), "");
  const semEquipe = [...porLogin.entries()].filter(([login]) => c.equipeDe(login) === "Sem equipe");
  const ultimoMes = ref.mesesFechados[ref.mesesFechados.length - 1];
  const fp = filtrosDe("mes_passado", "anterior", "todas", ref)!;
  const pMes = await perdasPeriodo(db, fp.janela.inicio, fp.janela.fim);
  const canc = pMes.filter((l) => l.situacao === "cancelada");
  const totalCanc = canc.reduce((s, l) => s + l.n, 0);
  const semMotivo = canc.filter((l) => categoriaMotivo(l.motivo) === "Sem motivo registrado").reduce((s, l) => s + l.n, 0);
  return {
    manchetes_da_gestao: manchetes,
    pessoas: [...pessoas.values()],
    ausencias_ultimos_3_meses: ausencias,
    operacao_e_dados: {
      contestacoes_abertas: abertas.length,
      contestacao_aberta_mais_antiga_em: maisAntiga ? maisAntiga.slice(0, 10) : null,
      contestacoes_respondidas_ultimos_30_dias: contestacoes.filter((x) => x.respondido_em && String(x.respondido_em) >= somarDias(ref.hoje, -30)).length,
      fechamentos_do_mes_passado: (fech.data ?? []).map((x) => ({
        equipe: (x.equipes as unknown as { nome: string } | null)?.nome ?? "—",
        status: x.status,
      })),
      cobertura_do_faturamento_particular: cobertura.map((x) => ({ mes: x.mes, ligado_a_marcacoes_pct: r1(x.pct) })),
      sincronizacoes_com_erro_ultimos_7_dias: (syncs.data ?? []).filter((x) => x.status === "erro").length,
      cancelamentos_sem_motivo_mes_passado_pct: fatia(semMotivo, totalCanc),
      pessoas_sem_equipe_marcando: {
        pessoas: semEquipe.filter(([, m]) => (m.get(ultimoMes)?.n ?? 0) > 0).length,
        marcacoes_no_ultimo_mes_fechado: semEquipe.reduce((s, [, m]) => s + (m.get(ultimoMes)?.n ?? 0), 0),
      },
    },
  };
}

// ------------------------------------------------------------------ trabalhos da rodada

export interface Trabalho {
  tipo: "secao" | "geral";
  arquivo: string;
  secao?: SecaoIA;
  periodo?: PeriodoIA;
  comparacao?: ComparacaoIA;
  recorte?: RecorteIA;
  /** cabeçalho do arquivo (o script escreve; a IA nunca copia) */
  meta: Record<string, string>;
  /** o JSON que a IA recebe */
  dados: Record<string, unknown>;
  /** muda só quando os números mudam de verdade */
  assinatura: string;
  /** mês e ano em andamento (e a geral) mudam todo dia */
  sempre: boolean;
}

/** Monta os dados de todas as análises da rodada (as seções e, por último, a geral). */
export async function montarTrabalhos(hoje: string, opcoes: { secoes?: SecaoIA[]; db?: Db } = {}): Promise<{ ref: Referencia; trabalhos: Trabalho[] }> {
  const db = opcoes.db ?? criarClienteAdmin();
  const ref = referencia(hoje);
  const c = await compartilhado(db, ref);
  const secoes = opcoes.secoes ?? [...SECOES_IA];
  const trabalhos: Trabalho[] = [];
  for (const periodo of PERIODOS_IA) {
    for (const comparacao of COMPARACOES_IA) {
      for (const recorte of RECORTES_IA) {
        const f = filtrosDe(periodo, comparacao, recorte, ref);
        if (!f) continue;
        for (const secao of secoes) {
          const corpo = await MONTADORES[secao](f, recorte, c);
          const ctx = contexto(NOME_SECAO[secao], f, recorte, ref);
          trabalhos.push({
            tipo: "secao",
            arquivo: nomeArquivo(secao, periodo, comparacao, recorte),
            secao,
            periodo,
            comparacao,
            recorte,
            meta: {
              secao,
              periodo,
              comparacao,
              recorte,
              janela_inicio: f.janela.inicio,
              janela_fim: f.janela.fim,
              janela_nome: f.janela.nome,
              janela_datas: f.janela.datas,
              base_nome: f.base?.nome ?? "",
              dados_ate: ref.ontem,
            },
            dados: { contexto: ctx, ...corpo },
            assinatura: assinatura(corpo),
            sempre: periodo === "mes" || periodo === "ano",
          });
        }
      }
    }
  }
  const geral = await dadosGeral(c);
  trabalhos.push({
    tipo: "geral",
    arquivo: ARQUIVO_GERAL,
    meta: { secao: "geral", dados_ate: ref.ontem },
    dados: { contexto: { dados_ate: formatarDataBR(ref.ontem), hoje: formatarDataBR(ref.hoje) }, ...geral },
    assinatura: assinatura(geral),
    sempre: true,
  });
  return { ref, trabalhos };
}
