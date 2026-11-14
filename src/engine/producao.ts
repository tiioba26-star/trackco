// "Produção" de cada atendente num período: responde às perguntas do dia a dia da gestão.
//  - Quanto cada uma AGENDOU no período (pelo dia em que marcou)?
//  - Quanto disso foi remarcação (o mesmo paciente marcado de novo)?
//  - Quantas consultas estavam MARCADAS PARA o período (pelo dia da consulta)?
//  - Dessas, quantas aconteceram, quantas faltaram, quantas desmarcaram sem remarcar?
import { passaFiltros } from "./metricas";
import type { Filtro, Linha, Metrica } from "./tipos";

export type Categoria = "particular" | "sus";

/** Situações que não são "culpa" de quem marcou: saem da base (mesma regra da taxa de comparecimento). */
export const SITUACOES_FORA_PADRAO = ["remarcada", "falta_remarcada", "bloqueio_clinica", "erro"];
const REMARCACAO = new Set(["remarcada", "falta_remarcada"]);
const FALTA = new Set(["nao_realizada", "falta"]);

export interface RegrasProducao {
  /** filtros da categoria (ex.: operadora = Particular) */
  base: Filtro[];
  /** situações fora da base */
  fora: string[];
}

/**
 * Regras a partir das métricas cadastradas: os filtros de convênio vêm da métrica de agendamentos
 * da categoria; a lista do que fica fora vem da taxa de comparecimento (ou o padrão).
 */
export function regrasProducao(agendamentos: Metrica | null, conversao: Metrica | null): RegrasProducao | null {
  if (!agendamentos || agendamentos.definicao.tipo_calculo !== "simples") return null;
  const base = (agendamentos.definicao.filtros ?? []).filter((f) => f.campo !== "situacao" && f.campo !== "atendido");
  let fora = SITUACOES_FORA_PADRAO;
  if (conversao?.definicao.tipo_calculo === "taxa") {
    const f = conversao.definicao.denominador.filtros.find((x) => x.campo === "situacao" && x.op === "nao_em");
    if (f) fora = Array.isArray(f.valor) ? f.valor : String(f.valor ?? "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  }
  return { base, fora };
}

export interface Producao {
  /** marcações feitas no período (pelo dia em que a pessoa marcou), qualquer data de consulta */
  agendou: number;
  /** das marcações feitas, quantas foram depois remarcadas (o paciente ganhou outra marcação) */
  agendouRemarcadas: number;
  /** das marcações feitas, bloqueios da clínica e erros de cadastro */
  agendouOutras: number;
  /** agendou − remarcadas − bloqueios/erros: a marcação remarcada sai, fica só a nova */
  agendouValidos: number;
  /** consultas marcadas PARA os dias do período (pelo dia da consulta), já sem remarcadas/bloqueios/erros */
  marcadasPara: number;
  compareceram: number;
  faltaram: number;
  /** desmarcou e não remarcou */
  desmarcaram: number;
  /** consulta de hoje ou futura, ainda sem desfecho */
  aguardando: number;
  /** consultas do período que foram remarcadas para outra data (ficam fora da conta) */
  remarcadasPara: number;
  /** só os dias que já terminaram: base justa da taxa */
  encerradasMarcadas: number;
  encerradasCompareceram: number;
  /** compareceram ÷ marcadas, só em dias encerrados (null se nenhum dia encerrado) */
  conversao: number | null;
}

export function producaoVazia(): Producao {
  return {
    agendou: 0,
    agendouRemarcadas: 0,
    agendouOutras: 0,
    agendouValidos: 0,
    marcadasPara: 0,
    compareceram: 0,
    faltaram: 0,
    desmarcaram: 0,
    aguardando: 0,
    remarcadasPara: 0,
    encerradasMarcadas: 0,
    encerradasCompareceram: 0,
    conversao: null,
  };
}

const dia = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);

function fechar(p: Producao): Producao {
  p.agendouValidos = p.agendou - p.agendouRemarcadas - p.agendouOutras;
  p.conversao = p.encerradasMarcadas > 0 ? Math.round((p.encerradasCompareceram / p.encerradasMarcadas) * 1000) / 10 : null;
  return p;
}

/**
 * Produção por colaborador (chave = colaborador_id; linhas sem dono ficam em "").
 * `janela` vale para o que a pessoa agendou; `janelaPara` (padrão = a mesma) para as consultas marcadas
 * para o período: no mês corrente pode ir até o fim do mês, mostrando o que ainda vai acontecer.
 */
export function contarProducao(
  linhas: Linha[],
  regras: RegrasProducao,
  janela: { inicio: string; fim: string },
  hoje: string,
  janelaPara: { inicio: string; fim: string } = janela,
): Map<string, Producao> {
  const fora = new Set(regras.fora);
  const out = new Map<string, Producao>();
  const de = (id: string) => {
    let p = out.get(id);
    if (!p) out.set(id, (p = producaoVazia()));
    return p;
  };
  for (const l of linhas) {
    if (!passaFiltros(l, regras.base)) continue;
    const situacao = typeof l.situacao === "string" ? l.situacao : null;
    const p = de(l.colaborador_id ?? "");

    const em = dia(l.data_agendado_em);
    if (em && em >= janela.inicio && em <= janela.fim) {
      p.agendou++;
      if (situacao && REMARCACAO.has(situacao)) p.agendouRemarcadas++;
      else if (situacao && fora.has(situacao)) p.agendouOutras++;
    }

    const para = dia(l.data_agendado_para);
    if (para && para >= janelaPara.inicio && para <= janelaPara.fim) {
      if (situacao && fora.has(situacao)) {
        if (REMARCACAO.has(situacao)) p.remarcadasPara++;
        continue;
      }
      p.marcadasPara++;
      const veio = l.atendido === true;
      if (veio) p.compareceram++;
      else if (situacao === "cancelada") p.desmarcaram++;
      else if (situacao && FALTA.has(situacao)) p.faltaram++;
      else p.aguardando++;
      if (para < hoje) {
        p.encerradasMarcadas++;
        if (veio) p.encerradasCompareceram++;
      }
    }
  }
  for (const p of out.values()) fechar(p);
  return out;
}

export function somarProducao(lista: Producao[]): Producao {
  const t = producaoVazia();
  for (const p of lista) {
    for (const k of Object.keys(t) as (keyof Producao)[]) {
      if (k === "conversao") continue;
      t[k] = (t[k] as number) + (p[k] as number);
    }
  }
  return fechar(t);
}

export interface PontoDia {
  dia: string;
  agendou: number;
  validos: number;
  marcadas: number;
  compareceram: number;
  futuro: boolean;
}

/** Série dia a dia para as pessoas: quanto agendaram e, das consultas de cada dia, quantas aconteceram. */
export function producaoPorDia(
  linhas: Linha[],
  regras: RegrasProducao,
  pessoas: string[],
  dias: string[],
  hoje: string,
): PontoDia[] {
  const quem = new Set(pessoas);
  const minhas = linhas.filter((l) => l.colaborador_id && quem.has(l.colaborador_id));
  return dias.map((d) => {
    const t = somarProducao(Array.from(contarProducao(minhas, regras, { inicio: d, fim: d }, hoje).values()));
    return { dia: d, agendou: d > hoje ? 0 : t.agendou, validos: d > hoje ? 0 : t.agendouValidos, marcadas: t.marcadasPara, compareceram: t.compareceram, futuro: d > hoje };
  });
}
