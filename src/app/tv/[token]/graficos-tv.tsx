"use client";

import { motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ColunaTv, GraficoTv, LinhaEquipe, TelaTv } from "@/lib/dados/tv";
import { type EstiloEixoDias, eixoDias } from "@/components/graficos/eixo-dias";
import { corDaPosicao } from "./carinha";

// Telas com gráfico e a tela "todos os períodos lado a lado" da TV (fundo escuro, letras grandes).

const fmt = (n: number, unidade?: string) => {
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 0 });
  return unidade === "%" ? `${s}%` : s;
};

const C = { atual: "#38bdf8", anterior: "#94a3b8", sus: "#a78bfa", ok: "#34d399", ouro: "#f5c542" };
const EIXO = { fill: "rgba(186,230,253,0.7)", fontSize: 16 };
const GRADE = "rgba(255,255,255,0.07)";

// eixo dos dias na TV: letras maiores, sábado e domingo em dourado
const EIXO_DIAS_TV: EstiloEixoDias = {
  numero: "rgba(186,230,253,0.7)",
  letra: "rgba(186,230,253,0.45)",
  fimDeSemana: "rgba(245,197,66,0.85)",
  tamanhoNumero: 16,
  tamanhoLetra: 13,
};

/** Etiqueta da média no fim da linha tracejada (fica na margem direita, sem cobrir os pontos). */
function etiquetaMedia(texto: string, cor: string, tamanho: number) {
  function Etiqueta({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number } }) {
    const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) + 10;
    const y = viewBox?.y ?? 0;
    const w = texto.length * tamanho * 0.6 + 22;
    const h = tamanho + 14;
    return (
      <g transform={`translate(${x},${y - h / 2})`}>
        <rect width={w} height={h} rx={h / 2} fill="#071329" stroke={cor} strokeOpacity={0.8} strokeWidth={2} />
        <text x={w / 2} y={h / 2 + 1} dominantBaseline="central" textAnchor="middle" fill={cor} fontSize={tamanho} fontWeight={900}>
          {texto}
        </text>
      </g>
    );
  }
  return Etiqueta;
}

function Caixa({ titulo, children, className = "" }: { titulo?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-0 flex-col rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0e2246]/60 to-[#071329]/80 p-[2vh] backdrop-blur-md ${className}`}>
      {titulo && <div className="mb-[1vh] text-[2.2vh] font-semibold text-sky-100/85">{titulo}</div>}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Legenda({ itens }: { itens: { cor: string; texto: string; tracejado?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[2vh] text-sky-100/85">
      {itens.map((i) => (
        <span key={i.texto} className="flex items-center gap-2">
          <span className="inline-block h-[0.5vh] w-8 rounded-full" style={{ background: i.tracejado ? `repeating-linear-gradient(90deg, ${i.cor} 0 6px, transparent 6px 10px)` : i.cor }} />
          {i.texto}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ todos os períodos lado a lado

function ColunaRanking({ c, unidade, mais }: { c: ColunaTv; unidade?: string; mais?: boolean }) {
  const max = Math.max(1, ...c.itens.map((i) => i.valor));
  return (
    <Caixa
      titulo={
        <div className="space-y-[0.4vh]">
          <div className="truncate text-[2.6vh] font-extrabold text-white">{c.periodo.nome}</div>
          <div className="text-[1.8vh] font-semibold text-sky-200/70 tabular-nums">{c.periodo.datas}</div>
          {c.total !== undefined && (
            <div className="text-[2vh] font-bold text-sky-200 tabular-nums">
              equipe {fmt(c.total)}
              {c.totalBruto !== undefined && c.totalBruto > c.total && <span className="font-medium text-sky-200/60"> de {fmt(c.totalBruto)} no total</span>}
            </div>
          )}
          {c.comparadoCom && <div className="text-[1.6vh] text-sky-200/55">vs {c.comparadoCom}</div>}
        </div>
      }
    >
      {c.itens.length ? (
        <ul className="flex h-full flex-col justify-start gap-[1.4vh] pt-[0.6vh]">
          {c.itens.map((it, k) => (
            <motion.li key={it.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.06 }}>
              <div className="flex items-center gap-[0.8vw]">
                <span className="w-[2.4vw] text-[2.6vh] font-black tabular-nums" style={{ color: corDaPosicao(k + 1) }}>
                  {k + 1}º
                </span>
                <span className="w-[4.4vw] text-[2vh] font-bold tracking-wider text-sky-100 tabular-nums">#{it.id}</span>
                <div className="relative h-[3.2vh] flex-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: k === 0 ? "linear-gradient(90deg,#1d4ed8,#38bdf8)" : "linear-gradient(90deg,#1e3a8a,#3b82f6)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(6, (it.valor / max) * 100)}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
                <span className="w-[5.6vw] text-right text-[2.8vh] font-black text-white tabular-nums">
                  {mais && it.valor > 0 ? "+" : ""}
                  {fmt(it.valor, unidade)}
                </span>
              </div>
              {(it.detalhe || (it.bruto !== undefined && it.bruto > it.valor)) && (
                <div className="pl-[7.6vw] text-[1.5vh] text-sky-200/55 tabular-nums">{it.detalhe ?? `de ${fmt(it.bruto!)} no total`}</div>
              )}
            </motion.li>
          ))}
        </ul>
      ) : (
        <div className="flex h-full items-center justify-center text-center text-[2.2vh] text-sky-200/60">{c.vazio ?? "Sem dados ainda"}</div>
      )}
    </Caixa>
  );
}

export function TelaMulti({ tela }: { tela: TelaTv }) {
  const cols = tela.colunas ?? [];
  return (
    <div className="grid flex-1 gap-[1.6vh] py-[1vh]" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols.length)}, minmax(0, 1fr))` }}>
      {cols.map((c) => (
        <ColunaRanking key={c.periodo.nome} c={c} unidade={tela.unidade} mais={tela.mais} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ gráficos

function MesDiaADia({ g }: { g: Extract<GraficoTv, { tipo: "mes_dia_a_dia" }> }) {
  const diff = g.totalAnteriorMesmoPonto ? ((g.totalAtual - g.totalAnteriorMesmoPonto) / g.totalAnteriorMesmoPonto) * 100 : null;
  const max = Math.max(1, ...g.calendario.map((d) => d.valor ?? 0));
  const temDomingo = g.calendario.some((d) => d.dow === 7 && (d.valor ?? 0) > 0);
  const dows = temDomingo ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
  // linhas só das semanas que aparecem (mês que começa num domingo escondido não deixa linha vazia)
  const linhas = Array.from(new Set(g.calendario.filter((d) => dows.includes(d.dow)).map((d) => d.semana))).sort((a, b) => a - b);
  const semanas = linhas.length;
  const totDow = dows.map((w) => g.calendario.filter((d) => d.dow === w).reduce((t, d) => t + (d.valor ?? 0), 0));
  const maxDow = Math.max(...totDow);
  const NOMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return (
    <div className="grid flex-1 grid-cols-[1.55fr_1fr] gap-[2vh] py-[1vh]">
      <Caixa
        titulo={
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Legenda itens={[{ cor: C.atual, texto: `${g.mes}` }, { cor: C.anterior, texto: g.mesAnterior, tracejado: true }]} />
            <span className="text-[2.2vh]">
              Até hoje: <b className="text-white">{fmt(g.totalAtual)}</b> × {fmt(g.totalAnteriorMesmoPonto)} em {g.mesAnterior}
              {diff !== null && (
                <b className={diff >= 0 ? "ml-2 text-emerald-300" : "ml-2 text-sky-200/70"}>
                  {diff >= 0 ? "+" : ""}
                  {fmt(diff, "%")}
                </b>
              )}
            </span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={g.dias} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="d" {...eixoDias(g.dias.map((x) => x.data), EIXO_DIAS_TV)} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
            <Line dataKey="anterior" stroke={C.anterior} strokeWidth={2.5} strokeDasharray="7 6" dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="atual" stroke={C.atual} strokeWidth={4.5} dot={{ r: 4, fill: C.atual }} animationDuration={1200}>
              <LabelList dataKey="atual" position="top" style={{ fill: "#e0f2fe", fontSize: 14, fontWeight: 700 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Caixa>

      <Caixa titulo={`Calendário de ${g.mes} · por dia da semana`}>
        <div className="flex h-full flex-col gap-[0.8vh]">
          <div className="grid gap-[0.6vh]" style={{ gridTemplateColumns: `repeat(${dows.length}, minmax(0,1fr))` }}>
            {dows.map((w) => (
              <div key={w} className="text-center text-[1.8vh] font-bold text-sky-200/80">
                {NOMES[w - 1]}
              </div>
            ))}
          </div>
          <div className="grid flex-1 gap-[0.6vh]" style={{ gridTemplateColumns: `repeat(${dows.length}, minmax(0,1fr))`, gridTemplateRows: `repeat(${semanas}, minmax(0,1fr))` }}>
            {g.calendario
              .filter((d) => dows.includes(d.dow))
              .map((d) => (
                <div
                  key={d.data}
                  className={`relative flex flex-col items-center justify-center rounded-lg ${d.hoje ? "ring-2 ring-amber-300" : ""}`}
                  style={{
                    gridColumn: dows.indexOf(d.dow) + 1,
                    gridRow: linhas.indexOf(d.semana) + 1,
                    background: d.valor === null ? "rgba(255,255,255,0.03)" : `rgba(56,189,248,${0.08 + 0.72 * ((d.valor ?? 0) / max)})`,
                  }}
                >
                  <span className="absolute top-[0.3vh] left-[0.4vw] text-[1.3vh] text-white/60">{d.dia}</span>
                  <span className="text-[2.4vh] font-black text-white tabular-nums">{d.valor ?? ""}</span>
                </div>
              ))}
          </div>
          <div className="grid gap-[0.6vh] border-t border-white/10 pt-[0.8vh]" style={{ gridTemplateColumns: `repeat(${dows.length}, minmax(0,1fr))` }}>
            {totDow.map((t, k) => (
              <div key={k} className="text-center">
                <div className="text-[2.2vh] font-black tabular-nums" style={{ color: t === maxDow && t > 0 ? C.ouro : "#e0f2fe" }}>
                  {fmt(t)}
                </div>
                <div className="text-[1.3vh] text-sky-200/50">no mês</div>
              </div>
            ))}
          </div>
        </div>
      </Caixa>
    </div>
  );
}

function Semanas({ g }: { g: Extract<GraficoTv, { tipo: "semanas" }> }) {
  // duas faixas (Particular em cima, SUS embaixo), cada uma na própria escala: volumes muito diferentes
  const faixa = (chave: "particular" | "sus", cor: string, nome: string) => {
    const valores = g.semanas.map((s) => s[chave]);
    const ult = valores[valores.length - 1];
    const media = valores.slice(0, -1).reduce((t, v) => t + v, 0) / Math.max(1, valores.length - 1);
    return (
      <Caixa
        titulo={
          <div className="flex items-baseline justify-between">
            <span style={{ color: cor }} className="text-[2.6vh] font-black">
              {nome}
            </span>
            <span className="text-[2vh]">
              média {fmt(media)} por semana · esta semana (parcial) <b className="text-white">{fmt(ult)}</b>
            </span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={g.semanas} margin={{ top: 22, right: 150, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} width={50} allowDecimals={false} />
            <ReferenceLine
              y={media}
              stroke={cor}
              strokeOpacity={0.75}
              strokeWidth={2}
              strokeDasharray="6 6"
              label={etiquetaMedia(`média ${fmt(media)}`, cor, 18)}
            />
            <Line dataKey={chave} stroke={cor} strokeWidth={4} dot={{ r: 3.5, fill: cor }} animationDuration={1200}>
              <LabelList dataKey={chave} position="top" style={{ fill: "#e0f2fe", fontSize: 13, fontWeight: 700 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Caixa>
    );
  };
  return (
    <div className="grid flex-1 grid-rows-2 gap-[1.6vh] py-[1vh]">
      {faixa("particular", C.atual, "Particular")}
      {faixa("sus", C.sus, "SUS")}
    </div>
  );
}

function ComparecimentoSemanas({ g }: { g: Extract<GraficoTv, { tipo: "comparecimento_semanas" }> }) {
  return (
    <div className="flex flex-1 flex-col gap-[1.4vh] py-[1vh]">
      <Caixa
        className="flex-1"
        titulo={
          <div className="flex items-baseline justify-between">
            <span>De cada 100 consultas Particular marcadas para a semana, quantas aconteceram</span>
            {g.media !== null && (
              <span className="flex items-center gap-3">
                <span className="inline-block h-[0.5vh] w-10 rounded-full" style={{ background: `repeating-linear-gradient(90deg, ${C.ok} 0 8px, transparent 8px 13px)` }} />
                média das semanas
                <b className="rounded-xl bg-emerald-400/15 px-3 py-0.5 text-[3vh] font-black text-emerald-300 tabular-nums">{fmt(g.media, "%")}</b>
              </span>
            )}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={g.semanas} margin={{ top: 24, right: 190, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} width={56} domain={[(min: number) => Math.max(0, Math.floor(min / 10) * 10 - 10), 100]} tickFormatter={(v) => `${v}%`} />
            {g.media !== null && (
              <ReferenceLine
                y={g.media}
                stroke={C.ok}
                strokeOpacity={0.85}
                strokeWidth={2.5}
                strokeDasharray="8 6"
                label={etiquetaMedia(`média ${fmt(g.media, "%")}`, C.ok, 24)}
              />
            )}
            <Line dataKey="taxa" stroke={C.ok} strokeWidth={4.5} dot={{ r: 4, fill: C.ok }} connectNulls animationDuration={1200}>
              <LabelList dataKey="taxa" position="top" formatter={(v: unknown) => (typeof v === "number" ? `${Math.round(v)}` : "")} style={{ fill: "#d1fae5", fontSize: 14, fontWeight: 700 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Caixa>
    </div>
  );
}

function DiaSemana({ g }: { g: Extract<GraficoTv, { tipo: "dia_semana" }> }) {
  const max = Math.max(...g.dias.map((d) => d.media));
  const melhor = g.dias.find((d) => d.media === max);
  return (
    <div className="flex flex-1 flex-col gap-[1.4vh] py-[1vh]">
      <Caixa
        className="flex-1"
        titulo={
          <div className="flex items-baseline justify-between">
            <span>Média de agendamentos válidos da equipe em cada dia da semana</span>
            {melhor && (
              <span>
                dia mais forte: <b style={{ color: C.ouro }}>{melhor.rotulo}</b>
              </span>
            )}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={g.dias} margin={{ top: 36, right: 18, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="rotulo" tick={{ ...EIXO, fontSize: 22, fontWeight: 700 }} tickLine={false} axisLine={false} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} width={44} />
            <Bar dataKey="media" radius={[10, 10, 0, 0]} animationDuration={1000}>
              {g.dias.map((d) => (
                <Cell key={d.rotulo} fill={d.media === max ? C.ouro : C.atual} fillOpacity={d.media === max ? 1 : 0.75} />
              ))}
              <LabelList dataKey="media" position="top" formatter={(v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : "")} style={{ fill: "#fff", fontSize: 22, fontWeight: 800 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Caixa>
    </div>
  );
}

function ConsultasDiaADia({ g }: { g: Extract<GraficoTv, { tipo: "consultas_dia_a_dia" }> }) {
  return (
    <div className="flex flex-1 flex-col gap-[1.4vh] py-[1vh]">
      <Caixa
        className="flex-1"
        titulo={
          <Legenda
            itens={[
              { cor: C.atual, texto: "Marcadas para o dia" },
              { cor: C.ok, texto: "Compareceram" },
              { cor: "rgba(56,189,248,0.35)", texto: "Dias que ainda vão chegar" },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={g.dias} margin={{ top: 16, right: 18, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="d" {...eixoDias(g.dias.map((x) => x.data), EIXO_DIAS_TV)} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
            <Bar dataKey="marcadas" radius={[6, 6, 0, 0]}>
              {g.dias.map((d) => (
                <Cell key={d.d} fill={C.atual} fillOpacity={d.futuro ? 0.35 : 0.9} />
              ))}
            </Bar>
            <Bar dataKey="compareceram" fill={C.ok} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Caixa>
    </div>
  );
}

function DozeMeses({ g }: { g: Extract<GraficoTv, { tipo: "doze_meses" }> }) {
  return (
    <div className="flex flex-1 flex-col gap-[1.4vh] py-[1vh]">
      <Caixa className="flex-1" titulo={<Legenda itens={[{ cor: C.atual, texto: "Agendamentos válidos da equipe" }, { cor: C.ouro, texto: "Meta", tracejado: true }]} />}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={g.meses} margin={{ top: 26, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} width={56} allowDecimals={false} />
            <Line dataKey="meta" stroke={C.ouro} strokeWidth={3} strokeDasharray="8 6" dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="validos" stroke={C.atual} strokeWidth={4.5} dot={{ r: 5, fill: C.atual }} animationDuration={1200}>
              <LabelList dataKey="validos" position="top" style={{ fill: "#e0f2fe", fontSize: 16, fontWeight: 700 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Caixa>
    </div>
  );
}

export function TelaGrafico({ tela }: { tela: TelaTv }) {
  const g = tela.grafico!;
  switch (g.tipo) {
    case "mes_dia_a_dia":
      return <MesDiaADia g={g} />;
    case "semanas":
      return <Semanas g={g} />;
    case "comparecimento_semanas":
      return <ComparecimentoSemanas g={g} />;
    case "dia_semana":
      return <DiaSemana g={g} />;
    case "consultas_dia_a_dia":
      return <ConsultasDiaADia g={g} />;
    case "doze_meses":
      return <DozeMeses g={g} />;
  }
}

/** Linha pequena embaixo do card da Visão Geral: o período da tela, com o período anterior tracejado. */
export function LinhaPeriodo({ linha, cat, cor }: { linha: LinhaEquipe; cat: "particular" | "sus"; cor: string }) {
  const valores = cat === "particular" ? linha.particular : linha.sus;
  const anteriores = cat === "particular" ? linha.particularAnt : linha.susAnt;
  const max = Math.max(1, ...valores, ...(anteriores ?? []).map((v) => v ?? 0));
  const w = 100;
  const h = 30;
  const xy = (v: number, i: number) => `${(i / Math.max(1, valores.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`;
  const pts = valores.map(xy).join(" ");
  const ptsAnt = anteriores ? anteriores.flatMap((v, i) => (v === null ? [] : [xy(v, i)])).join(" ") : "";
  const maior = Math.max(...valores);
  const diaMaior = linha.dias[valores.indexOf(maior)];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[1.6vh] text-sky-200/70">
        <span className="flex items-center gap-2">
          <span className="inline-block h-[0.4vh] w-6 rounded-full" style={{ background: cor }} />
          {linha.rotulo} · {linha.dias[0]} a {linha.dias[linha.dias.length - 1]}
          {linha.comparado && (
            <>
              <span
                className="ml-2 inline-block h-[0.4vh] w-6 rounded-full"
                style={{ background: "repeating-linear-gradient(90deg, rgba(148,163,184,0.9) 0 4px, transparent 4px 7px)" }}
              />
              {linha.comparado}
            </>
          )}
        </span>
        <span>
          {linha.hoje && (
            <>
              hoje <b className="text-white">{valores[valores.length - 1] ?? 0}</b> ·{" "}
            </>
          )}
          melhor dia <b className="text-white">{maior}</b>
          {maior > 0 && diaMaior ? ` (${diaMaior})` : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-[0.6vh] h-[7vh] w-full" aria-hidden>
        {ptsAnt && (
          <polyline points={ptsAnt} fill="none" stroke="rgba(148,163,184,0.75)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
        )}
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill={cor} fillOpacity={0.15} stroke="none" />
        <polyline points={pts} fill="none" stroke={cor} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
      </svg>
    </div>
  );
}
