"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CORES_SERIES } from "@/components/graficos/comparativo";

export const LETRAS = "ABCDEFGHIJ";

/**
 * Métricas da análise livre: A, B, C… até `maximo`. "+" acrescenta uma, "−" tira aquela.
 * Vão no formulário como vários campos "m" (a ordem é a das letras).
 */
export function EscolhaMetricas({
  metricas,
  iniciais,
  maximo,
}: {
  metricas: { codigo: string; nome: string }[];
  iniciais: string[];
  maximo: number;
}) {
  // cada linha tem uma chave própria: tirar a do meio não embaralha as outras
  const [linhas, setLinhas] = useState(() => (iniciais.length ? iniciais : [metricas[0]?.codigo ?? ""]).map((c, i) => ({ k: i, codigo: c })));
  const [prox, setProx] = useState(linhas.length);

  const proxima = () => metricas.find((m) => !linhas.some((l) => l.codigo === m.codigo))?.codigo ?? metricas[0]?.codigo ?? "";

  return (
    <div className="space-y-2 md:col-span-full">
      <div className="flex items-center justify-between gap-2">
        <Label>Métricas</Label>
        <span className="text-xs text-muted-foreground">
          {linhas.length} de {maximo}
        </span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {linhas.map((l, i) => (
          <li key={l.k} className="flex items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: CORES_SERIES[i] }}
              aria-hidden
            >
              {LETRAS[i]}
            </span>
            <NativeSelect
              name="m"
              aria-label={`Métrica ${LETRAS[i]}`}
              value={l.codigo}
              onChange={(e) => setLinhas((ls) => ls.map((x) => (x.k === l.k ? { ...x, codigo: e.target.value } : x)))}
              className="min-w-0 flex-1 bg-background"
            >
              {metricas.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Tirar a métrica ${LETRAS[i]}`}
              disabled={linhas.length === 1}
              onClick={() => setLinhas((ls) => ls.filter((x) => x.k !== l.k))}
            >
              <Minus />
            </Button>
          </li>
        ))}
      </ul>
      {linhas.length < maximo && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLinhas((ls) => [...ls, { k: prox, codigo: proxima() }]);
            setProx((n) => n + 1);
          }}
        >
          <Plus /> Comparar com a métrica {LETRAS[linhas.length]}
        </Button>
      )}
    </div>
  );
}
