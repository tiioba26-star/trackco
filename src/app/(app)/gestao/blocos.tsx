import { AlertTriangle, Download, TrendingDown, TrendingUp } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtNum, fmtValor } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const real = (v: number | null | undefined) => fmtValor(v ?? null, "R$");

/** ▲▼ contra a base de comparação. Em pontos percentuais quando o número já é %. */
export function Delta({ atual, base, nome, pp = false }: { atual: number | null; base: number | null | undefined; nome?: string; pp?: boolean }) {
  if (atual === null || base === null || base === undefined) return null;
  if (!pp && base === 0) return atual ? <span className="text-xs text-muted-foreground">antes: 0</span> : null;
  const d = pp ? atual - base : ((atual - base) / base) * 100;
  if (Math.abs(d) < 0.05) return <span className="text-xs text-muted-foreground">igual{nome ? ` a ${nome}` : ""}</span>;
  const sobe = d > 0;
  const Icone = sobe ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", sobe ? "text-up" : "text-down")}>
      <Icone className="size-3.5" />
      {sobe ? "+" : "−"}
      {fmtNum(Math.abs(d), 1)}
      {pp ? " p.p." : "%"}
      {nome && <span className="text-muted-foreground">vs {nome}</span>}
    </span>
  );
}

/** Cartão de número da Gestão: título, valor, o que conta e a comparação. */
export function Kpi({
  titulo,
  valor,
  descricao,
  ajuda,
  delta,
  antes,
}: {
  titulo: string;
  valor: string;
  descricao: React.ReactNode;
  ajuda: string;
  delta?: React.ReactNode;
  antes?: string | null;
}) {
  return (
    <Card className="gap-2">
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {titulo} <Dica texto={ajuda} />
        </div>
        <div className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{valor}</div>
        <div className="text-xs leading-snug text-muted-foreground">{descricao}</div>
        {(delta || antes) && (
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1">
            {delta}
            {antes && <span className="text-xs text-muted-foreground">antes: {antes}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Link de download (CSV/XLSX) com os filtros atuais. */
export function Baixar({ href, children = "CSV" }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
      <Download className="size-3.5" /> {children}
    </a>
  );
}

/** Barra horizontal simples (0–100% da maior). */
export function Barrinha({ pct, cor = "var(--primary)" }: { pct: number; cor?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </div>
  );
}

/** Fundo de célula de "mapa de calor" (0–1). */
export const calor = (t: number) => ({ background: `color-mix(in oklab, var(--primary) ${Math.round(Math.max(0, Math.min(1, t)) * 70)}%, transparent)` });

/** Quando os dados não vêm (ex.: migração ainda não aplicada), explica em vez de quebrar a página. */
export function ErroGestao({ erro }: { erro: Error }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-6 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-down" />
        <div className="space-y-1">
          <p className="font-medium">Não deu para carregar esta parte.</p>
          <p className="text-muted-foreground">{erro.message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
