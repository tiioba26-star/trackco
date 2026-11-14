import { cn } from "@/lib/utils";

/** Texto da NVI (Nova Versão Internacional), 1 Pedro 4:10-11. */
export const VERSICULO = {
  texto:
    "Cada um exerça o dom que recebeu para servir os outros, administrando fielmente a graça de Deus em suas múltiplas formas. Se alguém fala, faça-o como quem transmite a palavra de Deus. Se alguém serve, faça-o com a força que Deus provê, de forma que em todas as coisas Deus seja glorificado mediante Jesus Cristo, a quem sejam a glória e o poder para todo o sempre. Amém.",
  referencia: "1 Pedro 4:10-11 (NVI)",
};

/** Rodapé com o versículo (todas as páginas do app e a tela de login). */
export function RodapeVersiculo({ className, claro = false }: { className?: string; claro?: boolean }) {
  return (
    <footer className={cn("px-4 py-5 text-center text-xs leading-relaxed", claro ? "text-white/65" : "text-muted-foreground", className)}>
      <p className="mx-auto max-w-3xl text-balance italic">“{VERSICULO.texto}”</p>
      <p className={cn("mt-1 font-medium not-italic", claro ? "text-white/80" : "text-foreground/70")}>{VERSICULO.referencia}</p>
    </footer>
  );
}
