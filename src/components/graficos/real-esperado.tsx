"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { eixoDias } from "./eixo-dias";

export interface PontoRealEsperadoGrafico {
  rotulo: string;
  data: string | null;
  real: number | null;
  esperado: number | null;
  parcial: boolean;
  futuro: boolean;
}

/**
 * Realizado (barras) × esperado pela meta (linha tracejada), um ponto por mês ou por dia.
 * Barra verde quando chegou no esperado; azul quando ficou abaixo; clara quando é parcial (mês ou dia em andamento).
 */
export function GraficoRealEsperado({ dados, unidade, altura = 240 }: { dados: PontoRealEsperadoGrafico[]; unidade: string; altura?: number }) {
  const config: ChartConfig = {
    real: { label: "Realizado", color: "var(--chart-1)" },
    esperado: { label: "Esperado", color: "var(--muted-foreground)" },
  };
  const porDia = dados.length > 0 && dados.every((d) => !!d.data);
  const fmt = (v: unknown) =>
    typeof v === "number" ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 1 })}${unidade === "%" ? "%" : ""}` : "—";
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <ComposedChart data={dados} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        {porDia ? (
          <XAxis dataKey="rotulo" {...eixoDias(dados.map((d) => d.data))} />
        ) : (
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        )}
        <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => (unidade === "%" ? `${v}%` : String(v))} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => {
                const ponto = p?.[0]?.payload as PontoRealEsperadoGrafico | undefined;
                return ponto ? `${ponto.rotulo}${ponto.parcial ? " (em andamento)" : ponto.futuro ? " (ainda não chegou)" : ""}` : "";
              }}
              formatter={(valor, nome) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{nome === "real" ? "Realizado" : "Esperado"}</span>
                  <span className="font-medium tabular-nums">{fmt(valor)}</span>
                </span>
              )}
            />
          }
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar dataKey="real" radius={[4, 4, 0, 0]} maxBarSize={porDia ? 22 : 44}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              fill={d.real !== null && d.esperado !== null && d.real >= d.esperado ? "var(--up)" : "var(--chart-1)"}
              fillOpacity={d.parcial ? 0.45 : 1}
            />
          ))}
        </Bar>
        <Line
          dataKey="esperado"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={porDia ? false : { r: 3, fill: "var(--muted-foreground)" }}
          connectNulls={false}
          isAnimationActive={false}
          type={porDia ? "linear" : "monotone"}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
