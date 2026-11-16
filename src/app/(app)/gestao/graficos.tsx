"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const cor = (i: number, total: number, nome: string) => (nome === "Outros" && i === total - 1 ? "var(--muted-foreground)" : `var(--chart-${(i % 8) + 1})`);
const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const curto = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v));

/** Os nomes das séries viram chaves seguras (s0, s1...) para as cores do gráfico. */
function preparar(series: string[], pontos: Record<string, string | number>[]) {
  const config: ChartConfig = Object.fromEntries(series.map((s, i) => [`s${i}`, { label: s, color: cor(i, series.length, s) }]));
  const dados = pontos.map((p) => {
    const o: Record<string, string | number> = { ponto: p.ponto };
    series.forEach((s, i) => (o[`s${i}`] = p[s] ?? 0));
    return o;
  });
  return { config, dados };
}

/** Barras empilhadas ao longo do tempo (R$ ou quantidade). */
export function GraficoEmpilhado({
  series,
  pontos,
  dinheiro = false,
  altura = 300,
}: {
  series: string[];
  pontos: Record<string, string | number>[];
  dinheiro?: boolean;
  altura?: number;
}) {
  const { config, dados } = preparar(series, pontos);
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <BarChart data={dados} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="ponto" tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} />
        <YAxis tickLine={false} axisLine={false} width={dinheiro ? 56 : 40} tickFormatter={(v: number) => (dinheiro ? curto(v) : String(v))} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={dinheiro ? (v, nome) => <Valor nome={String(config[String(nome)]?.label ?? nome)} v={real(Number(v))} /> : undefined} />}
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Bar key={s} dataKey={`s${i}`} stackId="a" fill={`var(--color-s${i})`} maxBarSize={40} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function Valor({ nome, v }: { nome: string; v: string }) {
  return (
    <span className="flex w-full justify-between gap-3">
      <span className="text-muted-foreground">{nome}</span>
      <b className="tabular-nums">{v}</b>
    </span>
  );
}

/** Várias linhas ao longo do tempo (ex.: marcações por equipe). */
export function GraficoLinhas({ series, pontos, altura = 280 }: { series: string[]; pontos: Record<string, string | number>[]; altura?: number }) {
  const { config, dados } = preparar(series, pontos);
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <LineChart data={dados} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="ponto" tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Line key={s} dataKey={`s${i}`} stroke={`var(--color-s${i})`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** Acumulado dia a dia: período × comparação, alinhados pelo nº do dia (mesmos dias). */
export function GraficoAcumulado({
  dados,
  rotuloAtual,
  rotuloBase,
  altura = 280,
}: {
  dados: { dia: number; rotulo: string; atual: number | null; base: number | null }[];
  rotuloAtual: string;
  rotuloBase: string | null;
  altura?: number;
}) {
  const config: ChartConfig = {
    atual: { label: rotuloAtual, color: "var(--chart-1)" },
    ...(rotuloBase ? { base: { label: rotuloBase, color: "var(--muted-foreground)" } } : {}),
  };
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <LineChart data={dados} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `Dia ${(p?.[0]?.payload as { dia: number } | undefined)?.dia ?? ""} do período`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="atual" stroke="var(--color-atual)" strokeWidth={2.5} dot={false} connectNulls={false} />
        {rotuloBase && <Line dataKey="base" stroke="var(--color-base)" strokeWidth={2} strokeDasharray="5 4" dot={false} />}
      </LineChart>
    </ChartContainer>
  );
}

/** Dispersão volume × comparecimento, com as medianas marcando os quatro quadrantes. */
export function GraficoDispersao({
  pontos,
  medianaX,
  medianaY,
  altura = 320,
}: {
  pontos: { nome: string; x: number; y: number; valor: number }[];
  medianaX: number | null;
  medianaY: number | null;
  altura?: number;
}) {
  const config: ChartConfig = { pessoas: { label: "Pessoas", color: "var(--chart-1)" } };
  return (
    <ChartContainer config={config} className="w-full" style={{ height: altura }}>
      <ScatterChart margin={{ left: 4, right: 16, top: 12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name="Marcações" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="number" dataKey="y" name="Comparecimento" unit="%" domain={[0, 100]} tickLine={false} axisLine={false} width={44} />
        <ZAxis type="number" dataKey="valor" range={[50, 400]} />
        {medianaX !== null && <ReferenceLine x={medianaX} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
        {medianaY !== null && <ReferenceLine y={medianaY} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as { nome: string; x: number; y: number; valor: number } | undefined;
            if (!p) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                <div className="mb-1 font-medium">{p.nome}</div>
                <div>{p.x.toLocaleString("pt-BR")} marcações</div>
                <div>{p.y.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de comparecimento</div>
                <div>{real(p.valor)} gerados</div>
              </div>
            );
          }}
        />
        <Scatter data={pontos} fill="var(--color-pessoas)" fillOpacity={0.75} />
      </ScatterChart>
    </ChartContainer>
  );
}
