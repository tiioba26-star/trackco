"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

/** Barras agrupadas por mês (uma escala; só séries de mesma unidade). */
export function GraficoMensal({
  dados,
  series,
  altura = 260,
}: {
  dados: Record<string, string | number>[];
  series: { chave: string; rotulo: string }[];
  altura?: number;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.chave, { label: s.rotulo, color: `var(--chart-${(i % 6) + 1})` }]),
  );
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <BarChart data={dados} margin={{ left: 4, right: 8, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Bar key={s.chave} dataKey={s.chave} fill={`var(--color-${s.chave})`} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
