"use client";

import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DICAS, type ChaveDica } from "./dicas";

/** "?" ao lado de um campo: toque/clique mostra a explicação (funciona no celular, diferente de tooltip). */
export function Dica({ id, texto }: { id?: ChaveDica; texto?: string }) {
  const conteudo = texto ?? (id ? DICAS[id] : "");
  if (!conteudo) return null;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="O que é isso?"
            // o desenho continua pequeno (16 px), mas a área de toque tem 36 px (o ::after invisível em volta)
            className="relative inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          />
        }
      >
        <CircleHelp className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 text-sm leading-relaxed font-normal">
        {conteudo}
      </PopoverContent>
    </Popover>
  );
}
