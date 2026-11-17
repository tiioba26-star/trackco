"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { janelaGestao, PERIODOS_GESTAO, type Comparar, type PeriodoGestao } from "@/engine/periodos-gestao";
import { Campo } from "@/components/ui/campo";

/**
 * Período, De, Até e Comparar ligados entre si:
 * escolher um atalho já mostra as datas dele; mexer numa data passa para "Escolher datas…".
 * `hoje` vem do servidor (fuso da Bahia), para as datas baterem com o que o servidor calcula.
 */
export function PeriodoGestaoCampos({
  periodo,
  inicio,
  fim,
  comparar,
  hoje,
}: {
  periodo: PeriodoGestao;
  inicio: string;
  fim: string;
  comparar: Comparar;
  hoje: string;
}) {
  const [p, setP] = useState<PeriodoGestao>(periodo);
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);

  function trocarPeriodo(novo: PeriodoGestao) {
    setP(novo);
    if (novo !== "personalizado") {
      const j = janelaGestao(novo, null, null, hoje);
      setDe(j.inicio);
      setAte(j.fim);
    }
  }

  return (
    <>
      <Campo rotulo="Período" htmlFor="g-p">
        <NativeSelect id="g-p" name="p" value={p} onChange={(e) => trocarPeriodo(e.target.value as PeriodoGestao)} className="w-full">
          {PERIODOS_GESTAO.map((x) => (
            <option key={x.k} value={x.k}>
              {x.t}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo rotulo="De" htmlFor="g-de">
        <Input
          id="g-de"
          type="date"
          name="de"
          value={de}
          max={hoje}
          onChange={(e) => {
            setDe(e.target.value);
            setP("personalizado");
          }}
        />
      </Campo>
      <Campo rotulo="Até" htmlFor="g-ate">
        <Input
          id="g-ate"
          type="date"
          name="ate"
          value={ate}
          max={hoje}
          onChange={(e) => {
            setAte(e.target.value);
            setP("personalizado");
          }}
        />
      </Campo>
      <Campo rotulo="Comparar com" htmlFor="g-comparar">
        <NativeSelect id="g-comparar" name="comparar" defaultValue={comparar} className="w-full">
          <option value="anterior">Período anterior (mesmos dias)</option>
          <option value="ano">Mesmo período do ano anterior</option>
          <option value="nada">Não comparar</option>
        </NativeSelect>
      </Campo>
    </>
  );
}
