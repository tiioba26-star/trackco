"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ModoPeriodo {
  k: string;
  rotulo: string;
  conteudo: React.ReactNode;
}

/**
 * Formas de escolher o período (atalhos, outro mês, datas): uma por vez, em qualquer tela, com a troca do tipo ao lado
 * (no celular, logo acima). Mostrar as três juntas confundia.
 */
export function ModosPeriodo({ modos, inicial }: { modos: ModoPeriodo[]; inicial: string }) {
  const [ativo, setAtivo] = useState(modos.some((m) => m.k === inicial) ? inicial : modos[0]?.k);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {modos.length > 1 && (
        <div className="inline-flex w-fit shrink-0 rounded-lg border bg-muted/40 p-0.5" role="tablist" aria-label="Tipo de filtro do período">
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
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {modos.map((m) => (
          <div key={m.k} role="tabpanel" className={cn(ativo === m.k ? "flex" : "hidden", "w-full min-w-0 sm:w-auto")}>
            {m.conteudo}
          </div>
        ))}
      </div>
    </div>
  );
}
