// Análises da IA da Gestão: nomes de arquivo, cabeçalho e conferência do texto.
// Puro (sem servidor): usado pela tela, pelo executor da rotina das 5h e pelos testes.

export const SECOES_IA = ["faturamento", "marcacao", "equipes", "quem", "perdas"] as const;
export type SecaoIA = (typeof SECOES_IA)[number];
export const PERIODOS_IA = ["mes", "mes_passado", "3m", "ano", "12m"] as const;
export type PeriodoIA = (typeof PERIODOS_IA)[number];
export const COMPARACOES_IA = ["anterior", "ano"] as const;
export type ComparacaoIA = (typeof COMPARACOES_IA)[number];
export const RECORTES_IA = ["particular", "todas"] as const;
export type RecorteIA = (typeof RECORTES_IA)[number];

export const NOME_SECAO: Record<SecaoIA, string> = {
  faturamento: "Faturamento",
  marcacao: "Marcação → R$",
  equipes: "Equipes",
  quem: "Quem marca para quem",
  perdas: "Perdas e operadoras",
};
export const NOME_RECORTE: Record<RecorteIA, string> = { particular: "Particular", todas: "Clínica toda (todas as operadoras)" };

/** Aba da tela → seção da análise. */
export const SECAO_DA_ABA: Record<string, SecaoIA> = {
  faturamento: "faturamento",
  conversao: "marcacao",
  equipes: "equipes",
  quem: "quem",
  perdas: "perdas",
};

export const PASTA_ANALISES = "analises/gestao";
export const ARQUIVO_GERAL = "geral.md";
export const ARQUIVO_STATUS = "_status.json";

export function nomeArquivo(secao: SecaoIA, periodo: PeriodoIA, comparacao: ComparacaoIA, recorte: RecorteIA): string {
  return `${secao}__${periodo}__${comparacao}__${recorte}.md`;
}

/** Os 101 arquivos que a rotina mantém (100 por seção + a geral). */
export function todosOsArquivos(): string[] {
  const out: string[] = [];
  for (const s of SECOES_IA) for (const p of PERIODOS_IA) for (const c of COMPARACOES_IA) for (const r of RECORTES_IA) out.push(nomeArquivo(s, p, c, r));
  return [...out, ARQUIVO_GERAL];
}

// ------------------------------------------------------------------ cabeçalho (frontmatter simples "chave: valor")

export type Meta = Record<string, string>;

export function montarArquivo(meta: Record<string, string | number | null | undefined>, corpo: string): string {
  const linhas = Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${String(v).replace(/[\r\n]+/g, " ")}`);
  return `---\n${linhas.join("\n")}\n---\n\n${corpo.trim()}\n`;
}

export function lerArquivo(texto: string): { meta: Meta; corpo: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { meta: {}, corpo: texto.trim() };
  const meta: Meta = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const i = linha.indexOf(":");
    if (i > 0) meta[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  return { meta, corpo: texto.slice(m[0].length).trim() };
}

// ------------------------------------------------------------------ conferência do texto da IA

export const SECOES_DA_ANALISE = ["## Resumo", "## O que os números mostram", "## Pontos de atenção", "## O que fazer", "## Dados usados"];
export const SECOES_DA_GERAL = ["## Resumo", "## O que mudou", "## Pessoas", "## Operação e dados", "## Plano de ação", "## Evidências"];

/** Tira cercas de código e espaços que alguns modelos põem em volta do Markdown. */
export function limparTexto(texto: string): string {
  let t = texto.trim();
  const cerca = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/.exec(t);
  if (cerca) t = cerca[1].trim();
  return t;
}

const palavras = (t: string) => t.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

/** Problemas do texto (lista vazia = aprovado). Tolerante no tamanho: o prompt pede 250–500 e 700–1.300 palavras. */
export function conferirAnalise(texto: string, tipo: "secao" | "geral"): string[] {
  const t = limparTexto(texto);
  const problemas: string[] = [];
  const secoes = tipo === "geral" ? SECOES_DA_GERAL : SECOES_DA_ANALISE;
  if (!t.startsWith("## Resumo")) problemas.push('o texto deve começar em "## Resumo"');
  let pos = -1;
  for (const s of secoes) {
    const i = t.indexOf(s, pos + 1);
    if (i < 0) problemas.push(`falta a seção "${s}"`);
    else if (i < pos) problemas.push(`a seção "${s}" está fora de ordem`);
    else pos = i;
  }
  const n = palavras(t);
  const [min, max] = tipo === "geral" ? [450, 1800] : [170, 750];
  if (n < min) problemas.push(`texto curto demais (${n} palavras)`);
  if (n > max) problemas.push(`texto longo demais (${n} palavras)`);
  if (/\{\{|\}\}|undefined|NaN/.test(t)) problemas.push("sobrou marcador ou valor inválido (undefined, NaN, {{ }})");
  return problemas;
}

// ------------------------------------------------------------------ situação da última rodada

export interface StatusAnalises {
  gerado_em: string;
  dados_ate: string;
  feitas: number;
  sem_mudanca: number;
  falhas: { arquivo: string; erro: string }[];
  pendentes: string[];
  tokens: { entrada: number; saida: number; pensamento: number; cache: number };
  custo_equivalente_usd: number;
  por_modelo: Record<string, { analises: number; custo_equivalente_usd: number }>;
  limite_atingido: boolean;
}

/** O trecho de uma seção do texto (do título até o próximo "## "). */
export function trechoDaSecao(corpo: string, titulo: string): string {
  const i = corpo.indexOf(titulo);
  if (i < 0) return "";
  const resto = corpo.slice(i + titulo.length);
  const j = resto.search(/\n## /);
  return (j < 0 ? resto : resto.slice(0, j)).trim();
}
