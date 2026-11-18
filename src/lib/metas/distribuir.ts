// Meta da equipe repartida entre os membros pela participação de cada um nos últimos meses.
// Usado na tela (para mostrar e salvar) e na ação de salvar (para recusar grade incoerente).

export type ModoMeta = "equipe" | "pessoa";

/**
 * Parte de cada pessoa numa meta de contagem: `total × peso / Σpesos`, em inteiros que somam exatamente `total`
 * (maiores restos). Sem histórico nenhum, divide igual. Taxas (%) não se dividem: cada pessoa fica com a da equipe.
 */
export function distribuirMeta(
  total: number,
  pesos: { id: string; peso: number | null }[],
  unidade: string,
): Record<string, number> {
  if (!pesos.length) return {};
  if (unidade === "%") return Object.fromEntries(pesos.map((p) => [p.id, total]));
  const ps = pesos.map((p) => ({ id: p.id, peso: p.peso !== null && p.peso > 0 ? p.peso : 0 }));
  const soma = ps.reduce((s, p) => s + p.peso, 0);
  const base = soma > 0 ? ps : ps.map((p) => ({ ...p, peso: 1 }));
  const somaBase = soma > 0 ? soma : ps.length;
  const inteiro = Math.round(total);
  const brutos = base.map((p) => ({ id: p.id, v: (inteiro * p.peso) / somaBase }));
  const out = Object.fromEntries(brutos.map((b) => [b.id, Math.floor(b.v)]));
  let falta = inteiro - Object.values(out).reduce((s, v) => s + v, 0);
  // empate no resto: quem tem mais peso primeiro, depois a ordem recebida (estável)
  const ordem = brutos
    .map((b, i) => ({ ...b, resto: b.v - Math.floor(b.v), i }))
    .sort((a, b) => b.resto - a.resto || b.v - a.v || a.i - b.i);
  for (const b of ordem) {
    if (falta <= 0) break;
    out[b.id] += 1;
    falta -= 1;
  }
  return out;
}

/** Participação (0–1) de cada pessoa, para mostrar ao lado do valor. */
export function participacoes(pesos: { id: string; peso: number | null }[]): Record<string, number> {
  const ps = pesos.map((p) => ({ id: p.id, peso: p.peso !== null && p.peso > 0 ? p.peso : 0 }));
  const soma = ps.reduce((s, p) => s + p.peso, 0);
  return Object.fromEntries(ps.map((p) => [p.id, soma > 0 ? p.peso / soma : 1 / ps.length]));
}

/**
 * A grade de uma métrica é coerente quando tem só a meta da equipe derivada para as pessoas (soma igual à da equipe,
 * ou todas iguais à da equipe numa taxa), ou só metas por pessoa. Devolve o problema em texto, ou null.
 */
export function incoerencia(equipe: number | null, membros: number[], unidade: string): string | null {
  if (equipe === null || !membros.length) return null;
  if (unidade === "%") {
    const diferente = membros.find((v) => Math.abs(v - equipe) > 0.05);
    return diferente === undefined ? null : `a meta da equipe é ${equipe}%, mas há pessoa com ${diferente}%`;
  }
  const soma = membros.reduce((s, v) => s + v, 0);
  return Math.abs(soma - equipe) < 0.5 ? null : `a meta da equipe é ${equipe}, mas a soma das pessoas dá ${soma}`;
}
