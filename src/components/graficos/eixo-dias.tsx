// Eixo de dias dos gráficos (site e TV): número do dia, um ponto nos dias que não cabem escritos
// e, embaixo, a letra do dia da semana (sábado e domingo destacados).

/** Letra do dia da semana (getUTCDay: 0 = domingo). */
const LETRA_DIA = ["D", "S", "T", "Q", "Q", "S", "S"];

export interface EstiloEixoDias {
  numero: string;
  letra: string;
  fimDeSemana: string;
  tamanhoNumero: number;
  tamanhoLetra: number;
}

export const ESTILO_SITE: EstiloEixoDias = {
  numero: "var(--muted-foreground)",
  letra: "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  fimDeSemana: "var(--primary)",
  tamanhoNumero: 12,
  tamanhoLetra: 10,
};

/**
 * Props para o <XAxis> de uma série com um ponto por dia.
 * Até 16 dias: todos os números. Até 31: um sim, um não (ponto no meio). Mais que isso: a cada N dias.
 * A letra do dia da semana só aparece até 31 dias (depois disso fica apertado demais).
 */
export function eixoDias(datas: (string | null)[], estilo: EstiloEixoDias = ESTILO_SITE) {
  const n = datas.length;
  const passo = n <= 16 ? 1 : n <= 31 ? 2 : Math.ceil(n / 16);
  const comLetra = n <= 31;
  const comPonto = n <= 62;
  function TickDia(props: { x?: number | string; y?: number | string; index?: number }) {
    const i = props.index ?? 0;
    const data = datas[i] ?? null;
    if (!data) return <g />;
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
    const fds = dow === 0 || dow === 6;
    const escrito = i % passo === 0;
    const ln = estilo.tamanhoNumero;
    return (
      <g transform={`translate(${x},${y})`}>
        {escrito ? (
          <text y={ln} textAnchor="middle" fill={estilo.numero} fontSize={ln}>
            {data.slice(8, 10)}
          </text>
        ) : comPonto ? (
          <circle cy={ln * 0.6} r={Math.max(1.6, ln / 6.5)} fill={estilo.numero} />
        ) : null}
        {comLetra && (
          <text y={ln + estilo.tamanhoLetra + 6} textAnchor="middle" fontSize={estilo.tamanhoLetra} fontWeight={700} fill={fds ? estilo.fimDeSemana : estilo.letra}>
            {LETRA_DIA[dow]}
          </text>
        )}
      </g>
    );
  }
  return {
    tick: TickDia,
    interval: 0 as const,
    height: estilo.tamanhoNumero + (comLetra ? estilo.tamanhoLetra + 22 : 10),
    tickLine: false,
    axisLine: false,
  };
}
