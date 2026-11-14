import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto no formato da Análise (abas, pergunta, números, gráfico): aparece na hora do clique. */
export default function Carregando() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Análise</h2>
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-80 max-w-full rounded-xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
