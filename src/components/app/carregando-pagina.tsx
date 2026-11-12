import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estado de carregamento mostrado NA HORA do clique (vem pré-carregado com o link).
 * O título aparece já; os números entram assim que o servidor responde.
 */
export function CarregandoPagina({ titulo, variante = "tabela" }: { titulo?: string; variante?: "painel" | "tabela" | "form" }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        {titulo ? <h2 className="text-2xl font-semibold tracking-tight">{titulo}</h2> : <Skeleton className="h-8 w-56" />}
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {variante === "painel" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </>
      )}
      {variante === "tabela" && (
        <div className="space-y-2 rounded-xl border p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      )}
      {variante === "form" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      )}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
