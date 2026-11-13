"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { TelaTv } from "@/lib/dados/tv";
import { TacaPosicao } from "./carinha";
import { Linha14 } from "./graficos-tv";

// Telas da TV além do ranking e da tela por pessoa: equipe (Particular × SUS), pizza com as outras
// equipes, destaques do mês passado e a faixa de recorde batido.

const fmt = (n: number, unidade?: string) => {
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 0 });
  return unidade === "%" ? `${s}%` : s;
};

function Cartao({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0e2246]/60 to-[#071329]/80 p-[2.4vh] shadow-xl backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ equipe: Particular | SUS

const COR = {
  particular: { texto: "#7dd3fc", borda: "border-sky-400/50", fundo: "bg-sky-400/10", barra: "linear-gradient(90deg, #0284c7, #38bdf8)" },
  sus: { texto: "#c4b5fd", borda: "border-violet-400/50", fundo: "bg-violet-400/10", barra: "linear-gradient(90deg, #7c3aed, #a78bfa)" },
};

function ColunaCategoria({
  cat,
  agendamentos,
  bruto,
  realizadas,
  clinica,
  linha,
}: {
  cat: "particular" | "sus";
  agendamentos: number;
  bruto?: number;
  realizadas: number;
  clinica: number | null;
  linha?: { dias: string[]; valores: number[] };
}) {
  const c = COR[cat];
  const pct = clinica ? Math.min(100, (realizadas / clinica) * 100) : null;
  return (
    <div className={`flex flex-col gap-[2vh] rounded-3xl border-2 ${c.borda} bg-gradient-to-b from-[#0e2246]/70 to-[#071329]/85 p-[2.6vh] backdrop-blur-md`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`rounded-xl ${c.fundo} px-4 py-1 text-[3.4vh] font-black tracking-wide uppercase`} style={{ color: c.texto }}>
          {cat === "particular" ? "Particular" : "SUS"}
        </span>
        {cat === "sus" && <span className="text-[1.8vh] font-semibold text-sky-200/50">só acompanhamento</span>}
      </div>

      <div>
        <div className="text-[2.2vh] font-semibold text-sky-100/80">Agendamentos válidos que a equipe fez</div>
        <div className="flex items-baseline gap-3">
          <span className="text-[9vh] leading-none font-black text-white tabular-nums">{fmt(agendamentos)}</span>
          {bruto !== undefined && bruto > agendamentos && (
            <span className="text-[2.2vh] font-semibold text-sky-200/60">de {fmt(bruto)} marcados no total</span>
          )}
        </div>
      </div>

      <div className="space-y-[1vh]">
        <div className="text-[2.2vh] font-semibold text-sky-100/80">Consultas realizadas</div>
        <div className="flex items-baseline gap-3">
          <span className="text-[6.5vh] leading-none font-black text-white tabular-nums">{fmt(realizadas)}</span>
          <span className="text-[2.4vh] font-semibold text-sky-200/70">de {clinica !== null ? fmt(clinica) : "—"} na clínica inteira</span>
        </div>
        <div className="h-[2vh] overflow-hidden rounded-full border border-white/10 bg-white/5">
          <motion.div className="h-full rounded-full" style={{ background: c.barra }} initial={{ width: 0 }} animate={{ width: `${pct ?? 0}%` }} transition={{ duration: 1.2 }} />
        </div>
        <div className="text-[2vh] text-sky-100/80">
          {pct !== null ? (
            <>
              <b style={{ color: c.texto }}>{fmt(pct, "%")}</b> das consultas {cat === "sus" ? "SUS" : "Particular"} da clínica foram marcadas pela equipe
            </>
          ) : (
            "Total da clínica indisponível no momento"
          )}
        </div>
      </div>
      {linha && linha.valores.length > 1 && (
        <div className="mt-auto border-t border-white/10 pt-[1.2vh]">
          <Linha14 valores={linha.valores} dias={linha.dias} cor={c.texto} />
        </div>
      )}
    </div>
  );
}

export function TelaEquipe({ tela }: { tela: TelaTv }) {
  const e = tela.equipe!;
  return (
    <div className="grid flex-1 grid-cols-2 gap-[2.4vh] py-[1.5vh]">
      <ColunaCategoria
        cat="particular"
        agendamentos={e.agendamentosParticular}
        bruto={e.brutoParticular}
        realizadas={e.realizadasParticular.equipe}
        clinica={e.realizadasParticular.clinica}
        linha={e.linha14 && { dias: e.linha14.dias, valores: e.linha14.particular }}
      />
      <ColunaCategoria
        cat="sus"
        agendamentos={e.agendamentosSus}
        bruto={e.brutoSus}
        realizadas={e.realizadasSus.equipe}
        clinica={e.realizadasSus.clinica}
        linha={e.linha14 && { dias: e.linha14.dias, valores: e.linha14.sus }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ pizza: equipe do painel × outras

const CORES_OUTRAS = ["#6366f1", "#14b8a6", "#64748b", "#a78bfa", "#475569"];
const COR_DESTAQUE = "#38bdf8";

function Rosca({ fatias, tamanho }: { fatias: { valor: number; cor: string }[]; tamanho: number }) {
  const total = Math.max(1, fatias.reduce((s, f) => s + f.valor, 0));
  const r = 40;
  const circ = 2 * Math.PI * r;
  const partes = fatias.map((f) => (f.valor / total) * circ);
  const inicios = partes.map((_, i) => partes.slice(0, i).reduce((x, y) => x + y, 0));
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
      {fatias.map((f, i) => {
        const parte = partes[i];
        const acumulado = inicios[i];
        return (
          <motion.circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={f.cor}
            strokeWidth="16"
            strokeDasharray={`${Math.max(0, parte - 0.6)} ${circ}`}
            initial={{ strokeDashoffset: -acumulado + parte }}
            animate={{ strokeDashoffset: -acumulado }}
            transition={{ duration: 1, delay: i * 0.08 }}
          />
        );
      })}
    </svg>
  );
}

export function TelaParticipacao({ tela }: { tela: TelaTv }) {
  const periodos = tela.participacao ?? [];
  // cores estáveis por equipe em todas as roscas
  const outras = Array.from(new Set(periodos.flatMap((p) => p.fatias.filter((f) => !f.destaque).map((f) => f.equipe))));
  const cor = (equipe: string, destaque: boolean) => (destaque ? COR_DESTAQUE : CORES_OUTRAS[outras.indexOf(equipe) % CORES_OUTRAS.length]);
  const destaque = periodos[0]?.fatias.find((f) => f.destaque)?.equipe ?? "Equipe";
  return (
    <div className="flex flex-1 flex-col gap-[2vh] py-[1vh]">
      <p className="text-[2.2vh] text-sky-100/80">
        De todas as marcações da clínica (todos os convênios), quanto cada equipe fez. Em <b style={{ color: COR_DESTAQUE }}>azul</b>, {destaque}.
      </p>
      <div className={`grid flex-1 gap-[2vh] ${periodos.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}>
        {periodos.map((p) => {
          const total = p.fatias.reduce((s, f) => s + f.valor, 0);
          const minha = p.fatias.find((f) => f.destaque)?.valor ?? 0;
          const pct = total ? (minha / total) * 100 : 0;
          return (
            <Cartao key={p.nome} className="flex flex-col items-center gap-[1.4vh]">
              <div className="text-center">
                <div className="text-[2.5vh] font-extrabold text-white">{p.nome}</div>
                <div className="text-[1.8vh] font-semibold text-sky-200/70 tabular-nums">{p.datas}</div>
              </div>
              <div className="relative">
                <Rosca fatias={p.fatias.map((f) => ({ valor: f.valor, cor: cor(f.equipe, f.destaque) }))} tamanho={250} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[3.3vh] leading-none font-black tabular-nums" style={{ color: COR_DESTAQUE }}>
                    {fmt(pct, "%")}
                  </span>
                  <span className="text-[1.5vh] font-semibold text-sky-200/70">{destaque}</span>
                </div>
              </div>
              <ul className="w-full space-y-[0.5vh] text-[1.8vh]">
                {[...p.fatias]
                  .sort((a, b) => Number(b.destaque) - Number(a.destaque) || b.valor - a.valor)
                  .map((f) => (
                    <li key={f.equipe} className={`flex items-center justify-between gap-2 ${f.destaque ? "font-bold text-white" : "text-sky-100/75"}`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-[1.4vh] shrink-0 rounded-full" style={{ background: cor(f.equipe, f.destaque) }} />
                        <span className="truncate">{f.equipe}</span>
                      </span>
                      <span className="tabular-nums">
                        {fmt(f.valor)} <span className="text-sky-200/50">· {fmt(total ? (f.valor / total) * 100 : 0, "%")}</span>
                      </span>
                    </li>
                  ))}
                <li className="flex justify-between border-t border-white/10 pt-[0.5vh] text-sky-200/60">
                  <span>Clínica</span>
                  <span className="tabular-nums">{fmt(total)}</span>
                </li>
              </ul>
            </Cartao>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ destaques do mês passado

export function TelaDestaques({ tela }: { tela: TelaTv }) {
  const d = tela.destaques!;
  const e = d.equipe;
  return (
    <div className="grid flex-1 grid-cols-[1fr_1.6fr] gap-[2.4vh] py-[1.5vh]">
      <Cartao className="flex flex-col justify-center gap-[2.4vh]">
        <div>
          <div className="text-[2.3vh] font-semibold text-sky-100/80">A equipe marcou em {d.mes}</div>
          <div className="text-[10vh] leading-none font-black text-white tabular-nums">{fmt(e.validos)}</div>
          <div className="text-[2.1vh] text-sky-200/70">
            pacientes válidos{e.total > e.validos ? ` · ${fmt(e.total)} marcações no total` : ""}
          </div>
          {e.crescimento !== null && e.crescimento > 0 && (
            <div className="mt-[1vh] inline-block rounded-full bg-emerald-400/15 px-3 py-0.5 text-[2.2vh] font-bold text-emerald-300">
              +{fmt(e.crescimento, "%")} sobre {d.mesAnterior}
            </div>
          )}
        </div>
        {e.taxa !== null && (
          <div>
            <div className="text-[2.3vh] font-semibold text-sky-100/80">Comparecimento</div>
            <div className="text-[6vh] leading-none font-black text-emerald-300 tabular-nums">{fmt(e.taxa, "%")}</div>
            <div className="text-[2vh] text-sky-200/70">de cada 100 pacientes marcados para {d.mes}, {Math.round(e.taxa)} vieram</div>
          </div>
        )}
        {e.melhorDia && (
          <div className="text-[2.1vh] text-sky-100/80">
            Dia mais forte: <b className="text-white">{e.melhorDia.dia}</b>, com <b className="text-white">{e.melhorDia.valor}</b> agendamentos válidos
          </div>
        )}
      </Cartao>

      <div className="flex flex-col gap-[2vh]">
        {d.vencedores.map((v, i) => (
          <motion.div
            key={v.titulo}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.25 }}
            className="flex flex-1 items-center gap-[2vw] rounded-3xl border border-amber-300/25 bg-gradient-to-r from-amber-400/10 via-[#0e2246]/60 to-[#071329]/80 px-[2vw] py-[1.6vh]"
          >
            <TacaPosicao posicao={1} tamanho={74} />
            <div className="min-w-0 flex-1">
              <div className="text-[2.2vh] font-semibold tracking-wide text-amber-200/90 uppercase">{v.titulo}</div>
              <div className="text-[4.4vh] leading-tight font-black text-white tabular-nums">#{v.codigo}</div>
            </div>
            <div className="text-right">
              <div className="text-[5.2vh] leading-none font-black text-white tabular-nums">{v.valor}</div>
              <div className="text-[1.8vh] text-sky-200/70">{v.detalhe}</div>
            </div>
          </motion.div>
        ))}
        {d.metaBatida.length > 0 && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-[2vw] py-[1.4vh] text-[2.3vh] font-semibold text-emerald-200">
            🎯 Bateram a meta de {d.mes}: {d.metaBatida.map((c) => `#${c}`).join(" · ")}
          </div>
        )}
        {!d.vencedores.length && <Cartao className="text-[2.4vh] text-sky-100/80">Ainda sem dados suficientes de {d.mes}.</Cartao>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ faixa de recorde batido

export function FaixaRecordes({ recordes, onNovo }: { recordes: string[]; onNovo?: (texto: string) => void }) {
  const [i, setI] = useState(0);
  const atual = recordes[i % Math.max(1, recordes.length)];
  useEffect(() => {
    if (recordes.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 8000);
    return () => clearInterval(t);
  }, [recordes.length]);
  useEffect(() => {
    if (atual) onNovo?.(atual);
  }, [atual, onNovo]);
  if (!recordes.length) return null;
  return (
    <div className="relative z-10 mt-[1.2vh] flex justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={atual}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          className="flex items-center gap-3 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-amber-500/25 px-6 py-[0.8vh] text-[2.4vh] font-bold text-amber-100 shadow-[0_0_30px_rgba(245,197,66,0.25)]"
        >
          <span className="motion-safe:animate-bounce">🏆</span> {atual}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
