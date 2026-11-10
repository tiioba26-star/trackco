import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{titulo}</h2>
        {descricao ? <p className="max-w-3xl text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  );
}

export function Vazio({
  icone: Icone,
  titulo,
  texto,
  acao,
  className,
}: {
  icone?: LucideIcon;
  titulo: string;
  texto?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center", className)}>
      {Icone ? <Icone className="size-8 text-muted-foreground" /> : null}
      <div className="font-medium">{titulo}</div>
      {texto ? <p className="max-w-md text-sm text-muted-foreground">{texto}</p> : null}
      {acao}
    </div>
  );
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</div>;
}

/** Barra de progresso com marca em 100%. */
export function BarraAtingimento({ pct, cor, className }: { pct: number | null; cor?: string; className?: string }) {
  const v = pct === null ? 0 : Math.max(0, pct);
  const largura = Math.min(v, 150) / 1.5; // escala até 150%
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${largura}%`, background: cor ?? (v >= 100 ? "var(--up)" : "var(--primary)") }}
      />
      <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${100 / 1.5}%` }} aria-hidden />
    </div>
  );
}

export function NivelBadge({ nivel, cor, className }: { nivel: string | null | undefined; cor?: string | null; className?: string }) {
  if (!nivel) return <span className={cn("text-xs text-muted-foreground", className)}>sem nível</span>;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={{
        background: `color-mix(in oklab, ${cor ?? "var(--primary)"} 14%, transparent)`,
        color: cor ?? "var(--primary)",
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: cor ?? "var(--primary)" }} />
      {nivel}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const mapa: Record<string, { t: string; c: string }> = {
    aberto: { t: "Aberto", c: "var(--muted-foreground)" },
    calculado: { t: "Calculado", c: "var(--primary)" },
    em_contestacao: { t: "Em contestação", c: "var(--warn)" },
    conferencia_lider: { t: "Conferência do líder", c: "var(--primary)" },
    aprovacao_admin: { t: "Aprovação do admin", c: "var(--primary)" },
    aprovado: { t: "Aprovado", c: "var(--up)" },
    entregue: { t: "Entregue", c: "var(--up)" },
    aberta: { t: "Aberta", c: "var(--warn)" },
    em_analise: { t: "Em análise", c: "var(--primary)" },
    aceita: { t: "Aceita", c: "var(--up)" },
    recusada: { t: "Recusada", c: "var(--down)" },
    ok: { t: "OK", c: "var(--up)" },
    parcial: { t: "Parcial", c: "var(--warn)" },
    erro: { t: "Erro", c: "var(--down)" },
    executando: { t: "Executando", c: "var(--primary)" },
  };
  const m = mapa[status] ?? { t: status, c: "var(--muted-foreground)" };
  return <NivelBadge nivel={m.t} cor={m.c} />;
}
