"use client";

import { useState } from "react";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ATALHOS_MESES, atalhoDosMeses, mesesDoAtalho, textoMeses, type AtalhoMeses } from "@/engine/periodos-meses";

/**
 * Período em meses com atalhos, no mesmo jeito do seletor da Gestão: escolher um atalho já preenche De e Até
 * (e mostra os meses por extenso); mexer num mês passa para "Escolher meses…".
 * Os campos vão no formulário como `de` e `ate` (AAAA-MM). Renderiza 3 campos soltos: o pai decide a grade.
 */
export function PeriodoMeses({ de, ate, atual, id = "pm" }: { de: string; ate: string; atual: string; id?: string }) {
  const [vDe, setDe] = useState(de);
  const [vAte, setAte] = useState(ate);
  const [atalho, setAtalho] = useState<AtalhoMeses>(atalhoDosMeses(de, ate, atual));

  function trocar(a: AtalhoMeses) {
    setAtalho(a);
    if (a === "personalizado") return;
    const m = mesesDoAtalho(a, atual);
    setDe(m.de);
    setAte(m.ate);
  }
  const mexer = (qual: "de" | "ate", v: string) => {
    if (!v) return;
    if (qual === "de") setDe(v);
    else setAte(v);
    setAtalho("personalizado");
  };
  const valido = vDe && vAte && vDe <= vAte;

  return (
    <>
      <Campo rotulo="Período" htmlFor={`${id}-atalho`} ajuda={valido ? textoMeses(vDe, vAte) : "O mês inicial vem depois do final."}>
        <NativeSelect id={`${id}-atalho`} value={atalho} onChange={(e) => trocar(e.target.value as AtalhoMeses)} className="w-full">
          {ATALHOS_MESES.map((x) => (
            <option key={x.k} value={x.k}>
              {x.t}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo rotulo="De" htmlFor={`${id}-de`}>
        <Input id={`${id}-de`} type="month" name="de" value={vDe} max={atual} onChange={(e) => mexer("de", e.target.value)} className="bg-background" />
      </Campo>
      <Campo rotulo="Até" htmlFor={`${id}-ate`}>
        <Input id={`${id}-ate`} type="month" name="ate" value={vAte} max={atual} onChange={(e) => mexer("ate", e.target.value)} className="bg-background" />
      </Campo>
    </>
  );
}
