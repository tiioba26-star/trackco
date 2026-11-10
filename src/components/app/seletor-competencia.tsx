"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { competenciaAnterior, nomeCompetencia } from "@/engine/datas";

export function SeletorCompetencia({ competencia, maxima }: { competencia: string; maxima: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function ir(comp: string) {
    const p = new URLSearchParams(params.toString());
    p.set("comp", comp);
    router.push(`${pathname}?${p.toString()}`);
  }
  const proxima = competenciaAnterior(competencia, -1);

  return (
    <div className="inline-flex items-center rounded-lg border bg-card" data-tour="competencia">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => ir(competenciaAnterior(competencia))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-36 px-1 text-center text-sm font-medium capitalize">{nomeCompetencia(competencia)}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Próximo mês"
        disabled={proxima > maxima}
        onClick={() => ir(proxima)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
