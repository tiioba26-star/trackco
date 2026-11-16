// Contas do faturamento da Gestão (puras e testáveis).

export interface LinhaFaturamento {
  data: string;
  valor: number;
  qtd: number;
}

export interface ResumoFaturamento {
  valor: number;
  qtd: number;
  /** dias com atendimento faturado */
  dias: number;
  /** valor médio por procedimento */
  valorMedio: number | null;
  /** procedimentos por dia de atendimento */
  porDia: number | null;
}

export function resumoFaturamento(linhas: LinhaFaturamento[]): ResumoFaturamento {
  let valor = 0;
  let qtd = 0;
  const dias = new Set<string>();
  for (const l of linhas) {
    valor += l.valor;
    qtd += l.qtd;
    if (l.qtd || l.valor) dias.add(l.data);
  }
  return {
    valor: arred(valor),
    qtd,
    dias: dias.size,
    valorMedio: qtd ? valor / qtd : null,
    porDia: dias.size ? qtd / dias.size : null,
  };
}

export interface Decomposicao {
  diferenca: number;
  /** efeito de ter mais (ou menos) dias de atendimento */
  dias: number;
  /** efeito de atender mais (ou menos) procedimentos por dia */
  volume: number;
  /** efeito do valor médio de cada procedimento */
  valorMedio: number;
}

/**
 * "Por que o faturamento mudou?": Faturamento = dias × procedimentos/dia × valor médio.
 * Troca um fator de cada vez (dias, depois volume/dia, depois valor médio); os três efeitos somam a diferença exata.
 */
export function decompor(a: ResumoFaturamento, b: ResumoFaturamento): Decomposicao {
  const diferenca = arred(b.valor - a.valor);
  if (!a.dias || !a.qtd || !b.dias || !b.qtd) return { diferenca, dias: diferenca, volume: 0, valorMedio: 0 };
  const pdA = a.qtd / a.dias;
  const vmA = a.valor / a.qtd;
  const pdB = b.qtd / b.dias;
  const dias = arred((b.dias - a.dias) * pdA * vmA);
  const volume = arred(b.dias * (pdB - pdA) * vmA);
  // = qtd(b) × (valor médio b − valor médio a); por diferença, para os três somarem exatamente
  const valorMedio = arred(diferenca - dias - volume);
  return { diferenca, dias, volume, valorMedio };
}

export interface Variacao {
  rotulo: string;
  antes: number;
  depois: number;
  diferenca: number;
}

/** Quem mais ganhou e quem mais perdeu entre dois períodos (por médico, procedimento...). */
export function maioresVariacoes(
  antes: Map<string, number>,
  depois: Map<string, number>,
  n = 5,
): { ganhos: Variacao[]; quedas: Variacao[] } {
  const chaves = new Set([...antes.keys(), ...depois.keys()]);
  const todas: Variacao[] = [...chaves].map((rotulo) => {
    const a = antes.get(rotulo) ?? 0;
    const d = depois.get(rotulo) ?? 0;
    return { rotulo, antes: arred(a), depois: arred(d), diferenca: arred(d - a) };
  });
  return {
    ganhos: todas
      .filter((v) => v.diferenca > 0)
      .sort((x, y) => y.diferenca - x.diferenca)
      .slice(0, n),
    quedas: todas
      .filter((v) => v.diferenca < 0)
      .sort((x, y) => x.diferenca - y.diferenca)
      .slice(0, n),
  };
}

export interface Quartis {
  q1: number;
  mediana: number;
  q3: number;
}

/** Quartis com interpolação linear (mesmo método do Excel QUARTIL.INC). */
export function quartis(valores: number[]): Quartis | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p: number) => {
    const pos = (v.length - 1) * p;
    const i = Math.floor(pos);
    const f = pos - i;
    return v[i] + (v[Math.min(i + 1, v.length - 1)] - v[i]) * f;
  };
  return { q1: q(0.25), mediana: q(0.5), q3: q(0.75) };
}

export type Faixa = "acima" | "media_alta" | "media_baixa" | "abaixo";

/** Em que quarto da equipe a pessoa está. */
export function faixaDoQuartil(valor: number, q: Quartis): Faixa {
  if (valor > q.q3) return "acima";
  if (valor >= q.mediana) return "media_alta";
  if (valor >= q.q1) return "media_baixa";
  return "abaixo";
}

export const ROTULO_FAIXA: Record<Faixa, string> = {
  acima: "Entre os 25% maiores",
  media_alta: "Acima da mediana",
  media_baixa: "Abaixo da mediana",
  abaixo: "Entre os 25% menores",
};

/** Variação percentual (null quando não há base). */
export function variacao(antes: number, depois: number): number | null {
  if (!antes) return null;
  return ((depois - antes) / antes) * 100;
}

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}
