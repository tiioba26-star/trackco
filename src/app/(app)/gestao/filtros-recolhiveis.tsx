"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * No computador, os filtros ficam abertos no cartão. No celular, viram um botão "Filtros (n)"
 * que abre um painel de baixo para cima; aplicar ou limpar fecha o painel.
 * O formulário existe num lugar só por vez (ids e rótulos não se repetem).
 */
export function FiltrosRecolhiveis({ ativos, children }: { ativos: number; children: ReactNode }) {
  const celular = useIsMobile();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button variant="outline" className="md:hidden" onClick={() => setAberto(true)} aria-haspopup="dialog">
        <SlidersHorizontal />
        Filtros{ativos > 0 && ` (${ativos})`}
      </Button>
      {/* antes do JavaScript carregar o celular ainda não é conhecido: o CSS já esconde a versão aberta */}
      {!celular && <div className="max-md:hidden">{children}</div>}
      {celular && (
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-xl">
            <SheetHeader className="pr-12">
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Escolha o que quer ver e toque em Aplicar.</SheetDescription>
            </SheetHeader>
            <div
              className="px-4 pb-6"
              onSubmitCapture={() => setAberto(false)}
              onClickCapture={(e) => {
                if ((e.target as Element).closest("a")) setAberto(false);
              }}
            >
              {children}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
