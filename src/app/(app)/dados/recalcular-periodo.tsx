"use client";

import { History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmar, useSomenteLeitura } from "@/components/app/confirmacao";
import { competenciaAnterior, nomeCompetencia } from "@/engine/datas";
import { recalcularMes } from "./actions";
import { Campo } from "@/components/ui/campo";

/** Recalcula um intervalo de meses, um de cada vez, mostrando o progresso. */
export function RecalcularPeriodo({ atual }: { atual: string }) {
  const router = useRouter();
  // começa só no mês atual: recalcular muitos meses é demorado, então a pessoa amplia se quiser
  const [de, setDe] = useState(atual);
  const [ate, setAte] = useState(atual);
  const [feitos, setFeitos] = useState(0);
  const [total, setTotal] = useState(0);
  const [rodando, setRodando] = useState(false);
  const confirmar = useConfirmar();
  const leitura = useSomenteLeitura();

  async function rodar() {
    const meses: string[] = [];
    for (let c = ate; c >= de && meses.length < 60; c = competenciaAnterior(c)) meses.push(c);
    if (!meses.length) return toast.error("Período inválido.");
    const nome = (c: string) => nomeCompetencia(c, true);
    if (
      !(await confirmar({
        titulo: meses.length === 1 ? `Recalcular ${nomeCompetencia(meses[0])}?` : `Recalcular ${meses.length} meses?`,
        texto: `${meses.length === 1 ? "" : `De ${nome(meses.at(-1)!)} a ${nome(meses[0])}. `}Os números do painel e do extrato são refeitos com as regras e metas atuais. Meses com fechamento aprovado mantêm o resultado oficial.${meses.length > 6 ? " Pode levar alguns minutos." : ""}`,
        confirmar: "Recalcular",
      }))
    )
      return;
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
        <Campo rotulo="De">
          <Input type="month" value={de} onChange={(e) => setDe(e.target.value)} className="w-48" />
        </Campo>
        <Campo rotulo="Até">
          <Input type="month" value={ate} max={atual} onChange={(e) => setAte(e.target.value)} className="w-48" />
        </Campo>
        <Button variant="outline" onClick={rodar} disabled={rodando || leitura}>
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
