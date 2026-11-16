"use client";

import { useEffect } from "react";

// Tela cheia sem aviso nenhum na tela. Os navegadores só liberam tela cheia por código depois de um
// gesto (toque, clique ou tecla), então: tenta ao abrir (funciona em quiosque e em alguns navegadores
// de TV) e, em silêncio, entra no primeiro toque ou tecla. Para abrir já em tela cheia sem ninguém
// mexer, o PC da TV deve abrir o Chrome em modo quiosque (--kiosk).

function entrar() {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

export function TelaCheiaTv() {
  useEffect(() => {
    const t = setTimeout(entrar, 300);
    window.addEventListener("pointerdown", entrar);
    window.addEventListener("keydown", entrar);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", entrar);
      window.removeEventListener("keydown", entrar);
    };
  }, []);
  return null;
}
