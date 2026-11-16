"use client";

import { Maximize } from "lucide-react";
import { useEffect, useState } from "react";

// Os navegadores só deixam entrar em tela cheia depois de um gesto da pessoa (toque, clique ou tecla).
// Então: tenta ao abrir (funciona em quiosque e em alguns navegadores de TV) e, se for bloqueado,
// entra no primeiro toque, clique ou botão do controle remoto. Se sair (Esc), volta no próximo gesto.

const emTelaCheia = () => typeof document !== "undefined" && !!document.fullscreenElement;

function entrar() {
  if (emTelaCheia() || !document.documentElement.requestFullscreen) return;
  void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

export function TelaCheiaTv() {
  const [cheia, setCheia] = useState(true);
  const [suportada, setSuportada] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSuportada(!!document.documentElement.requestFullscreen);
      setCheia(emTelaCheia());
      entrar();
    }, 300);
    const mudou = () => setCheia(emTelaCheia());
    const gesto = () => entrar();
    document.addEventListener("fullscreenchange", mudou);
    window.addEventListener("pointerdown", gesto);
    window.addEventListener("keydown", gesto);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", mudou);
      window.removeEventListener("pointerdown", gesto);
      window.removeEventListener("keydown", gesto);
    };
  }, []);

  if (cheia || !suportada) return null;
  return (
    <button
      type="button"
      onClick={entrar}
      className="fixed bottom-[2vh] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-[1.4vw] text-white/80 backdrop-blur hover:bg-white/20"
    >
      <Maximize className="size-[1.4vw] min-h-4 min-w-4" /> Toque na tela ou aperte OK no controle para tela cheia
    </button>
  );
}
