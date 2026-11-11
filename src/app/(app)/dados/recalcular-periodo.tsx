"use client";

import { History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { competenciaAnterior } from "@/engine/datas";
import { recalcularMes } from "./actions";

/** Recalcula um intervalo de meses, um de cada vez, mostrando o progresso. */
export function RecalcularPeriodo({ atual }: { atual: string }) {
  const router = useRouter();
  const [de, setDe] = useState("2025-01");
  const [ate, setAte] = useState(atual);
  const [feitos, setFeitos] = useState(0);
  const [total, setTotal] = useState(0);
  const [rodando, setRodando] = useState(false);

  async function rodar() {
    const meses: string[] = [];
    for (let c = ate; c >= de && meses.length < 60; c = competenciaAnterior(c)) meses.push(c);
    if (!meses.length) return toast.error("Período inválido.");
    setRodando(true);
    setTotal(meses.length);
    setFeitos(0);
    let erros = 0;
    for (const [i, m] of meses.entries()) {
      const r = await recalcularMes(m);
      if (!r.ok) {
        erros++;
        toast.error(`${m}: ${r.erro}`);
      }
      setFeitos(i + 1);
    }
    setRodando(false);
    toast[erros ? "warning" : "success"](`${meses.length - erros} de ${meses.length} mês(es) recalculado(s).`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="month" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="month" value={ate} max={atual} onChange={(e) => setAte(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={rodar} disabled={rodando}>
          <History /> {rodando ? `Recalculando ${feitos}/${total}…` : "Recalcular período"}
        </Button>
      </div>
      {rodando && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(feitos / Math.max(1, total)) * 100}%` }} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Use depois de mudar regras, metas antigas ou de fazer uma carga histórica do Klingo. Meses com fechamento aprovado
        mantêm o resultado oficial.
      </p>
    </div>
  );
}
