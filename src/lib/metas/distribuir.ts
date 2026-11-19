// Meta da equipe repartida entre os membros pela participação de cada um nos últimos meses.
// Usado na tela (para mostrar e salvar) e na ação de salvar (para recusar grade incoerente).

export type ModoMeta = "equipe" | "pessoa";

export interface PesoMeta {
  id: string;
  /** referência histórica da pessoa (média mensal); null ou 0 = sem histórico */
  peso: number | null;
  /** parte do mês em que a pessoa trabalha (dias disponíveis ÷ dias úteis): 1 = mês inteiro, 0 = ausente o mês todo */
  fator?: number;
}

const fatorDe = (p: { fator?: number }) => Math.max(0, Math.min(1, p.fator ?? 1));

/** Quem entra na divisão (fator > 0) e o peso efetivo de cada um. Sem histórico nenhum, todos pesam igual. */
function base(pesos: PesoMeta[]) {
  const presentes = pesos.filter((p) => fatorDe(p) > 0);
  const temHistorico = presentes.some((p) => p.peso !== null && p.peso > 0);
  return presentes.map((p) => ({
    id: p.id,
    peso: temHistorico ? (p.peso !== null && p.peso > 0 ? p.peso : 0) : 1,
    fator: fatorDe(p),
  }));
}

/**
 * Meta da equipe dividida entre quem trabalha no mês. Cada pessoa leva `total × peso / Σ(peso × fator)`: é a meta do
 * mês cheio dela, que o cálculo reduz depois pelo fator (dias disponíveis). Assim a soma do que vale (meta × fator)
 * fecha com a meta da equipe, e a parte de quem está ausente fica com os outros. Quem está ausente o mês todo
 * (fator 0) fica sem meta. Contagens saem inteiras (maiores restos). Taxas (%) não se dividem: cada pessoa que trabalha
 * fica com a da equipe.
 */
export function distribuirMeta(total: number, pesos: PesoMeta[], unidade: string): Record<string, number> {
  const ps = base(pesos);
  if (!ps.length) return {};
  if (unidade === "%") return Object.fromEntries(ps.map((p) => [p.id, total]));
  const soma = ps.reduce((s, p) => s + p.peso * p.fator, 0);
  const inteiro = Math.round(total);
  const brutos = ps.map((p, i) => ({ id: p.id, fator: p.fator, v: (inteiro * p.peso) / soma, i }));
  const out = Object.fromEntries(brutos.map((b) => [b.id, Math.floor(b.v)]));
  // o que ainda falta valer para fechar com o total; cada +1 numa pessoa vale o fator dela
  let falta = inteiro - brutos.reduce((s, b) => s + out[b.id] * b.fator, 0);
  // maior resto primeiro; empate: quem tem mais peso, depois a ordem recebida (estável)
  const ordem = [...brutos].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || b.v - a.v || a.i - b.i);
  for (const b of ordem) {
    if (falta < b.fator / 2) continue;
    out[b.id] += 1;
    falta -= b.fator;
  }
  return out;
}

/** Parte (0–1) de cada pessoa no que vale para a equipe, para mostrar ao lado do valor. Ausente o mês todo = 0. */
export function participacoes(pesos: PesoMeta[]): Record<string, number> {
  const ps = base(pesos);
  const soma = ps.reduce((s, p) => s + p.peso * p.fator, 0);
  const out: Record<string, number> = Object.fromEntries(pesos.map((p) => [p.id, 0]));
  for (const p of ps) out[p.id] = soma > 0 ? (p.peso * p.fator) / soma : 0;
  return out;
}

/** O que vale para a equipe somando as pessoas: Σ meta × fator (contagens) ou a média de quem trabalha (taxas). */
export function valeParaEquipe(membros: { valor: number; fator?: number }[], unidade: string): number | null {
  if (unidade === "%") {
    const vs = membros.filter((m) => fatorDe(m) > 0).map((m) => m.valor);
    return vs.length ? Math.round((vs.reduce((s, v) => s + v, 0) / vs.length) * 10) / 10 : null;
  }
  if (!membros.length) return null;
  return Math.round(membros.reduce((s, m) => s + m.valor * fatorDe(m), 0) * 100) / 100;
}

/**
 * A grade de uma métrica é coerente quando tem só a meta da equipe derivada para as pessoas (o que vale para elas,
 * já descontadas as ausências, soma a da equipe; numa taxa, todas iguais à da equipe), ou só metas por pessoa.
 * Devolve o problema em texto, ou null.
 */
export function incoerencia(
  equipe: number | null,
  membros: { valor: number; fator?: number }[],
  unidade: string,
): string | null {
  if (equipe === null || !membros.length) return null;
  if (unidade === "%") {
    const diferente = membros.find((m) => fatorDe(m) > 0 && Math.abs(m.valor - equipe) > 0.05);
    return diferente === undefined ? null : `a meta da equipe é ${equipe}%, mas há pessoa com ${diferente.valor}%`;
  }
  const vale = valeParaEquipe(membros, unidade) ?? 0;
  if (Math.abs(vale - equipe) < 1) return null;
  const descontou = membros.some((m) => fatorDe(m) < 1);
  return `a meta da equipe é ${equipe}, mas a soma das pessoas${descontou ? " (descontadas as ausências)" : ""} dá ${Math.round(vale)}`;
}
