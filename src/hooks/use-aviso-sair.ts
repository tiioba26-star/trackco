"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConfirmar } from "@/components/app/confirmacao";

/**
 * Enquanto `sujo` for true (há alterações não salvas):
 * - fechar a aba ou recarregar mostra o aviso do navegador;
 * - clicar num link do sistema pergunta antes de sair (caixa do próprio sistema).
 */
export function useAvisoAoSair(sujo: boolean) {
  const router = useRouter();
  const confirmar = useConfirmar();

  useEffect(() => {
    if (!sujo) return;
    const antesDeSair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmar({
        titulo: "Sair sem salvar?",
        texto: "Você tem alterações nesta tela que ainda não foram salvas. Se sair agora, elas se perdem.",
        confirmar: "Sair sem salvar",
        perigo: true,
      }).then((ok) => {
        if (ok) router.push(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener("beforeunload", antesDeSair);
    document.addEventListener("click", clique, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSair);
      document.removeEventListener("click", clique, true);
    };
  }, [sujo, confirmar, router]);
}
