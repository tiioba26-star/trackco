"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CHAVE_ADIADO, deveConvidar, plataformaDe } from "@/lib/pwa";

/** Evento do Chrome/Edge/Samsung Internet no Android quando o site pode ser instalado. */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function lerAdiado(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE_ADIADO));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function adiar() {
  try {
    localStorage.setItem(CHAVE_ADIADO, String(Date.now()));
  } catch {
    // navegação privada: o convite volta na próxima visita
  }
}

/** Convite no rodapé, só no celular/tablet, para instalar o Trackco na tela de início (PWA). */
export function ConviteInstalar() {
  const [modo, setModo] = useState<"ios" | "android" | null>(null);
  const evento = useRef<EventoInstalar | null>(null);

  useEffect(() => {
    const plataforma = plataformaDe(navigator.userAgent, navigator.maxTouchPoints);
    if (plataforma === "outro") return;
    const instalado =
      matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const pode = (oferece: boolean) => deveConvidar({ plataforma, instalado, adiadoEm: lerAdiado(), agora: Date.now(), navegadorOferece: oferece });

    // espera a página assentar (e os avisos de aniversário e pesquisa aparecerem primeiro)
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const mostrarDepois = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => setModo(plataforma), 4000);
    };
    const aoOferecer = (e: Event) => {
      if (!pode(true)) return; // deixa o navegador seguir com o aviso dele
      e.preventDefault();
      evento.current = e as EventoInstalar;
      mostrarDepois();
    };
    const aoInstalar = () => {
      evento.current = null;
      clearTimeout(relogio);
      setModo(null);
    };
    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    if (plataforma === "ios" && pode(false)) mostrarDepois();
    return () => {
      clearTimeout(relogio);
      window.removeEventListener("beforeinstallprompt", aoOferecer);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (!modo) return null;

  const fechar = () => {
    adiar();
    setModo(null);
  };

  const instalar = async () => {
    const e = evento.current;
    if (!e) return fechar();
    await e.prompt();
    const { outcome } = await e.userChoice;
    evento.current = null;
    if (outcome === "dismissed") adiar();
    setModo(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="convite-instalar-titulo"
      className="fixed inset-x-0 bottom-[var(--nav-inferior)] z-40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-4 text-card-foreground shadow-lg animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone gerado pela rota /pwa-icon */}
          <img src="/pwa-icon/192" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p id="convite-instalar-titulo" className="font-semibold">
              Instale o Trackco no celular
            </p>
            <p className="text-sm text-muted-foreground">Abre direto da tela de início, em tela cheia, como um aplicativo.</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={fechar} className="-mt-1 -mr-1">
            <X />
          </Button>
        </div>

        {modo === "ios" ? (
          <>
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">1</span>
                <span>
                  Toque em <Share className="inline size-4 -translate-y-px text-primary" aria-label="Compartilhar" /> <b>Compartilhar</b>, na
                  barra do navegador.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">2</span>
                <span>
                  Escolha <SquarePlus className="inline size-4 -translate-y-px" aria-hidden /> <b>Adicionar à Tela de Início</b>.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">3</span>
                <span>
                  Toque em <b>Adicionar</b>.
                </span>
              </li>
            </ol>
            <Button variant="outline" className="mt-3 w-full" onClick={fechar}>
              Entendi
            </Button>
          </>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={fechar}>
              Agora não
            </Button>
            <Button className="flex-1" onClick={instalar}>
              Instalar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
