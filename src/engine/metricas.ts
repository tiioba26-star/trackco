import { somarDias } from "./datas";
import type { Contagem, Corte, DefinicaoMetrica, Filtro, Linha } from "./tipos";

export interface Janela {
  inicio: string;
  fim: string;
}

function normalizar(v: unknown): string {
  return String(v ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function lista(v: Filtro["valor"]): string[] {
  if (Array.isArray(v)) return v.map(normalizar);
  if (v == null) return [];
  return String(v)
    .split(/[;,]/)
    .map(normalizar)
    .filter(Boolean);
}

export function passaFiltro(linha: Linha, f: Filtro): boolean {
  const bruto = linha[f.campo];
  const vazio = bruto === null || bruto === undefined || bruto === "";
  switch (f.op) {
    case "preenchido":
      return !vazio;
    case "vazio":
      return vazio;
    case "verdadeiro":
      return bruto === true || bruto === "S" || bruto === "true";
    case "falso":
      return bruto === false || bruto === "N" || bruto === "false";
    case "igual":
      return normalizar(bruto) === normalizar(Array.isArray(f.valor) ? f.valor[0] : f.valor);
    case "diferente":
      return normalizar(bruto) !== normalizar(Array.isArray(f.valor) ? f.valor[0] : f.valor);
    case "em":
      return lista(f.valor).includes(normalizar(bruto));
    case "nao_em":
      return !lista(f.valor).includes(normalizar(bruto));
    case "contem": {
      const alvo = normalizar(Array.isArray(f.valor) ? f.valor[0] : f.valor);
      return alvo === "" || normalizar(bruto).includes(alvo);
    }
    default:
      return true;
  }
}

export function passaFiltros(linha: Linha, filtros: Filtro[]): boolean {
  return filtros.every((f) => passaFiltro(linha, f));
}

/** Janela efetiva da competência considerando o corte (hoje/ontem) quando o mês está em curso. */
export function janelaEfetiva(
  janelaCompetencia: Janela,
  hoje: string,
  corte: Corte = "hoje",
): Janela | null {
  const limite = corte === "ontem" ? somarDias(hoje, -1) : hoje;
  const fim = janelaCompetencia.fim < limite ? janelaCompetencia.fim : limite;
  if (fim < janelaCompetencia.inicio) return null;
  return { inicio: janelaCompetencia.inicio, fim };
}

export interface Acumulado {
  valor: number;
  chaves: string[];
}

/** Agrega uma contagem por colaborador. Linhas sem colaborador ficam na chave "" (não atribuídas). */
export function avaliarContagem(
  c: Contagem,
  linhas: Linha[],
  janela: Janela | null,
): Map<string, Acumulado> {
  const out = new Map<string, Acumulado>();
  if (!janela) return out;
  for (const l of linhas) {
    const d = l[c.campo_data];
    if (typeof d !== "string" || !d) continue;
    const dia = d.slice(0, 10);
    if (dia < janela.inicio || dia > janela.fim) continue;
    if (!passaFiltros(l, c.filtros ?? [])) continue;
    const k = l.colaborador_id ?? "";
    let acc = out.get(k);
    if (!acc) {
      acc = { valor: 0, chaves: [] };
      out.set(k, acc);
    }
    if (c.agregacao === "somar") {
      const n = Number(l[c.campo_valor ?? "qtd"] ?? 0);
      acc.valor += Number.isFinite(n) ? n : 0;
    } else {
      acc.valor += 1;
    }
    acc.chaves.push(l.chave);
  }
  return out;
}

export interface ValorMetrica {
  valor: number;
  numerador?: number;
  denominador?: number;
  itens: { chave: string; papel: "realizado" | "numerador" | "denominador" }[];
}

/** Soma acumulados de vários colaboradores (escopo equipe). */
function somarAcumulados(mapa: Map<string, Acumulado>, ids: string[]): Acumulado {
  const out: Acumulado = { valor: 0, chaves: [] };
  for (const id of ids) {
    const a = mapa.get(id);
    if (!a) continue;
    out.valor += a.valor;
    out.chaves.push(...a.chaves);
  }
  return out;
}

export function arred(n: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

/**
 * Calcula o valor de uma métrica para um conjunto de colaboradores (1 = individual; vários = equipe).
 * Taxa = soma dos numeradores / soma dos denominadores × 100.
 */
export function calcularMetrica(
  def: DefinicaoMetrica,
  linhasPorFonte: (fonte: Contagem["fonte"]) => Linha[],
  janelaCompetencia: Janela,
  hoje: string,
  colaboradores: string[],
): ValorMetrica {
  const janela = janelaEfetiva(janelaCompetencia, hoje, def.corte ?? "hoje");
  if (def.tipo_calculo === "taxa") {
    const num = somarAcumulados(
      avaliarContagem(def.numerador, linhasPorFonte(def.numerador.fonte), janela),
      colaboradores,
    );
    const den = somarAcumulados(
      avaliarContagem(def.denominador, linhasPorFonte(def.denominador.fonte), janela),
      colaboradores,
    );
    const valor = den.valor > 0 ? arred((num.valor / den.valor) * 100, 2) : 0;
    return {
      valor,
      numerador: num.valor,
      denominador: den.valor,
      itens: [
        ...num.chaves.map((chave) => ({ chave, papel: "numerador" as const })),
        ...den.chaves.map((chave) => ({ chave, papel: "denominador" as const })),
      ],
    };
  }
  const acc = somarAcumulados(avaliarContagem(def, linhasPorFonte(def.fonte), janela), colaboradores);
  return {
    valor: arred(acc.valor, 2),
    itens: acc.chaves.map((chave) => ({ chave, papel: "realizado" as const })),
  };
}

/** Descreve a métrica em português (usado no memorial e na tela de métricas). */
export function descreverContagem(c: Contagem, rotuloCampo: (campo: string) => string): string {
  const base =
    c.agregacao === "somar"
      ? `soma de ${rotuloCampo(c.campo_valor ?? "qtd")}`
      : "quantidade de registros";
  const filtros = (c.filtros ?? [])
    .map((f) => {
      const v = Array.isArray(f.valor) ? f.valor.join(", ") : f.valor;
      switch (f.op) {
        case "verdadeiro":
          return `${rotuloCampo(f.campo)} = sim`;
        case "falso":
          return `${rotuloCampo(f.campo)} = não`;
        case "preenchido":
          return `${rotuloCampo(f.campo)} preenchido`;
        case "vazio":
          return `${rotuloCampo(f.campo)} vazio`;
        case "em":
          return `${rotuloCampo(f.campo)} ∈ {${v}}`;
        case "nao_em":
          return `${rotuloCampo(f.campo)} ∉ {${v}}`;
        case "diferente":
          return `${rotuloCampo(f.campo)} ≠ ${v}`;
        case "contem":
          return `${rotuloCampo(f.campo)} contém "${v}"`;
        default:
          return `${rotuloCampo(f.campo)} = ${v}`;
      }
    })
    .join(" e ");
  return `${base} por ${rotuloCampo(c.campo_data)}${filtros ? `, onde ${filtros}` : ""}`;
}
