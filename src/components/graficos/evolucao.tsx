"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface SerieEvolucao {
  chave: string;
  rotulo: string;
}

/** Evolução acumulada no mês (uma escala só; a meta é a linha tracejada da mesma série). */
export function GraficoEvolucao({
  dados,
  series,
  altura = 260,
}: {
  dados: Record<string, string | number | null>[];
  series: SerieEvolucao[];
  altura?: number;
}) {
  const config: ChartConfig = {};
  series.forEach((s, i) => {
    const cor = `var(--chart-${(i % 6) + 1})`;
    config[s.chave] = { label: s.rotulo, color: cor };
    config[`meta_${s.chave}`] = { label: `Ritmo da meta · ${s.rotulo}`, color: cor };
  });
  const temMeta = (k: string) => dados.some((d) => d[`meta_${k}`] != null);

  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <LineChart data={dados} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(v) => `Dia ${v}`} indicator="line" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) =>
          temMeta(s.chave) ? (
            <Line
              key={`meta_${s.chave}`}
              dataKey={`meta_${s.chave}`}
              stroke={`var(--color-meta_${s.chave})`}
              strokeDasharray="5 5"
              strokeOpacity={0.55}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ) : null,
        )}
        {series.map((s) => (
          <Line
            key={s.chave}
            dataKey={s.chave}
            stroke={`var(--color-${s.chave})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
