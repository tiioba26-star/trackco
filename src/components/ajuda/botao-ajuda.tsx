"use client";

import { driver, type DriveStep } from "driver.js";
import { CircleHelp, Lightbulb, PlayCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ajudaPara, type PassoTour } from "./conteudos";

const CHAVE_VISTO = "trackco:tour-visto";

export function iniciarTour(passos: PassoTour[]) {
  const steps: DriveStep[] = passos
    .filter((p) => document.querySelector(`[data-tour="${p.alvo}"]`))
    .map((p) => ({
      element: `[data-tour="${p.alvo}"]`,
      popover: { title: p.titulo, description: p.texto },
    }));
  if (!steps.length) return;
  driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo",
    prevBtnText: "Anterior",
    doneBtnText: "Concluir",
    popoverClass: "trackco-tour",
    steps,
  }).drive();
}

export function BotaoAjuda() {
  const pathname = usePathname();
  const ajuda = ajudaPara(pathname);
  const [aberto, setAberto] = useState(false);

  // primeiro acesso: oferece o tour do painel automaticamente
  useEffect(() => {
    if (pathname !== "/") return;
    try {
      if (localStorage.getItem(CHAVE_VISTO)) return;
      localStorage.setItem(CHAVE_VISTO, "1");
    } catch {
      return;
    }
    const t = setTimeout(() => iniciarTour(ajuda.passos), 900);
    return () => clearTimeout(t);
  }, [pathname, ajuda.passos]);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Ajuda desta seção"
        data-tour="ajuda"
        onClick={() => setAberto(true)}
        className="rounded-full"
      >
        <CircleHelp />
      </Button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-xl">{ajuda.titulo}</SheetTitle>
            <SheetDescription>Como esta seção funciona</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6 text-sm leading-relaxed">
            {ajuda.resumo.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {ajuda.dicas?.length ? (
              <div className="space-y-2 rounded-lg border bg-primary-soft/60 p-3">
                <div className="flex items-center gap-2 font-medium">
                  <Lightbulb className="size-4 text-primary" /> Dicas
                </div>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {ajuda.dicas.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              className="w-full"
              onClick={() => {
                setAberto(false);
                setTimeout(() => iniciarTour(ajuda.passos), 250);
              }}
            >
              <PlayCircle /> Fazer o tour guiado desta tela
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
