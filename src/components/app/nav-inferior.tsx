"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { itemAtivo, NAV } from "./nav";

/**
 * Barra fixa embaixo, só no celular e só para o perfil Colaborador (5 itens, tudo a um toque).
 * Líder e administrador têm muitos itens e continuam com o menu lateral.
 * A altura fica em --nav-inferior (globals.css): o fim da página, os avisos e o convite de instalar sobem por cima dela.
 */
export function NavInferior() {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);
  const itens = NAV[0].itens.filter((i) => i.perfil === "todos");
  return (
    <nav
      data-nav-inferior
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
        {itens.map((i) => {
          const atual = ativo?.href === i.href;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-tight font-medium tracking-tight transition-colors",
                  atual ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <i.icone className={cn("size-5", atual && "stroke-[2.4]")} aria-hidden />
                <span className="max-w-full truncate">{i.titulo === "Sobre o Trackco" ? "Sobre" : i.titulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
