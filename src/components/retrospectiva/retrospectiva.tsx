"use client";

import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { obterRetrospectiva } from "@/app/(app)/acoes-retrospectiva";
import { ConfetesTv, type DisparoConfete } from "@/app/tv/[token]/confetes";
import { Button } from "@/components/ui/button";
import type { Retrospectiva } from "@/lib/dados/retrospectiva";

const SEGUNDOS = 7;
const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function useLocal(chave: string) {
  const ler = () => {
    try {
      return localStorage.getItem(chave) === "1";
    } catch {
      return false;
    }
  };
  const marcar = () => {
    try {
      localStorage.setItem(chave, "1");
    } catch {
      /* navegador sem armazenamento: só não lembra */
    }
  };
  return { ler, marcar };
}

/** Número que "conta" até o valor (respeita quem prefere menos movimento). */
function Contagem({ valor, sufixo = "" }: { valor: number; sufixo?: string }) {
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = requestAnimationFrame(() => setAtual(valor));
      return () => cancelAnimationFrame(t);
    }
    let id = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      setAtual(valor * (1 - Math.pow(1 - p, 3)));
      if (p < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [valor]);
  return (
    <span className="tabular-nums">
      {Number.isInteger(valor) ? Math.round(atual).toLocaleString("pt-BR") : n(atual)}
      {sufixo}
    </span>
  );
}

const Grande = ({ children }: { children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, type: "spring", stiffness: 120 }} className="text-7xl font-black tracking-tight sm:text-8xl">
    {children}
  </motion.div>
);
const Linha = ({ children, atraso = 0.6, className = "" }: { children: React.ReactNode; atraso?: number; className?: string }) => (
  <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: atraso }} className={`text-lg leading-snug ${className}`}>
    {children}
  </motion.p>
);
const Selo = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur">{children}</span>
);

interface Slide {
  fundo: string;
  festa?: boolean;
  conteudo: React.ReactNode;
}

function montarSlides(d: Retrospectiva, fechar: () => void): Slide[] {
  const s: Slide[] = [];
  const eq = d.equipe;
  const eu = d.eu;
  const mes = maiuscula(d.mes);

  s.push({
    fundo: "from-[#1c5cab] via-[#3b3fd1] to-[#7c3aed]",
    conteudo: (
      <>
        <Linha atraso={0.1} className="text-white/80">
          Retrospectiva Trackco
        </Linha>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-5xl font-black tracking-tight">
          {eu ? `Seu ${d.mes}` : `${mes} da equipe ${d.equipeNome}`}
        </motion.h2>
        <Linha atraso={0.8}>{eu ? `${d.primeiroNome}, bora relembrar como foi o seu mês?` : "Como foi o mês da equipe, em poucos toques."}</Linha>
      </>
    ),
  });

  const numeros = eu ?? eq;
  s.push({
    fundo: "from-[#0f766e] via-[#0e7490] to-[#1c5cab]",
    conteudo: (
      <>
        <Linha atraso={0.1}>{eu ? "Em " + d.mes + ", você marcou" : "Em " + d.mes + ", a equipe marcou"}</Linha>
        <Grande>
          <Contagem valor={numeros.validos} />
        </Grande>
        <Linha>pacientes válidos (remarcação não conta duas vezes)</Linha>
        {numeros.crescimento !== null && numeros.crescimento > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
            <Selo>📈 +{n(numeros.crescimento)}% em relação a {d.mesAnterior}</Selo>
          </motion.div>
        ) : numeros.validosAnt > 0 ? (
          <Linha atraso={1.2} className="text-white/75">
            Em {d.mesAnterior} foram {numeros.validosAnt}.
          </Linha>
        ) : null}
        {numeros.total > numeros.validos && (
          <Linha atraso={1.5} className="text-sm text-white/70">
            {numeros.total} marcações no total, contando remarcações, bloqueios e erros.
          </Linha>
        )}
      </>
    ),
  });

  if (numeros.melhorDia)
    s.push({
      fundo: "from-[#b45309] via-[#c2410c] to-[#be185d]",
      conteudo: (
        <>
          <Linha atraso={0.1}>{eu ? "Seu dia mais forte foi" : "O dia mais forte da equipe foi"}</Linha>
          <Grande>{maiuscula(numeros.melhorDia.dia)}</Grande>
          <Linha>
            <b>{numeros.melhorDia.valor}</b> pacientes válidos marcados num dia só
          </Linha>
          {eu?.recordeDia && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 }}>
              <Selo>🏆 Seu recorde dos últimos 12 meses</Selo>
            </motion.div>
          )}
        </>
      ),
    });

  if (numeros.taxa !== null)
    s.push({
      fundo: "from-[#047857] via-[#059669] to-[#0d9488]",
      conteudo: (
        <>
          <Linha atraso={0.1}>{eu ? "Dos pacientes que você marcou para " + d.mes : "Dos pacientes marcados para " + d.mes}</Linha>
          <Grande>
            <Contagem valor={numeros.taxa} sufixo="%" />
          </Grande>
          <Linha>vieram à consulta</Linha>
          <Linha atraso={1.1} className="text-white/80">
            De cada 10, {Math.round(numeros.taxa / 10)} compareceram.
            {numeros.taxaAnt !== null && numeros.taxa > numeros.taxaAnt && ` Melhor que ${d.mesAnterior} (${n(numeros.taxaAnt)}%).`}
          </Linha>
        </>
      ),
    });

  // "Você sabia?": uma comparação por tela, no estilo "você está entre os 2% que mais ouviram"
  const FUNDOS_CURIOSIDADE = [
    "from-[#0c4a6e] via-[#0369a1] to-[#0891b2]",
    "from-[#4c1d95] via-[#6d28d9] to-[#9333ea]",
    "from-[#9a3412] via-[#c2410c] to-[#d97706]",
    "from-[#134e4a] via-[#0f766e] to-[#15803d]",
  ];
  d.curiosidades.forEach((c, i) =>
    s.push({
      fundo: FUNDOS_CURIOSIDADE[i % FUNDOS_CURIOSIDADE.length],
      festa: c.id === "ranking",
      conteudo: (
        <>
          <Linha atraso={0.1} className="text-sm font-semibold tracking-widest text-white/75 uppercase">
            Você sabia? {c.emoji}
          </Linha>
          <Linha atraso={0.3}>{c.antes}</Linha>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 120 }}
            className={`font-black tracking-tight ${c.destaque.length > 12 ? "text-4xl sm:text-5xl" : "text-6xl sm:text-7xl"}`}
          >
            {c.destaque}
          </motion.div>
          <Linha atraso={1}>{c.depois}</Linha>
        </>
      ),
    }),
  );

  if (eu?.conquistas.length)
    s.push({
      fundo: "from-[#7c3aed] via-[#a21caf] to-[#db2777]",
      festa: true,
      conteudo: (
        <>
          <Linha atraso={0.1}>Suas conquistas em {d.mes}</Linha>
          <ul className="space-y-3">
            {eu.conquistas.map((c, i) => (
              <motion.li
                key={c}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.35 }}
                className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 text-xl font-bold backdrop-blur"
              >
                <span className="text-2xl">{["🥇", "🚀", "✅", "🏆", "⚡", "🎯"][i % 6]}</span> {c}
              </motion.li>
            ))}
          </ul>
        </>
      ),
    });

  if (!eu && d.destaques?.length)
    s.push({
      fundo: "from-[#7c3aed] via-[#a21caf] to-[#db2777]",
      festa: true,
      conteudo: (
        <>
          <Linha atraso={0.1}>Destaques de {d.mes}</Linha>
          <ul className="space-y-3">
            {d.destaques.map((x, i) => (
              <motion.li
                key={x.titulo}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.35 }}
                className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur"
              >
                <div className="text-xs font-semibold tracking-wide text-white/75 uppercase">{x.titulo}</div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xl font-bold">{x.nome}</span>
                  <span className="text-2xl font-black tabular-nums">{x.valor}</span>
                </div>
                <div className="text-xs text-white/70">{x.detalhe}</div>
              </motion.li>
            ))}
          </ul>
          {!!d.metaBatida?.length && <Linha atraso={1.6}>🎯 Bateram a meta: {d.metaBatida.join(", ")}</Linha>}
        </>
      ),
    });

  if (eu)
    s.push({
      fundo: "from-[#1e3a8a] via-[#1c5cab] to-[#0891b2]",
      conteudo: (
        <>
          <Linha atraso={0.1}>Juntos, a equipe {d.equipeNome} marcou</Linha>
          <Grande>
            <Contagem valor={eq.validos} />
          </Grande>
          <Linha>pacientes válidos em {d.mes}</Linha>
          {eu.parteDaEquipe !== null && eu.parteDaEquipe > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
              <Selo>💙 {n(eu.parteDaEquipe)}% deles foram seus</Selo>
            </motion.div>
          )}
        </>
      ),
    });

  if (eu?.nivel)
    s.push({
      fundo: "from-[#0f172a] via-[#1e293b] to-[#334155]",
      conteudo: (
        <>
          <Linha atraso={0.1}>Seu nível em {d.mes}</Linha>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="inline-block rounded-2xl px-5 py-3 text-4xl font-black"
            style={{ background: eu.nivel.cor ?? "#1c5cab" }}
          >
            {eu.nivel.nome}
          </motion.div>
          {eu.nivel.nota !== null && (
            <Linha>{eu.nivel.nota >= 100 ? "Meta batida! 🎯" : `Você chegou a ${n(eu.nivel.nota)}% da meta. Cada dia conta em ${d.mesAtual}!`}</Linha>
          )}
        </>
      ),
    });

  s.push({
    fundo: "from-[#1c5cab] via-[#4338ca] to-[#7c3aed]",
    conteudo: (
      <>
        <Linha atraso={0.1}>{eu ? `Obrigado, ${d.primeiroNome}!` : "Obrigado, equipe!"}</Linha>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-5xl font-black tracking-tight">
          {maiuscula(d.mesAtual)} já começou
        </motion.h2>
        {eu?.metaAtual ? (
          <Linha>
            Sua meta de agendamentos válidos: <b>{eu.metaAtual}</b>
          </Linha>
        ) : (
          <Linha>Bora fazer um mês ainda melhor.</Linha>
        )}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="pt-4">
          <Button size="lg" variant="secondary" onClick={fechar}>
            Ver meu painel
          </Button>
        </motion.div>
        <Linha atraso={1.3} className="text-sm text-white/70">
          A retrospectiva fica disponível no Painel até o fim de {d.mesAtual}.
        </Linha>
      </>
    ),
  });
  return s;
}

function Historias({ dados, onFechar }: { dados: Retrospectiva; onFechar: () => void }) {
  const slides = montarSlides(dados, onFechar);
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [confete, setConfete] = useState<DisparoConfete | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);
  const ultimo = slides.length - 1;
  const ir = useCallback((d: number) => setI((x) => Math.min(ultimo, Math.max(0, x + d))), [ultimo]);

  useEffect(() => {
    if (pausado || i >= ultimo) return;
    const t = setTimeout(() => ir(1), SEGUNDOS * 1000);
    return () => clearTimeout(t);
  }, [i, pausado, ultimo, ir]);

  useEffect(() => {
    if (!slides[i]?.festa) return;
    const t = setTimeout(() => {
      const r = caixa.current?.getBoundingClientRect();
      if (r) setConfete({ id: Date.now(), x: r.left + r.width / 2, y: r.top + r.height * 0.3 });
    }, 500);
    return () => clearTimeout(t);
  }, [i, slides]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
      else if (e.key === "Escape") onFechar();
      else if (e.key === " ") {
        e.preventDefault();
        setPausado((p) => !p);
      }
    };
    window.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caixa.current?.focus();
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [ir, onFechar]);

  const slide = slides[i];
  return createPortal(
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <ConfetesTv disparo={confete} />
        <div
          ref={caixa}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Retrospectiva de ${dados.mes}`}
          className={`relative flex h-dvh w-full flex-col overflow-hidden bg-gradient-to-br text-white outline-none transition-colors duration-700 sm:h-[min(92dvh,820px)] sm:max-w-md sm:rounded-3xl sm:shadow-2xl ${slide.fundo}`}
          onPointerDown={() => setPausado(true)}
          onPointerUp={() => setPausado(false)}
          onPointerLeave={() => setPausado(false)}
        >
          {/* progresso de cada história */}
          <div className="flex gap-1 px-3 pt-3">
            {slides.map((_, k) => (
              <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white"
                  style={
                    k < i
                      ? { width: "100%" }
                      : k === i
                        ? { width: "100%", animation: `retro-barra ${SEGUNDOS}s linear forwards`, animationPlayState: pausado || i === ultimo ? "paused" : "running" }
                        : { width: 0 }
                  }
                  key={k === i ? `ativo-${i}` : k}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 pt-3 text-sm text-white/80">
            <span className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="size-4" /> Trackco · {dados.mes}
            </span>
            <button type="button" onClick={onFechar} aria-label="Fechar a retrospectiva" className="rounded-full p-1.5 hover:bg-white/20">
              <X className="size-5" />
            </button>
          </div>

          {/* toque à esquerda volta, à direita avança */}
          <button type="button" aria-label="História anterior" className="absolute inset-y-16 left-0 z-10 w-1/3" onClick={() => ir(-1)} />
          <button type="button" aria-label="Próxima história" className="absolute inset-y-16 right-0 z-10 w-2/3" onClick={() => ir(1)} />

          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-20 flex flex-1 flex-col justify-center gap-4 px-7 pb-10 [&_button]:pointer-events-auto pointer-events-none">
            {slide.conteudo}
          </motion.div>

          <div className="absolute right-0 bottom-3 left-0 z-20 hidden justify-between px-3 sm:flex">
            <button type="button" onClick={() => ir(-1)} disabled={i === 0} aria-label="Anterior" className="rounded-full bg-white/15 p-2 disabled:opacity-0">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => ir(1)} disabled={i === ultimo} aria-label="Próxima" className="rounded-full bg-white/15 p-2 disabled:opacity-0">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
        <style>{`@keyframes retro-barra { from { transform: translateX(-100%) } to { transform: translateX(0) } }`}</style>
      </div>
    </MotionConfig>,
    document.body,
  );
}

/**
 * Convite no Painel (o mês inteiro). Abre sozinho na primeira visita do mês e sempre que pedir.
 * "chave" identifica pessoa + mês para lembrar que já viu (só neste navegador).
 */
export function ConviteRetrospectiva({ mes, mesAtual, chave, equipe, abrir }: { mes: string; mesAtual: string; chave: string; equipe: boolean; abrir: boolean }) {
  const { ler, marcar } = useLocal(chave);
  const [dados, setDados] = useState<Retrospectiva | null>(null);
  const [estado, setEstado] = useState<"fechado" | "carregando" | "aberto" | "vazio">("fechado");

  const carregar = useCallback(() => {
    setEstado("carregando");
    void obterRetrospectiva().then((r) => {
      if (r.ok && r.dados) {
        setDados(r.dados);
        setEstado("aberto");
      } else setEstado("vazio");
    });
  }, []);

  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    if (abrir || !ler()) void Promise.resolve().then(carregar);
  }, [abrir, ler, carregar]);

  const fechar = useCallback(() => {
    marcar();
    setEstado("fechado");
  }, [marcar]);

  if (estado === "vazio") return null;
  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-[#1c5cab] via-[#4338ca] to-[#7c3aed] p-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between" data-tour="retrospectiva">
        <div className="flex items-center gap-3">
          <Sparkles className="size-6 shrink-0" />
          <div>
            <div className="font-semibold">{equipe ? `Retrospectiva de ${mes} da equipe` : `Sua retrospectiva de ${mes} está pronta`}</div>
            <div className="text-sm text-white/80">Fica disponível até o fim de {mesAtual}.</div>
          </div>
        </div>
        <Button variant="secondary" onClick={carregar} disabled={estado === "carregando"}>
          {estado === "carregando" ? "Preparando…" : "Ver retrospectiva"}
        </Button>
      </div>
      {estado === "aberto" && dados && <Historias dados={dados} onFechar={fechar} />}
    </>
  );
}
