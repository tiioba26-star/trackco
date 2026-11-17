import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pílula de ligar e desligar para escolhas curtas (dias da semana, períodos, etapas).
 * Por baixo é um checkbox nativo escondido: manda `name`/`value` no formulário como antes
 * e o leitor de tela continua anunciando "caixa de seleção, marcada".
 * Ligada, ganha cor e um ✓ (a cor sozinha não basta para quem não distingue cores).
 */
export function Pilula({ children, className, ...props }: Omit<ComponentProps<"input">, "type" | "children"> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        "group/pilula inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm transition-colors select-none",
        "[&:not(:has(:checked)):hover]:bg-muted",
        "has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        "has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <input type="checkbox" className="sr-only" {...props} />
      <Check aria-hidden className="hidden size-3.5 group-has-checked/pilula:block" />
      {children}
    </label>
  );
}
