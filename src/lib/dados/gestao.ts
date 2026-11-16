import "server-only";
import {
  ehCortesia,
  grupoOperadora,
  nomeOperadora,
  procedimentosSemProducao,
  tabelaPreco,
  tipoAgenda,
  titulo,
  type GrupoOperadora,
} from "@/engine/classificacao";
import { competenciaAnterior, competenciaDe, contarDiasUteis, datasEntre, fimCompetencia, hojeNoFuso, somarDias } from "@/engine/datas";
import {
  decompor,
  faixaDoQuartil,
  maioresVariacoes,
  quartis,
  resumoFaturamento,
  type Decomposicao,
  type Faixa,
  type Quartis,
  type ResumoFaturamento,
  type Variacao,
} from "@/engine/faturamento";
import { janelaAnoAnterior, janelaAnterior, janelaRapida, textoDatas, type JanelaPeriodo } from "@/engine/periodos";
import { lembrar } from "@/lib/memoria";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Área Gestão (só administradores). Lê pelo servidor (secret key) as funções trackco.gestao_*,
// que já devolvem os dados somados (sem paciente). As contas ficam aqui e no motor (src/engine).

type Db = ReturnType<typeof criarClienteAdmin>;

// ------------------------------------------------------------------ filtros e períodos

export type PeriodoGestao = "mes" | "mes_passado" | "3m" | "ano" | "12m" | "personalizado";
export type Comparar = "anterior" | "ano" | "nada";
export type OpcaoOperadora = GrupoOperadora | "todas";
export type OpcaoCortesia = "incluir" | "excluir" | "so";
export type OpcaoAgenda = "todas" | "medico" | "exame";

export interface FiltrosGestao {
  janela: { inicio: string; fim: string; nome: string; datas: string; emAndamento: boolean; periodo: PeriodoGestao };
  comparar: Comparar;
  base: { inicio: string; fim: string; nome: string } | null;
  equipe: string; // "" = clínica toda
  pessoa: string; // login do Klingo; "" = todas
  operadora: OpcaoOperadora;
  categoria: string;
  medico: string;
  procedimento: string;
  cortesia: OpcaoCortesia;
  agenda: OpcaoAgenda;
  hoje: string;
}

const um = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T =>
  typeof v === "string" && (opcoes as readonly string[]).includes(v) ? (v as T) : padrao;
const texto = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
const dataValida = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);


function janelaGestao(p: PeriodoGestao, de: string | null, ate: string | null, hoje: string): FiltrosGestao["janela"] {
  const comp = competenciaDe(hoje);
  if (p === "mes" || p === "mes_passado") {
    const j: JanelaPeriodo = janelaRapida(p, hoje);
    return { inicio: j.inicio, fim: j.fim, nome: j.nome, datas: j.datas, emAndamento: j.emAndamento, periodo: p };
  }
  if (p === "3m") {
    const inicio = `${competenciaAnterior(comp, 3)}-01`;
    const fim = somarDias(`${comp}-01`, -1);
    return { inicio, fim, nome: "Últimos 3 meses fechados", datas: textoDatas(inicio, fim, hoje.slice(0, 4)), emAndamento: false, periodo: p };
  }
  if (p === "ano") {
    const inicio = `${hoje.slice(0, 4)}-01-01`;
    return { inicio, fim: hoje, nome: `${hoje.slice(0, 4)} até agora`, datas: textoDatas(inicio, hoje), emAndamento: true, periodo: p };
  }
  if (p === "12m") {
    const inicio = `${competenciaAnterior(comp, 12)}-01`;
    const fim = somarDias(`${comp}-01`, -1);
    return { inicio, fim, nome: "Últimos 12 meses fechados", datas: textoDatas(inicio, fim, hoje.slice(0, 4)), emAndamento: false, periodo: p };
  }
  let inicio = de ?? `${comp}-01`;
  let fim = ate && ate < hoje ? ate : hoje;
  if (fim < inicio) [inicio, fim] = [fim, inicio];
  // no máximo 2 anos por vez
  if (Date.parse(fim) - Date.parse(inicio) > 731 * 86_400_000) inicio = somarDias(fim, -730);
  return { inicio, fim, nome: "Período escolhido", datas: textoDatas(inicio, fim, hoje.slice(0, 4)), emAndamento: fim >= hoje, periodo: "personalizado" };
}

function janelaBase(j: FiltrosGestao["janela"], comparar: Comparar, hoje: string): FiltrosGestao["base"] {
  if (comparar === "nada") return null;
  if (comparar === "ano" || j.periodo === "ano") return janelaAnoAnterior(j, hoje);
  if (j.periodo === "mes" || j.periodo === "mes_passado") {
    return janelaAnterior({ ...j, fimPara: j.fim, periodo: j.periodo }, hoje);
  }
  // o mesmo número de dias logo antes
  const dias = Math.round((Date.parse(j.fim) - Date.parse(j.inicio)) / 86_400_000) + 1;
  const fim = somarDias(j.inicio, -1);
  const inicio = somarDias(fim, -(dias - 1));
  return { inicio, fim, nome: `${dias} dias antes (${textoDatas(inicio, fim, hoje.slice(0, 4))})` };
}

/** Lê os filtros da URL (com padrões seguros). */
export function lerFiltros(sp: Record<string, string | string[] | undefined>, hoje = hojeNoFuso()): FiltrosGestao {
  const p = um(sp.p, ["mes", "mes_passado", "3m", "ano", "12m", "personalizado"] as const, "mes");
  const de = dataValida(sp.de);
  const ate = dataValida(sp.ate);
  let janela = janelaGestao(p, de, ate, hoje);
  // mudou as datas sem escolher "Escolher datas…": vale o que foi digitado
  if (p !== "personalizado" && ((de && de !== janela.inicio) || (ate && ate !== janela.fim))) janela = janelaGestao("personalizado", de, ate, hoje);
  const comparar = um(sp.comparar, ["anterior", "ano", "nada"] as const, "anterior");
  return {
    janela,
    comparar,
    base: janelaBase(janela, comparar, hoje),
    equipe: texto(sp.equipe),
    pessoa: texto(sp.pessoa).toLowerCase(),
    operadora: um(sp.operadora, ["Particular", "SUS", "Convênios", "todas"] as const, "Particular"),
    categoria: texto(sp.categoria),
    medico: texto(sp.medico),
    procedimento: texto(sp.procedimento),
    cortesia: um(sp.cortesia, ["incluir", "excluir", "so"] as const, "incluir"),
    agenda: um(sp.agenda, ["todas", "medico", "exame"] as const, "todas"),
    hoje,
  };
}

/** Os filtros de volta para a URL (para links e exportações). */
export function filtrosParaUrl(f: FiltrosGestao, extra: Record<string, string> = {}): URLSearchParams {
  const q = new URLSearchParams();
  q.set("p", f.janela.periodo);
  if (f.janela.periodo === "personalizado") {
    q.set("de", f.janela.inicio);
    q.set("ate", f.janela.fim);
  }
  if (f.comparar !== "anterior") q.set("comparar", f.comparar);
  if (f.equipe) q.set("equipe", f.equipe);
  if (f.pessoa) q.set("pessoa", f.pessoa);
  if (f.operadora !== "Particular") q.set("operadora", f.operadora);
  if (f.categoria) q.set("categoria", f.categoria);
  if (f.medico) q.set("medico", f.medico);
  if (f.procedimento) q.set("procedimento", f.procedimento);
  if (f.cortesia !== "incluir") q.set("cortesia", f.cortesia);
  if (f.agenda !== "todas") q.set("agenda", f.agenda);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return q;
}

// ------------------------------------------------------------------ leitura do banco

export interface LinhaProd {
  data: string;
  medico: string;
  operadora: string;
  categoria: string;
  procedimento: string;
  qtd: number;
  valor: number;
}
export interface LinhaMarc {
  mes: string;
  login: string;
  procedimento: string;
  profissional: string;
  operadora: string;
  n: number;
  verificaveis: number;
  atendidas: number;
  faltas: number;
  canceladas: number;
  remarcadas: number;
  valor: number;
}
export interface LinhaMarcDia {
  data: string;
  login: string;
  operadora: string;
  n: number;
  atendidas: number;
  valor: number;
}
export interface LinhaPerda {
  situacao: string;
  motivo: string;
  login: string;
  procedimento: string;
  profissional: string;
  operadora: string;
  n: number;
}
export interface Pessoa {
  login: string;
  nome: string;
  equipe: string;
}

const MIN5 = 5 * 60_000;
const n = (v: unknown) => Number(v) || 0;
const s = (v: unknown) => String(v ?? "");

async function rpc(db: Db, nome: string, args: Record<string, unknown>): Promise<unknown[][]> {
  const { data, error } = await db.rpc(nome, args);
  if (error) {
    if (/gestao_|klingo_producao|function .* does not exist|Could not find the function/i.test(error.message))
      throw new Error("Falta aplicar no banco a migração 20261117000015 (faturamento e Gestão).");
    throw new Error(error.message);
  }
  return (data ?? []) as unknown[][];
}

const producao = (db: Db, ini: string, fim: string) =>
  lembrar(`gestao-prod|${ini}|${fim}`, MIN5, async () =>
    (await rpc(db, "gestao_producao", { p_ini: ini, p_fim: fim })).map(
      (r): LinhaProd => ({ data: s(r[0]), medico: s(r[1]), operadora: s(r[2]), categoria: s(r[3]), procedimento: s(r[4]), qtd: n(r[5]), valor: n(r[6]) }),
    ),
  );

const producaoMensal = (db: Db) =>
  lembrar(`gestao-prod-mensal`, MIN5, async () =>
    (await rpc(db, "gestao_producao_mensal", {})).map((r) => ({ mes: s(r[0]), operadora: s(r[1]), categoria: s(r[2]), qtd: n(r[3]), valor: n(r[4]) })),
  );

const marcacoes = (db: Db, ini: string, fim: string, hoje: string) =>
  lembrar(`gestao-marc|${ini}|${fim}|${hoje}`, MIN5, async () =>
    (await rpc(db, "gestao_marcacoes", { p_ini: ini, p_fim: fim, p_hoje: hoje })).map(
      (r): LinhaMarc => ({
        mes: s(r[0]),
        login: s(r[1]),
        procedimento: s(r[2]),
        profissional: s(r[3]),
        operadora: s(r[4]),
        n: n(r[5]),
        verificaveis: n(r[6]),
        atendidas: n(r[7]),
        faltas: n(r[8]),
        canceladas: n(r[9]),
        remarcadas: n(r[10]),
        valor: n(r[11]),
      }),
    ),
  );

const marcacoesDia = (db: Db, ini: string, fim: string) =>
  lembrar(`gestao-dia|${ini}|${fim}`, MIN5, async () =>
    (await rpc(db, "gestao_marcacoes_dia", { p_ini: ini, p_fim: fim })).map(
      (r): LinhaMarcDia => ({ data: s(r[0]), login: s(r[1]), operadora: s(r[2]), n: n(r[3]), atendidas: n(r[4]), valor: n(r[5]) }),
    ),
  );

const perdas = (db: Db, ini: string, fim: string) =>
  lembrar(`gestao-perdas|${ini}|${fim}`, MIN5, async () =>
    (await rpc(db, "gestao_perdas", { p_ini: ini, p_fim: fim })).map(
      (r): LinhaPerda => ({ situacao: s(r[0]), motivo: s(r[1]), login: s(r[2]), procedimento: s(r[3]), profissional: s(r[4]), operadora: s(r[5]), n: n(r[6]) }),
    ),
  );

/** Conferência mensal: R$ do faturamento que ficou ligado a uma marcação ÷ faturamento total. */
export async function coberturaFaturamento(db: Db = criarClienteAdmin(), meses = 6) {
  const desde = `${competenciaAnterior(competenciaDe(hojeNoFuso()), meses - 1)}-01`;
  try {
    const linhas = await lembrar(`gestao-cobertura|${desde}`, 10 * 60_000, () => rpc(db, "gestao_cobertura", { p_desde: desde }));
    return linhas.map((r) => {
      const ligado = n(r[1]);
      const total = n(r[2]);
      return { mes: s(r[0]), ligado, total, pct: total ? (ligado / total) * 100 : null };
    });
  } catch {
    return []; // migração 15 ainda não aplicada: só não mostra
  }
}

/** Todo mundo que marca no Klingo, com nome e equipe (Trackco primeiro; depois o cadastro do sistema relatorio). */
export const pessoasDaClinica = (db: Db) =>
  lembrar("gestao-pessoas", 10 * 60_000, async (): Promise<Pessoa[]> => {
    const hoje = hojeNoFuso();
    const [ku, colabs, usuarios] = await Promise.all([
      db.from("klingo_usuarios").select("login, nome"),
      db.from("colaboradores").select("nome, login_klingo, equipe_membros(funcao, fim, equipes(nome))").not("login_klingo", "is", null),
      db.schema("public").from("usuarios").select("nome, login_klingo, equipe").not("login_klingo", "is", null),
    ]);
    const por = new Map<string, Pessoa>();
    for (const u of ku.data ?? []) {
      const login = s(u.login).toLowerCase();
      por.set(login, { login, nome: titulo(s(u.nome)), equipe: "Sem equipe" });
    }
    for (const u of usuarios.data ?? []) {
      const login = s(u.login_klingo).toLowerCase();
      const eq = s(u.equipe);
      por.set(login, { login, nome: s(u.nome) || por.get(login)?.nome || login, equipe: eq && eq !== "Outros" ? eq : por.get(login)?.equipe ?? "Sem equipe" });
    }
    type Vinc = { funcao: string; fim: string | null; equipes: { nome: string } | null };
    for (const c of (colabs.data ?? []) as unknown as { nome: string; login_klingo: string; equipe_membros: Vinc[] }[]) {
      const login = c.login_klingo.toLowerCase();
      const vig = (c.equipe_membros ?? []).filter((v) => !v.fim || v.fim >= hoje);
      const eq = vig.find((v) => v.funcao === "membro")?.equipes?.nome ?? vig[0]?.equipes?.nome;
      por.set(login, { login, nome: c.nome, equipe: eq ?? por.get(login)?.equipe ?? "Sem equipe" });
    }
    return [...por.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

// ------------------------------------------------------------------ filtros aplicados

function filtroProd(f: FiltrosGestao) {
  return (l: LinhaProd) =>
    (f.operadora === "todas" || grupoOperadora(l.operadora) === f.operadora) &&
    (!f.categoria || l.categoria === f.categoria) &&
    (!f.medico || l.medico === f.medico) &&
    (!f.procedimento || l.procedimento === f.procedimento) &&
    (f.cortesia === "incluir" || (f.cortesia === "so") === ehCortesia(l.procedimento)) &&
    (f.agenda === "todas" || tipoAgenda(l.medico) === f.agenda);
}

function filtroMarc(f: FiltrosGestao, equipeDe: (login: string) => string) {
  return (l: { login: string; operadora: string; procedimento: string; profissional: string }) =>
    (f.operadora === "todas" || grupoOperadora(l.operadora) === f.operadora) &&
    (!f.medico || l.profissional === f.medico) &&
    (!f.procedimento || l.procedimento === f.procedimento) &&
    (f.cortesia === "incluir" || (f.cortesia === "so") === ehCortesia(l.procedimento)) &&
    (f.agenda === "todas" || tipoAgenda(l.profissional) === f.agenda) &&
    (!f.pessoa || l.login === f.pessoa) &&
    (!f.equipe || equipeDe(l.login) === f.equipe);
}

const somaPor = <T>(lista: T[], chave: (x: T) => string, valor: (x: T) => number) => {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
  return m;
};

// ------------------------------------------------------------------ granularidade das séries

export type Grao = "dia" | "semana" | "mes";

function grao(inicio: string, fim: string): Grao {
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1;
  return dias <= 45 ? "dia" : dias <= 190 ? "semana" : "mes";
}

/** Chave do ponto da série: o dia, a segunda-feira da semana ou o mês. */
function pontoDe(data: string, g: Grao): string {
  if (g === "mes") return data.slice(0, 7);
  if (g === "dia") return data;
  const dow = (new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7; // seg = 0
  return somarDias(data, -dow);
}

function pontosEntre(inicio: string, fim: string, g: Grao): string[] {
  return Array.from(new Set(datasEntre(inicio, fim).map((d) => pontoDe(d, g))));
}

function rotuloPonto(p: string, g: Grao): string {
  if (g === "mes") {
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${MES[Number(p.slice(5, 7)) - 1]}/${p.slice(2, 4)}`;
  }
  return `${p.slice(8, 10)}/${p.slice(5, 7)}`;
}

// ------------------------------------------------------------------ aba Faturamento

export type AgruparPor = "categoria" | "medico" | "operadora" | "tabela";

export interface AbaFaturamento {
  atual: ResumoFaturamento;
  base: ResumoFaturamento | null;
  decomposicao: Decomposicao | null;
  porMedico: { ganhos: Variacao[]; quedas: Variacao[] } | null;
  porProcedimento: { ganhos: Variacao[]; quedas: Variacao[] } | null;
  serie: { grao: Grao; series: string[]; pontos: Record<string, string | number>[] };
  sazonal: { anos: string[]; meses: Record<string, { valor: number; porDia: number | null; diasUteis: number }> };
  opcoes: { categorias: string[]; medicos: string[]; procedimentos: string[] };
  /** linhas do período (para exportar) */
  linhas: LinhaProd[];
  semDados: boolean;
}

function grupoDe(l: LinhaProd, por: AgruparPor): string {
  if (por === "categoria") return l.categoria || "Sem categoria";
  if (por === "medico") return titulo(l.medico) || "—";
  if (por === "operadora") return nomeOperadora(l.operadora);
  return tabelaPreco(l.operadora);
}

export async function abaFaturamento(f: FiltrosGestao, por: AgruparPor = "categoria", db: Db = criarClienteAdmin()): Promise<AbaFaturamento> {
  const [todasA, todasB, mensal, feriados] = await Promise.all([
    producao(db, f.janela.inicio, f.janela.fim),
    f.base ? producao(db, f.base.inicio, f.base.fim) : Promise.resolve([] as LinhaProd[]),
    producaoMensal(db),
    lembrar("gestao-feriados", 60 * 60_000, async () => {
      const { data } = await db.from("feriados").select("data");
      return (data ?? []).map((x) => s(x.data));
    }),
  ]);
  const passa = filtroProd(f);
  const a = todasA.filter(passa);
  const b = todasB.filter(passa);
  const atual = resumoFaturamento(a);
  const base = f.base ? resumoFaturamento(b) : null;

  // série empilhada: top 5 grupos + Outros
  const g = grao(f.janela.inicio, f.janela.fim);
  const totalPorGrupo = somaPor(a, (l) => grupoDe(l, por), (l) => l.valor);
  const top = [...totalPorGrupo].sort((x, y) => y[1] - x[1]).map(([k]) => k);
  const series = top.length > 6 ? [...top.slice(0, 5), "Outros"] : top;
  const pontos = pontosEntre(f.janela.inicio, f.janela.fim, g).map((p) => {
    const o: Record<string, string | number> = { ponto: rotuloPonto(p, g), chave: p };
    for (const sr of series) o[sr] = 0;
    return o;
  });
  const idx = new Map(pontos.map((p, i) => [p.chave as string, i]));
  for (const l of a) {
    const i = idx.get(pontoDe(l.data, g));
    if (i === undefined) continue;
    const grupo = grupoDe(l, por);
    const sr = series.includes(grupo) ? grupo : "Outros";
    pontos[i][sr] = Math.round(((pontos[i][sr] as number) + l.valor) * 100) / 100;
  }

  // sazonalidade: todos os meses guardados, mesmos filtros de operadora e categoria
  const fer = new Set(feriados);
  const meses: AbaFaturamento["sazonal"]["meses"] = {};
  for (const m of mensal) {
    if (f.operadora !== "todas" && grupoOperadora(m.operadora) !== f.operadora) continue;
    if (f.categoria && m.categoria !== f.categoria) continue;
    const o = (meses[m.mes] ??= { valor: 0, porDia: null, diasUteis: 0 });
    o.valor += m.valor;
  }
  for (const [mes, o] of Object.entries(meses)) {
    const fim = mes === competenciaDe(f.hoje) ? f.hoje : fimCompetencia(mes);
    o.diasUteis = contarDiasUteis(`${mes}-01`, fim, [1, 2, 3, 4, 5, 6], fer);
    o.porDia = o.diasUteis ? o.valor / o.diasUteis : null;
    o.valor = Math.round(o.valor * 100) / 100;
  }
  const anos = Array.from(new Set(Object.keys(meses).map((m) => m.slice(0, 4)))).sort();

  const ordenar = (lista: string[]) => Array.from(new Set(lista.filter(Boolean))).sort((x, y) => x.localeCompare(y, "pt-BR"));
  return {
    atual,
    base,
    decomposicao: base ? decompor(base, atual) : null,
    porMedico: base ? maioresVariacoes(somaPor(b, (l) => titulo(l.medico), (l) => l.valor), somaPor(a, (l) => titulo(l.medico), (l) => l.valor)) : null,
    porProcedimento: base ? maioresVariacoes(somaPor(b, (l) => l.procedimento, (l) => l.valor), somaPor(a, (l) => l.procedimento, (l) => l.valor)) : null,
    serie: { grao: g, series, pontos },
    sazonal: { anos, meses },
    opcoes: {
      categorias: ordenar(todasA.map((l) => l.categoria)),
      medicos: ordenar(todasA.map((l) => l.medico)),
      procedimentos: ordenar(todasA.map((l) => l.procedimento)),
    },
    linhas: a,
    semDados: !mensal.length,
  };
}

// ------------------------------------------------------------------ aba Marcação → faturamento

export interface LinhaColaborador {
  login: string;
  nome: string;
  equipe: string;
  marcacoes: number;
  verificaveis: number;
  atendidas: number;
  comparecimento: number | null;
  valor: number;
  valorMedio: number | null;
  faixa: Faixa | null;
  /** base de comparação */
  marcacoesBase: number | null;
}

export interface Funil {
  marcadas: number;
  verificaveis: number;
  atendidas: number;
  valor: number;
}

export interface AbaConversao {
  funil: Funil;
  funilBase: Funil | null;
  pessoas: LinhaColaborador[];
  quartis: Quartis | null;
  semProducao: string[];
}

function funilDe(lista: LinhaMarc[], fora: Set<string>): Funil {
  const o: Funil = { marcadas: 0, verificaveis: 0, atendidas: 0, valor: 0 };
  for (const l of lista) {
    o.marcadas += l.n;
    o.valor += l.valor;
    if (fora.has(l.procedimento)) continue;
    o.verificaveis += l.verificaveis;
    o.atendidas += l.atendidas;
  }
  o.valor = Math.round(o.valor * 100) / 100;
  return o;
}

export async function abaConversao(f: FiltrosGestao, db: Db = criarClienteAdmin()): Promise<AbaConversao> {
  const [todasA, todasB, pessoas] = await Promise.all([
    marcacoes(db, f.janela.inicio, f.janela.fim, f.hoje),
    f.base ? marcacoes(db, f.base.inicio, f.base.fim, f.hoje) : Promise.resolve([] as LinhaMarc[]),
    pessoasDaClinica(db),
  ]);
  const quem = new Map(pessoas.map((p) => [p.login, p]));
  const equipeDe = (login: string) => quem.get(login)?.equipe ?? "Sem equipe";
  const passa = filtroMarc(f, equipeDe);
  const a = todasA.filter(passa);
  const b = todasB.filter(passa);
  const fora = procedimentosSemProducao(todasA);

  const por = new Map<string, LinhaColaborador>();
  for (const l of a) {
    const p = quem.get(l.login);
    const o =
      por.get(l.login) ??
      ({
        login: l.login,
        nome: p?.nome ?? (l.login || "Sem responsável"),
        equipe: p?.equipe ?? "Sem equipe",
        marcacoes: 0,
        verificaveis: 0,
        atendidas: 0,
        comparecimento: null,
        valor: 0,
        valorMedio: null,
        faixa: null,
        marcacoesBase: f.base ? 0 : null,
      } satisfies LinhaColaborador);
    o.marcacoes += l.n;
    o.valor += l.valor;
    if (!fora.has(l.procedimento)) {
      o.verificaveis += l.verificaveis;
      o.atendidas += l.atendidas;
    }
    por.set(l.login, o);
  }
  if (f.base) for (const l of b) {
    const o = por.get(l.login);
    if (o) o.marcacoesBase = (o.marcacoesBase ?? 0) + l.n;
  }
  const lista = [...por.values()].filter((p) => p.marcacoes > 0);
  for (const p of lista) {
    p.valor = Math.round(p.valor * 100) / 100;
    p.comparecimento = p.verificaveis ? (p.atendidas / p.verificaveis) * 100 : null;
    p.valorMedio = p.atendidas ? p.valor / p.atendidas : null;
  }
  // quartis só de quem marca de verdade (ignora quem fez uma ou outra marcação avulsa)
  const q = quartis(lista.filter((p) => p.marcacoes >= 10).map((p) => p.marcacoes));
  if (q) for (const p of lista) p.faixa = p.marcacoes >= 10 ? faixaDoQuartil(p.marcacoes, q) : null;
  lista.sort((x, y) => y.valor - x.valor || y.marcacoes - x.marcacoes);
  return { funil: funilDe(a, fora), funilBase: f.base ? funilDe(b, fora) : null, pessoas: lista, quartis: q, semProducao: [...fora].sort() };
}

// ------------------------------------------------------------------ aba Equipes

export interface LinhaEquipe {
  equipe: string;
  pessoas: number;
  marcacoes: number;
  marcacoesBase: number | null;
  atendidas: number;
  valor: number;
  participacao: number;
}

export interface AbaEquipes {
  equipes: LinhaEquipe[];
  /** dia a dia acumulado: período × base, alinhados pelo nº do dia */
  acumulado: { dia: number; rotulo: string; atual: number | null; base: number | null }[];
  /** marcações por equipe ao longo do tempo (até 6 linhas) */
  porEquipe: { grao: Grao; series: string[]; pontos: Record<string, string | number>[] };
  totalAtual: number;
  totalBase: number | null;
}

export async function abaEquipes(f: FiltrosGestao, db: Db = criarClienteAdmin()): Promise<AbaEquipes> {
  const [diasA, diasB, pessoas] = await Promise.all([
    marcacoesDia(db, f.janela.inicio, f.janela.fim),
    f.base ? marcacoesDia(db, f.base.inicio, f.base.fim) : Promise.resolve([] as LinhaMarcDia[]),
    pessoasDaClinica(db),
  ]);
  const quem = new Map(pessoas.map((p) => [p.login, p]));
  const equipeDe = (login: string) => quem.get(login)?.equipe ?? "Sem equipe";
  // aqui equipe/pessoa não filtram: a comparação é entre equipes (procedimento/profissional não existem no dia a dia)
  const passa = (l: LinhaMarcDia) => f.operadora === "todas" || grupoOperadora(l.operadora) === f.operadora;
  const a = diasA.filter(passa);
  const b = diasB.filter(passa);
  const totalAtual = a.reduce((x, l) => x + l.n, 0);
  const totalBase = f.base ? b.reduce((x, l) => x + l.n, 0) : null;

  const eq = new Map<string, LinhaEquipe & { logins: Set<string> }>();
  const linha = (nome: string) => {
    const o = eq.get(nome) ?? { equipe: nome, pessoas: 0, marcacoes: 0, marcacoesBase: f.base ? 0 : null, atendidas: 0, valor: 0, participacao: 0, logins: new Set<string>() };
    eq.set(nome, o);
    return o;
  };
  for (const l of a) {
    const o = linha(equipeDe(l.login));
    o.marcacoes += l.n;
    o.atendidas += l.atendidas;
    o.valor += l.valor;
    o.logins.add(l.login);
  }
  for (const l of b) {
    const o = linha(equipeDe(l.login));
    o.marcacoesBase = (o.marcacoesBase ?? 0) + l.n;
  }
  const equipes = [...eq.values()]
    .map(({ logins, ...o }) => ({ ...o, pessoas: logins.size, valor: Math.round(o.valor * 100) / 100, participacao: totalAtual ? (o.marcacoes / totalAtual) * 100 : 0 }))
    .sort((x, y) => y.marcacoes - x.marcacoes);

  // acumulado dia a dia, alinhado pelo nº do dia (comparação justa: mesmos dias)
  const acum = (lista: LinhaMarcDia[], inicio: string, fim: string) => {
    const por = somaPor(lista, (l) => l.data, (l) => l.n);
    let t = 0;
    return datasEntre(inicio, fim).map((d) => (t += por.get(d) ?? 0));
  };
  const serieA = acum(a, f.janela.inicio, f.janela.fim);
  const serieB = f.base ? acum(b, f.base.inicio, f.base.fim) : [];
  const datasA = datasEntre(f.janela.inicio, f.janela.fim);
  const tam = Math.max(serieA.length, serieB.length);
  const acumulado = Array.from({ length: Math.min(tam, 400) }, (_, i) => ({
    dia: i + 1,
    rotulo: datasA[i] ? `${datasA[i].slice(8, 10)}/${datasA[i].slice(5, 7)}` : `dia ${i + 1}`,
    atual: serieA[i] ?? null,
    base: f.base ? (serieB[i] ?? null) : null,
  }));

  // linhas por equipe (top 6)
  const g = grao(f.janela.inicio, f.janela.fim);
  const series = equipes.slice(0, 6).map((e) => e.equipe);
  const pontos = pontosEntre(f.janela.inicio, f.janela.fim, g).map((p) => {
    const o: Record<string, string | number> = { ponto: rotuloPonto(p, g), chave: p };
    for (const sr of series) o[sr] = 0;
    return o;
  });
  const idx = new Map(pontos.map((p, i) => [p.chave as string, i]));
  for (const l of a) {
    const i = idx.get(pontoDe(l.data, g));
    const e = equipeDe(l.login);
    if (i !== undefined && series.includes(e)) pontos[i][e] = (pontos[i][e] as number) + l.n;
  }
  return { equipes, acumulado, porEquipe: { grao: g, series, pontos }, totalAtual, totalBase };
}

// ------------------------------------------------------------------ aba Quem marca para quem

export interface AbaQuem {
  profissionais: string[];
  linhas: { login: string; nome: string; equipe: string; total: number; celulas: number[] }[];
  totalPorProfissional: number[];
  arvore: {
    login: string;
    nome: string;
    total: number;
    atendidas: number;
    verificaveis: number;
    procedimentos: { procedimento: string; total: number; atendidas: number; verificaveis: number; profissionais: { profissional: string; total: number; atendidas: number }[] }[];
  }[];
}

export async function abaQuem(f: FiltrosGestao, db: Db = criarClienteAdmin()): Promise<AbaQuem> {
  const [todas, pessoas] = await Promise.all([marcacoes(db, f.janela.inicio, f.janela.fim, f.hoje), pessoasDaClinica(db)]);
  const quem = new Map(pessoas.map((p) => [p.login, p]));
  const equipeDe = (login: string) => quem.get(login)?.equipe ?? "Sem equipe";
  const a = todas.filter(filtroMarc(f, equipeDe));
  const fora = procedimentosSemProducao(todas);

  const porProf = somaPor(a, (l) => titulo(l.profissional) || "—", (l) => l.n);
  const topProf = [...porProf].sort((x, y) => y[1] - x[1]).map(([k]) => k);
  const profissionais = topProf.length > 12 ? [...topProf.slice(0, 11), "Outros"] : topProf;
  const col = new Map(profissionais.map((p, i) => [p, i]));

  const linhasM = new Map<string, AbaQuem["linhas"][number]>();
  const arv = new Map<string, AbaQuem["arvore"][number]>();
  for (const l of a) {
    const nome = quem.get(l.login)?.nome ?? (l.login || "Sem responsável");
    const lm = linhasM.get(l.login) ?? { login: l.login, nome, equipe: equipeDe(l.login), total: 0, celulas: profissionais.map(() => 0) };
    const prof = titulo(l.profissional) || "—";
    lm.celulas[col.get(prof) ?? col.get("Outros") ?? 0] += l.n;
    lm.total += l.n;
    linhasM.set(l.login, lm);

    const conta = !fora.has(l.procedimento);
    const ar = arv.get(l.login) ?? { login: l.login, nome, total: 0, atendidas: 0, verificaveis: 0, procedimentos: [] };
    ar.total += l.n;
    if (conta) {
      ar.atendidas += l.atendidas;
      ar.verificaveis += l.verificaveis;
    }
    let pr = ar.procedimentos.find((x) => x.procedimento === l.procedimento);
    if (!pr) ar.procedimentos.push((pr = { procedimento: l.procedimento || "—", total: 0, atendidas: 0, verificaveis: 0, profissionais: [] }));
    pr.total += l.n;
    if (conta) {
      pr.atendidas += l.atendidas;
      pr.verificaveis += l.verificaveis;
    }
    let pf = pr.profissionais.find((x) => x.profissional === prof);
    if (!pf) pr.profissionais.push((pf = { profissional: prof, total: 0, atendidas: 0 }));
    pf.total += l.n;
    pf.atendidas += l.atendidas;
    arv.set(l.login, ar);
  }
  const linhas = [...linhasM.values()].sort((x, y) => y.total - x.total);
  const arvore = [...arv.values()].sort((x, y) => y.total - x.total);
  for (const ar of arvore) {
    ar.procedimentos.sort((x, y) => y.total - x.total);
    for (const pr of ar.procedimentos) pr.profissionais.sort((x, y) => y.total - x.total);
  }
  return { profissionais, linhas, totalPorProfissional: profissionais.map((_, i) => linhas.reduce((t, l) => t + l.celulas[i], 0)), arvore };
}

// ------------------------------------------------------------------ aba Perdas

export interface AbaPerdas {
  totais: { faltas: number; canceladas: number; remarcadas: number };
  totaisBase: { faltas: number; canceladas: number; remarcadas: number } | null;
  porMotivo: { motivo: string; situacao: string; n: number }[];
  porProfissional: { rotulo: string; faltas: number; canceladas: number; remarcadas: number }[];
  porProcedimento: { rotulo: string; faltas: number; canceladas: number; remarcadas: number }[];
  porPessoa: { rotulo: string; faltas: number; canceladas: number; remarcadas: number }[];
  mixMarcacoes: { grupo: string; operadora: string; n: number }[];
  mixFaturamento: { grupo: string; operadora: string; valor: number }[];
}

const tipoPerda = (sit: string): "faltas" | "canceladas" | "remarcadas" =>
  sit === "cancelada" ? "canceladas" : sit === "remarcada" || sit === "falta_remarcada" ? "remarcadas" : "faltas";

export async function abaPerdas(f: FiltrosGestao, db: Db = criarClienteAdmin()): Promise<AbaPerdas> {
  // o mix de operadoras mostra todas, de propósito
  const semOperadora = { ...f, operadora: "todas" as const };
  const [pA, pB, marc, prod, pessoas] = await Promise.all([
    perdas(db, f.janela.inicio, f.janela.fim),
    f.base ? perdas(db, f.base.inicio, f.base.fim) : Promise.resolve([] as LinhaPerda[]),
    marcacoes(db, f.janela.inicio, f.janela.fim, f.hoje),
    producao(db, f.janela.inicio, f.janela.fim),
    pessoasDaClinica(db),
  ]);
  const quem = new Map(pessoas.map((p) => [p.login, p]));
  const equipeDe = (login: string) => quem.get(login)?.equipe ?? "Sem equipe";
  const passa = filtroMarc(f, equipeDe);
  const a = pA.filter(passa);
  const b = pB.filter(passa);
  const totais = (lista: LinhaPerda[]) => {
    const o = { faltas: 0, canceladas: 0, remarcadas: 0 };
    for (const l of lista) o[tipoPerda(l.situacao)] += l.n;
    return o;
  };
  const quebra = (chave: (l: LinhaPerda) => string) => {
    const m = new Map<string, { rotulo: string; faltas: number; canceladas: number; remarcadas: number }>();
    for (const l of a) {
      const k = chave(l) || "—";
      const o = m.get(k) ?? { rotulo: k, faltas: 0, canceladas: 0, remarcadas: 0 };
      o[tipoPerda(l.situacao)] += l.n;
      m.set(k, o);
    }
    return [...m.values()].sort((x, y) => y.faltas + y.canceladas - (x.faltas + x.canceladas)).slice(0, 15);
  };
  const motivos = new Map<string, { motivo: string; situacao: string; n: number }>();
  for (const l of a) {
    if (l.situacao === "remarcada" || l.situacao === "falta_remarcada") continue;
    const motivo = l.motivo || (l.situacao === "cancelada" ? "Cancelada sem motivo registrado" : "Faltou (sem motivo)");
    const k = `${l.situacao === "cancelada" ? "c" : "f"}|${motivo.toUpperCase()}`;
    const o = motivos.get(k) ?? { motivo, situacao: l.situacao === "cancelada" ? "cancelada" : "falta", n: 0 };
    o.n += l.n;
    motivos.set(k, o);
  }
  const passaMix = filtroMarc(semOperadora, equipeDe);
  const mixM = somaPor(marc.filter(passaMix), (l) => `${grupoOperadora(l.operadora)}|${nomeOperadora(l.operadora)}`, (l) => l.n);
  const passaProd = filtroProd(semOperadora);
  const mixF = somaPor(prod.filter(passaProd), (l) => `${grupoOperadora(l.operadora)}|${nomeOperadora(l.operadora)}`, (l) => l.valor);
  return {
    totais: totais(a),
    totaisBase: f.base ? totais(b) : null,
    porMotivo: [...motivos.values()].sort((x, y) => y.n - x.n).slice(0, 20),
    porProfissional: quebra((l) => titulo(l.profissional)),
    porProcedimento: quebra((l) => l.procedimento),
    porPessoa: quebra((l) => quem.get(l.login)?.nome ?? l.login),
    mixMarcacoes: [...mixM].map(([k, v]) => ({ grupo: k.split("|")[0], operadora: k.split("|")[1], n: v })).sort((x, y) => y.n - x.n),
    mixFaturamento: [...mixF]
      .map(([k, v]) => ({ grupo: k.split("|")[0], operadora: k.split("|")[1], valor: Math.round(v * 100) / 100 }))
      .sort((x, y) => y.valor - x.valor),
  };
}

/** Equipes que aparecem nos filtros. */
export async function opcoesDePessoas(db: Db = criarClienteAdmin()) {
  const pessoas = await pessoasDaClinica(db);
  const equipes = Array.from(new Set(pessoas.map((p) => p.equipe))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { pessoas, equipes };
}


/** Opções dos filtros: equipes e pessoas da clínica; categorias, médicos e procedimentos que aparecem no período. */
export async function opcoesDosFiltros(f: FiltrosGestao, db: Db = criarClienteAdmin()) {
  const [pessoas, prod, marc] = await Promise.all([
    pessoasDaClinica(db),
    producao(db, f.janela.inicio, f.janela.fim).catch(() => [] as LinhaProd[]),
    marcacoes(db, f.janela.inicio, f.janela.fim, f.hoje).catch(() => [] as LinhaMarc[]),
  ]);
  const ordenar = (lista: string[]) => Array.from(new Set(lista.filter(Boolean))).sort((x, y) => x.localeCompare(y, "pt-BR"));
  const comMarcacao = new Set(marc.map((m) => m.login));
  return {
    equipes: ordenar(pessoas.filter((p) => comMarcacao.has(p.login)).map((p) => p.equipe)),
    pessoas: pessoas.filter((p) => comMarcacao.has(p.login) && (!f.equipe || p.equipe === f.equipe)),
    categorias: ordenar(prod.map((l) => l.categoria)),
    medicos: ordenar([...prod.map((l) => l.medico), ...marc.map((l) => l.profissional)]),
    procedimentos: ordenar([...prod.map((l) => l.procedimento), ...marc.map((l) => l.procedimento)]),
  };
}

/** Base para o Excel/Power BI: marcações do período somadas por mês × pessoa × procedimento × profissional × operadora. */
export async function baseMarcacoes(f: FiltrosGestao, db: Db = criarClienteAdmin()) {
  const [todas, pessoas] = await Promise.all([marcacoes(db, f.janela.inicio, f.janela.fim, f.hoje), pessoasDaClinica(db)]);
  const quem = new Map(pessoas.map((p) => [p.login, p]));
  const equipeDe = (login: string) => quem.get(login)?.equipe ?? "Sem equipe";
  return todas.filter(filtroMarc(f, equipeDe)).map((l) => ({
    ...l,
    nome: quem.get(l.login)?.nome ?? (l.login || "Sem responsável"),
    equipe: equipeDe(l.login),
    tipoAgenda: tipoAgenda(l.profissional) === "exame" ? "Agenda de exame" : "Médico",
    cortesia: ehCortesia(l.procedimento),
    grupoOperadora: grupoOperadora(l.operadora),
  }));
}
