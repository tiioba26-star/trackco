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
import { eixoDias } from "./eixo-dias";

export interface PontoComparativo {
  rotulo: string;
  /** AAAA-MM-DD quando o ponto é um dia: o eixo mostra o número e a letra do dia da semana */
  data?: string | null;
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
  const porDia = dados.length > 0 && dados.every((d) => !!d.data);
  const comuns = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      {porDia ? (
        <XAxis dataKey="rotulo" {...eixoDias(dados.map((d) => d.data ?? null))} />
      ) : (
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
      )}
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

/** Cores das séries na ordem A, B, C… (A e B iguais às do gráfico de duas métricas). */
export const CORES_SERIES = [1, 3, 2, 4, 5, 6, 7, 8, 9, 10].map((n) => `var(--chart-${n})`);

export interface PontoMultiplo {
  rotulo: string;
  data?: string | null;
  valores: (number | null)[];
  futuro: boolean;
}

/**
 * Três ou mais métricas no tempo: uma linha por métrica (barras lado a lado ficariam ilegíveis).
 * Métricas de unidades diferentes ficam em gráficos separados, um por unidade: nunca dois eixos.
 */
export function GraficoMultiplo({
  dados,
  series,
  altura = 300,
}: {
  dados: PontoMultiplo[];
  series: { rotulo: string; unidade: string }[];
  altura?: number;
}) {
  const unidades = Array.from(new Set(series.map((s) => s.unidade)));
  return (
    <div className="space-y-4">
      {unidades.map((u) => {
        const idx = series.map((s, i) => (s.unidade === u ? i : -1)).filter((i) => i >= 0);
        const config: ChartConfig = Object.fromEntries(idx.map((i) => [`m${i}`, { label: series[i].rotulo, color: CORES_SERIES[i] }]));
        const linhas = dados.map((d) => ({ ...d, ...Object.fromEntries(idx.map((i) => [`m${i}`, d.valores[i]])) }));
        const porDia = dados.length > 0 && dados.every((d) => !!d.data);
        return (
          <ChartContainer key={u} config={config} className="w-full" style={{ height: unidades.length > 1 ? Math.round(altura * 0.75) : altura }}>
            <LineChart data={linhas} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              {porDia ? (
                <XAxis dataKey="rotulo" {...eixoDias(dados.map((d) => d.data ?? null))} />
              ) : (
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
              )}
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, p) => {
                      const ponto = p?.[0]?.payload as PontoMultiplo | undefined;
                      return ponto ? `${ponto.rotulo}${ponto.futuro ? " (ainda vai acontecer)" : ""}` : "";
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {idx.map((i) => (
                <Line
                  key={i}
                  dataKey={`m${i}`}
                  stroke={`var(--color-m${i})`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        );
      })}
    </div>
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
  corB = "var(--chart-3)",
}: {
  dados: PontoComparativo[];
  rotuloA: string;
  unidadeA: string;
  rotuloB?: string | null;
  unidadeB?: string | null;
  linhas?: boolean;
  altura?: number;
  /** cor da 2ª série (padrão verde; use neutra quando a série não for "resultado") */
  corB?: string;
}) {
  const sA = { chave: "a" as const, rotulo: rotuloA, cor: "var(--chart-1)" };
  const sB = rotuloB ? { chave: "b" as const, rotulo: rotuloB, cor: corB } : null;
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
