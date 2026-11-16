// Como a Gestão separa as linhas do Klingo (mesmas regras do antigo sistema "relatorio").

/** Palavras que indicam que o "profissional" é uma agenda de exame/sala, e não um médico. */
const PALAVRAS_AGENDA = [
  "CURVA TENSIONAL",
  "TOMOGRAFIA",
  "CAMPO VISUAL",
  "RETINOGRAFIA",
  "GLAUCOMA",
  "BIOMETRIA",
  "MICROSCOPIA",
  "COLIRIO",
  "ULTRASSON",
  "EXAME",
  "MAPEAMENTO",
  "SALA",
  "AGENDA",
  "CATARATA",
  "TOTEM",
  "CIRURGIC",
];

const semAcento = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

export type TipoAgenda = "medico" | "exame";

/** "exame" quando o nome do profissional é de uma agenda de exame/sala (ex.: "AGENDA TOMOGRAFIA"). */
export function tipoAgenda(profissional: string): TipoAgenda {
  const n = semAcento(profissional);
  return PALAVRAS_AGENDA.some((p) => n.includes(p)) ? "exame" : "medico";
}

export function ehCortesia(procedimento: string): boolean {
  return semAcento(procedimento).includes("CORTESIA");
}

export type GrupoOperadora = "Particular" | "SUS" | "Convênios";
export const GRUPOS_OPERADORA: GrupoOperadora[] = ["Particular", "SUS", "Convênios"];

/**
 * O 2331 traz "Particular"/"SUS"/nome do convênio; o 319 traz "Particular - PARTICULAR", "SUS - SUS",
 * "Particular - M. M. VASCONCELOS"... (a parte depois do " - " é a tabela de preço).
 */
export function grupoOperadora(operadora: string): GrupoOperadora {
  const n = semAcento(operadora).trim();
  if (n.startsWith("PARTIC")) return "Particular";
  if (n === "SUS" || n.startsWith("SUS ") || n.startsWith("SUS-")) return "SUS";
  return "Convênios";
}

/** Nome da operadora sem a tabela: "Particular - PARTICULAR" → "Particular". */
export function nomeOperadora(operadora: string): string {
  const [nome] = operadora.split(" - ");
  return (nome ?? "").trim() || "—";
}

/** Tabela de preço do 319: "Particular - M. M. VASCONCELOS" → "M. M. VASCONCELOS". */
export function tabelaPreco(operadora: string): string {
  const i = operadora.indexOf(" - ");
  return i < 0 ? operadora.trim() || "—" : operadora.slice(i + 3).trim() || "—";
}

/** Nome em formato de título: "ANDRÉ BORN DE SOUZA" → "André Born de Souza". */
export function titulo(s: string): string {
  const PEQUENAS = new Set(["de", "da", "do", "das", "dos", "e"]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && PEQUENAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export interface ContagemProcedimento {
  procedimento: string;
  verificaveis: number;
  atendidas: number;
}

/**
 * Procedimentos que quase nunca entram no faturamento (cortesias, entregas, retornos): menos de 10% das marcações
 * conferíveis viram atendimento. Para eles não dá para saber se o paciente veio, então ficam fora da taxa.
 */
export function procedimentosSemProducao(lista: ContagemProcedimento[], taxaMinima = 0.1, minimo = 5): Set<string> {
  const por = new Map<string, { v: number; a: number }>();
  for (const l of lista) {
    const o = por.get(l.procedimento) ?? { v: 0, a: 0 };
    o.v += l.verificaveis;
    o.a += l.atendidas;
    por.set(l.procedimento, o);
  }
  return new Set([...por].filter(([, o]) => o.v >= minimo && o.a / o.v < taxaMinima).map(([p]) => p));
}
