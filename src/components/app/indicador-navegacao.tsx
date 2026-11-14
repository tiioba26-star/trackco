"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const EVENTO = "trackco:navegar";
const LIMITE_MS = 15_000;

/** Para navegações feitas no código (router.push): avisa que a tela vai mudar. */
export function avisarNavegacao() {
  window.dispatchEvent(new Event(EVENTO));
}

function marcar(ligado: boolean) {
  const html = document.documentElement;
  const conteudo = document.querySelector("[data-conteudo]");
  if (ligado) {
    html.dataset.navegando = "1";
    conteudo?.setAttribute("aria-busy", "true");
  } else {
    delete html.dataset.navegando;
    conteudo?.removeAttribute("aria-busy");
  }
}

/**
 * Resposta na hora do clique: uma barra corre no topo e o conteúdo atual pulsa de leve até a página nova
 * (ou o esqueleto dela) aparecer. Sem isso, um clique que espera o servidor parece travado.
 * Vale para links, filtros (formulários GET) e navegações do código (avisarNavegacao).
 */
export function IndicadorNavegacao() {
  const pathname = usePathname();
  const params = useSearchParams();
  const url = `${pathname}?${params.toString()}`;

  // a URL mudou: a página nova (ou o esqueleto dela) já está na tela
  useEffect(() => {
    marcar(false);
  }, [url]);

  useEffect(() => {
    let limite: number | undefined;
    const iniciar = () => {
      marcar(true);
      window.clearTimeout(limite);
      limite = window.setTimeout(() => marcar(false), LIMITE_MS);
    };
    const mesmaPagina = (destino: URL) => destino.pathname === location.pathname && destino.search === location.search;

    // fase de captura: roda antes do <Link> assumir o clique
    const clique = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const destino = new URL(a.href, location.href);
      if (destino.origin !== location.origin || destino.pathname.startsWith("/api/") || mesmaPagina(destino)) return;
      iniciar();
    };
    // filtros (formulários GET); ações do servidor (POST) têm o próprio "Salvando…"
    const envio = (e: SubmitEvent) => {
      const f = e.target;
      if (!(f instanceof HTMLFormElement)) return;
      const acao = f.getAttribute("action") ?? "";
      if (acao.startsWith("javascript:") || (f.getAttribute("method") ?? "get").toLowerCase() !== "get") return;
      const destino = new URL(acao || location.href, location.href);
      const campos = new URLSearchParams();
      for (const [k, v] of new FormData(f)) if (typeof v === "string") campos.append(k, v);
      destino.search = campos.toString();
      if (mesmaPagina(destino)) return; // "Ver" sem mudar nada: a URL não muda e a tela já está certa
      iniciar();
    };

    document.addEventListener("click", clique, true);
    document.addEventListener("submit", envio, true);
    window.addEventListener(EVENTO, iniciar);
    return () => {
      document.removeEventListener("click", clique, true);
      document.removeEventListener("submit", envio, true);
      window.removeEventListener(EVENTO, iniciar);
      window.clearTimeout(limite);
    };
  }, []);

  return <div aria-hidden className="barra-navegacao" />;
}
