"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface PontoComparativo {
  rotulo: string;
  a: number | null;
  b: number | null;
  futuro: boolean;
}

function Grafico({
  dados,
  series,
  linhas,
  altura,
}: {
  dados: PontoComparativo[];
  series: { chave: "a" | "b"; rotulo: string; cor: string }[];
  linhas: boolean;
  altura: number;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.chave, { label: s.rotulo, color: s.cor }]));
  const comuns = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
      <YAxis tickLine={false} axisLine={false} width={40} />
      <ChartTooltip
        content={
          <ChartTooltipContent
            labelFormatter={(_, p) => {
              const ponto = p?.[0]?.payload as PontoComparativo | undefined;
              return ponto ? `${ponto.rotulo}${ponto.futuro ? " (ainda vai acontecer)" : ""}` : "";
            }}
          />
        }
        cursor={linhas ? undefined : { fill: "var(--muted)", opacity: 0.5 }}
      />
      {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
    </>
  );
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      {linhas ? (
        <LineChart data={dados} margin={{ left: 4, right: 12, top: 8 }}>
          {comuns}
          {series.map((s) => (
            <Line
              key={s.chave}
              dataKey={s.chave}
              stroke={`var(--color-${s.chave})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            />
          ))}
        </LineChart>
      ) : (
        <BarChart data={dados} margin={{ left: 4, right: 8, top: 8 }} barGap={2}>
          {comuns}
          {series.map((s) => (
            <Bar key={s.chave} dataKey={s.chave} fill={`var(--color-${s.chave})`} radius={[4, 4, 0, 0]} maxBarSize={28}>
              {dados.map((d, i) => (
                <Cell key={i} fillOpacity={d.futuro ? 0.35 : 1} />
              ))}
            </Bar>
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}

/** Compara duas métricas no tempo. Unidades diferentes (ex.: quantidade × %) viram dois gráficos: nunca dois eixos. */
export function GraficoComparativo({
  dados,
  rotuloA,
  unidadeA,
  rotuloB,
  unidadeB,
  linhas = false,
  altura = 260,
}: {
  dados: PontoComparativo[];
  rotuloA: string;
  unidadeA: string;
  rotuloB?: string | null;
  unidadeB?: string | null;
  linhas?: boolean;
  altura?: number;
}) {
  const sA = { chave: "a" as const, rotulo: rotuloA, cor: "var(--chart-1)" };
  const sB = rotuloB ? { chave: "b" as const, rotulo: rotuloB, cor: "var(--chart-3)" } : null;
  if (!sB || unidadeA === unidadeB) {
    return <Grafico dados={dados} series={sB ? [sA, sB] : [sA]} linhas={linhas} altura={altura} />;
  }
  return (
    <div className="space-y-4">
      <Grafico dados={dados} series={[sA]} linhas={linhas} altura={Math.round(altura * 0.7)} />
      <Grafico dados={dados} series={[sB]} linhas={linhas} altura={Math.round(altura * 0.7)} />
    </div>
  );
}
