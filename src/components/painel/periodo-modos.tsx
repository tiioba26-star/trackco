"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ModoPeriodo {
  k: string;
  rotulo: string;
  conteudo: React.ReactNode;
}

/**
 * Formas de escolher o período (atalhos, outro mês, datas). No celular mostra uma por vez, com a troca do tipo logo acima;
 * do tamanho sm para cima, todas lado a lado como sempre.
 */
export function ModosPeriodo({ modos, inicial }: { modos: ModoPeriodo[]; inicial: string }) {
  const [ativo, setAtivo] = useState(modos.some((m) => m.k === inicial) ? inicial : modos[0]?.k);
  return (
    <div className="space-y-2">
      {modos.length > 1 && (
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 sm:hidden" role="tablist" aria-label="Tipo de filtro do período">
          {modos.map((m) => (
            <button
              key={m.k}
              type="button"
              role="tab"
              aria-selected={ativo === m.k}
              onClick={() => setAtivo(m.k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                ativo === m.k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {modos.map((m) => (
          <div key={m.k} className={cn(ativo === m.k ? "flex" : "hidden", "w-full min-w-0 sm:flex sm:w-auto")}>
            {m.conteudo}
          </div>
        ))}
      </div>
    </div>
  );
}
