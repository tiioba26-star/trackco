import type { ReactNode } from "react";
import { Dica } from "@/components/ajuda/dica";
import type { ChaveDica } from "@/components/ajuda/dicas";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Um campo de formulário: rótulo (com o "?" quando há explicação), o controle e, se precisar, uma ajuda curta embaixo.
 * Espaços fixos: 8 px entre rótulo e campo. Entre um campo e outro, o formulário usa 20 px (`space-y-5` / `gap-y-5`).
 * Explicação longa vai no "?" (`dica` / `dicaTexto`), não em `ajuda`.
 */
export function Campo({
  rotulo,
  htmlFor,
  dica,
  dicaTexto,
  ajuda,
  className,
  children,
}: {
  rotulo: ReactNode;
  htmlFor?: string;
  dica?: ChaveDica;
  dicaTexto?: string;
  ajuda?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-slot="campo" className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{rotulo}</Label>
        {(dica || dicaTexto) && <Dica id={dica} texto={dicaTexto} />}
      </div>
      {children}
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

/** Bloco com título dentro de um formulário longo (ex.: "Quem vê o quê"). */
export function BlocoCampos({ titulo, descricao, className, children }: { titulo: string; descricao?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("space-y-5 border-t pt-5 first:border-t-0 first:pt-0", className)}>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}
