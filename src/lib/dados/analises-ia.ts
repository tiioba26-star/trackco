import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ARQUIVO_GERAL,
  ARQUIVO_STATUS,
  lerArquivo,
  nomeArquivo,
  todosOsArquivos,
  type ComparacaoIA,
  type Meta,
  type PeriodoIA,
  type RecorteIA,
  type SecaoIA,
  type StatusAnalises,
} from "@/lib/analises/arquivos";

// Lê as análises da IA publicadas no repositório (pasta analises/gestao, levada no deploy por outputFileTracingIncludes).
// Só nomes de uma lista fixa: nada vindo da URL vira caminho de arquivo.

const PERMITIDOS = new Set([...todosOsArquivos(), ARQUIVO_STATUS]);

async function ler(nome: string): Promise<string | null> {
  if (!PERMITIDOS.has(nome)) return null;
  try {
    // caminho escrito por extenso (igual a PASTA_ANALISES): assim o deploy leva só esta pasta, não o projeto todo
    return await readFile(join(process.cwd(), "analises", "gestao", nome), "utf8");
  } catch {
    return null;
  }
}

export interface Analise {
  meta: Meta;
  corpo: string;
}

export async function analiseDaSecao(secao: SecaoIA, periodo: PeriodoIA, comparacao: ComparacaoIA, recorte: RecorteIA): Promise<Analise | null> {
  const t = await ler(nomeArquivo(secao, periodo, comparacao, recorte));
  return t ? lerArquivo(t) : null;
}

export async function analiseGeral(): Promise<Analise | null> {
  const t = await ler(ARQUIVO_GERAL);
  return t ? lerArquivo(t) : null;
}

export async function statusDasAnalises(): Promise<StatusAnalises | null> {
  const t = await ler(ARQUIVO_STATUS);
  if (!t) return null;
  try {
    return JSON.parse(t) as StatusAnalises;
  } catch {
    return null;
  }
}

/** "claude-sonnet-5-5" → "Sonnet 5.5". */
export function nomeDoModelo(id: string | undefined): string {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id ?? "");
  if (!m) return id ?? "";
  return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}

export const NOME_ESFORCO: Record<string, string> = { low: "baixo", medium: "médio", high: "alto", xhigh: "muito alto", max: "máximo" };
