"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { nomeCompetencia } from "@/engine/datas";
import type { PayloadTv, TelaTv } from "@/lib/dados/tv";
import { AvatarAnimadoTv, RostinhoExpressao } from "./carinha";
import { ConfetesTv } from "./confetes";

// Gradientes horizontais para as barras conforme posição (inspirados na imagem de referência)
const GRADIENTES_BARRAS = [
  "linear-gradient(90deg, #1d4ed8 0%, #2563eb 45%, #38bdf8 100%)", // 1º Azul vibrante para ciano brilhante
  "linear-gradient(90deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%)", // 2º Ciano piscina
  "linear-gradient(90deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)", // 3º Roxo violeta neon
  "linear-gradient(90deg, #0d9488 0%, #14b8a6 55%, #2dd4bf 100%)", // 4º Turquesa esmeralda
  "linear-gradient(90deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)", // 5º Índigo lavanda
  "linear-gradient(90deg, #059669 0%, #10b981 55%, #34d399 100%)", // 6º+ Verde menta
];

// Cores de contorno do avatar
const CORES_AVATAR = ["#38bdf8", "#38bdf8", "#c084fc", "#2dd4bf", "#818cf8", "#34d399"];

// Sombras com glow de cor correspondente
const SOMBRAS_BARRAS = [
  "rgba(56, 189, 248, 0.35)",
  "rgba(14, 165, 233, 0.3)",
  "rgba(168, 85, 247, 0.3)",
  "rgba(45, 212, 191, 0.3)",
  "rgba(129, 140, 248, 0.3)",
  "rgba(52, 211, 153, 0.3)",
];

// Frases motivacionais e institucionais que rotacionam no rodapé
const FRASES_RODAPE = [
  "Grandes conquistas começam com uma equipe unida.",
  "Cada agendamento aproxima a nossa equipe da superação.",
  "Consistência e dedicação transformam metas em grandes conquistas.",
  "Estamos evoluindo juntos, com foco e alta performance.",
  "Cada conquista importa para o sucesso de todos nós.",
  "Seguimos crescendo e construindo o nosso melhor resultado.",
];

// Subtítulos dinâmicos e corporativos para o cabeçalho
const SUBTITULOS_CABECALHO = [
  "Ritmo contínuo, consistência e excelência em cada atendimento",
  "Evolução diária da equipe rumo à superação de metas",
  "Foco no paciente, agilidade e resultados de alto impacto",
  "Dedicação diária construindo grandes realizações",
];

/** /tv/demo: dados fictícios que crescem sozinhos para ver o layout em ação */
function dadosDemo(passo: number): PayloadTv {
  const base = [100, 78, 53, 28, 15];
  const cresc = [4, 5, 3, 6, 2];
  const itens = (fator: number) =>
    base
      .map((b, i) => {
        const valor = Math.round((b + cresc[i] * passo) * fator);
        const ating = (valor / (70 * fator)) * 100;
        return {
          id: `demo${i}`,
          valor,
          atingimento: ating,
          carinha: (ating >= 120 ? "mega_feliz" : ating >= 80 ? "feliz" : "neutra") as "neutra" | "feliz" | "mega_feliz",
        };
      })
      .sort((a, b) => b.valor - a.valor);

  const hoje = new Date().getDate();
  return {
    nome: "Demonstração",
    equipes: ["Equipe Comercial"],
    competencia: new Date().toISOString().slice(0, 7),
    atualizado_em: new Date().toISOString(),
    config: { intervalo: 16, modos: [], limites: { feliz: 80, mega_feliz: 120 } },
    telas: [
      { tipo: "barras", titulo: "Agendamentos do Mês", unidade: "un", itens: itens(1) },
      { tipo: "barras", titulo: "Consultas Realizadas", unidade: "un", itens: itens(0.7) },
      { tipo: "barras", titulo: "SUS · Agendamentos", unidade: "un", itens: itens(0.4) },
      {
        tipo: "geral",
        titulo: "Visão Geral da Equipe",
        geral: {
          indicadores: [
            { titulo: "Agendamentos", realizado: 274 + passo * 18, meta: 300, pct: ((274 + passo * 18) / 300) * 100, unidade: "un" },
            { titulo: "Consultas realizadas", realizado: 174 + passo * 10, meta: 180, pct: ((174 + passo * 10) / 180) * 100, unidade: "un" },
            { titulo: "Taxa de conversão", realizado: 63.5, meta: null, pct: null, unidade: "%" },
            { titulo: "SUS · agendamentos", realizado: 64 + passo * 5, meta: null, pct: null, unidade: "un" },
          ],
          series: [
            { chave: "agendamentos", rotulo: "Agendamentos" },
            { chave: "realizadas", rotulo: "Consultas realizadas" },
          ],
          serie: Array.from({ length: 30 }, (_, d) => ({
            dia: String(d + 1).padStart(2, "0"),
            agendamentos: d < hoje ? Math.round((d + 1) * 9.5) : null,
            realizadas: d < hoje ? Math.round((d + 1) * 5.6) : null,
          })),
          carinhas: { mega_feliz: 2, feliz: 2, neutra: 1 },
          pessoas: 5,
        },
      },
    ],
  };
}

function fmt(n: number, unidade?: string) {
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 0 });
  return unidade === "%" ? `${s}%` : s;
}

/** Hook do Relógio em tempo real com hora, minuto e segundos */
function useRelogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const atualizar = () => setAgora(new Date());
    atualizar();
    const t = setInterval(atualizar, 1000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

/** Mensagem motivacional/estágio dinâmica exibida discretamente dentro da barra */
function TextoDinamicoBarra({
  atingimento,
  valor,
  pos,
}: {
  atingimento: number | null;
  valor: number;
  pos: number;
}) {
  const [indiceMsg, setIndiceMsg] = useState(0);

  const mensagens = useMemo(() => {
    if (atingimento !== null && atingimento >= 100) {
      const superacao = Math.round(atingimento - 100);
      const msgs = ["Meta batida! 🎯", "Excelente resultado! ⭐"];
      if (superacao > 0) {
        msgs.push(`Meta superada (+${superacao}%) 🚀`);
      }
      return msgs;
    }
    if (atingimento !== null && atingimento >= 80) {
      return ["Falta pouco! 🔥", "Na reta final!", "Excelente resultado!"];
    }
    if (pos === 0 && valor > 0) {
      return ["Liderando o ranking! 🌟", "Excelente ritmo!", "Seguimos crescendo!"];
    }
    return ["Vamos lá! 💪", "Estamos evoluindo!", "Cada conquista importa!", "Seguimos crescendo!"];
  }, [atingimento, valor, pos]);

  useEffect(() => {
    const tempo = 6500 + (pos % 3) * 1200;
    const interval = setInterval(() => {
      setIndiceMsg((prev) => (prev + 1) % mensagens.length);
    }, tempo);
    return () => clearInterval(interval);
  }, [mensagens.length, pos]);

  const mensagemAtual = mensagens[indiceMsg % mensagens.length];

  return (
    <div className="flex h-full items-center overflow-hidden pl-5 pr-2 select-none">
      <AnimatePresence mode="wait">
        <motion.span
          key={mensagemAtual}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 0.95, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.4 }}
          className="truncate text-[1.85vh] font-semibold tracking-wide text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
        >
          {mensagemAtual}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** Ícone de Troféu Neon estilizado com contorno brilhante (idêntico à referência) */
function IconeTrofeuNeon() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow externo */}
      <div className="absolute inset-0 rounded-full bg-sky-400/20 blur-xl" />
      <svg
        width="60"
        height="60"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative drop-shadow-[0_0_14px_rgba(56,189,248,0.7)]"
      >
        {/* Taça principal */}
        <path
          d="M18 12 H46 V24 C46 32 39 38 32 38 C25 38 18 32 18 24 Z"
          stroke="#38bdf8"
          strokeWidth="3.2"
          fill="rgba(56, 189, 248, 0.12)"
          strokeLinejoin="round"
        />
        {/* Asa esquerda */}
        <path
          d="M18 16 H12 C9.5 16 8 18 8 21 C8 26 12 28 18 28"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Asa direita */}
        <path
          d="M46 16 H52 C54.5 16 56 18 56 21 C56 26 52 28 46 28"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Haste central */}
        <path d="M32 38 V48" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        {/* Base */}
        <path d="M22 48 H42 V54 H22 Z" stroke="#38bdf8" strokeWidth="3" fill="rgba(56, 189, 248, 0.2)" strokeLinejoin="round" />
        {/* Estrela de destaque no centro da taça */}
        <path
          d="M32 18 L33.8 21.8 L38 22.4 L35 25.3 L35.7 29.5 L32 27.5 L28.3 29.5 L29 25.3 L26 22.4 L30.2 21.8 Z"
          fill="#38bdf8"
          className="drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
        />
      </svg>
    </div>
  );
}

/** Ícone de Tendência / Crescimento do Rodapé */
function IconeTendencia() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]">
      <path d="M3 17 L9 11 L13 15 L21 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7 H21 V13" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Visualização principal do Ranking em Barras */
function TelaBarras({ tela }: { tela: TelaTv }) {
  const itens = tela.itens ?? [];
  const maxValor = Math.max(1, ...itens.map((i) => i.valor));

  return (
    <LayoutGroup>
      <ul className="flex flex-1 flex-col justify-center gap-[2.4vh] py-[1.5vh]">
        {itens.map((it, pos) => {
          const gradiente = GRADIENTES_BARRAS[pos % GRADIENTES_BARRAS.length];
          const corAvatar = CORES_AVATAR[pos % CORES_AVATAR.length];
          const sombra = SOMBRAS_BARRAS[pos % SOMBRAS_BARRAS.length];

          // Comprimento proporcional dinâmico ao maior valor atual do ranking (max ~76% da tela para deixar margem confortável para o número colado)
          const pctLargura = Math.max(12, (it.valor / maxValor) * 75);

          return (
            <motion.li
              key={it.id}
              layout
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              className="relative flex items-center"
            >
              {/* Posição solta (1º, 2º, 3º...) - sem balão/box em volta, como pedido */}
              <div className="w-[5.2vw] flex-shrink-0 text-left">
                <span
                  className={`text-[3.6vh] font-bold tracking-tight tabular-nums select-none ${
                    pos === 0
                      ? "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]"
                      : pos === 1
                        ? "text-sky-100"
                        : "text-white/80"
                  }`}
                >
                  {pos + 1}º
                </span>
              </div>

              {/* Área da Barra: SEM nenhuma barra/trilha cinza de fundo! */}
              <div className="relative flex flex-1 items-center">
                {/* A barra que cresce continuamente para a direita */}
                <motion.div
                  className="relative flex items-center h-[58px] rounded-full"
                  style={{
                    background: gradiente,
                    boxShadow: `0 4px 20px -2px ${sombra}`,
                  }}
                  initial={{ width: "80px" }}
                  animate={{ width: `${pctLargura}%` }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Mensagem motivacional dinâmica dentro da barra preenchida */}
                  {pctLargura > 18 && (
                    <div className="flex-1 overflow-hidden pr-8">
                      <TextoDinamicoBarra atingimento={it.atingimento} valor={it.valor} pos={pos} />
                    </div>
                  )}

                  {/* Ponta da barra: Avatar animado na extremidade + Número de agendamentos colado */}
                  <div className="absolute -right-7 top-1/2 -translate-y-1/2 z-20 flex items-center">
                    <AvatarAnimadoTv
                      tipo={it.carinha}
                      cor={corAvatar}
                      tamanho={56}
                      posicao={pos}
                      atingimento={it.atingimento}
                    />

                    {/* Número total de agendamentos COLADO perto do círculo */}
                    <span className="ml-3.5 text-[3.8vh] font-black text-white tabular-nums tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                      {fmt(it.valor, tela.unidade)}
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.li>
          );
        })}

        {!itens.length && (
          <li className="flex flex-1 items-center justify-center text-center text-[3vh] text-sky-200/50">
            Nenhum registro apurado para este indicador no momento.
          </li>
        )}
      </ul>
    </LayoutGroup>
  );
}

/** Tela Geral (Visão Geral com Indicadores e Gráfico) */
function TelaGeral({ tela }: { tela: TelaTv }) {
  const g = tela.geral!;
  return (
    <div className="grid flex-1 grid-cols-12 gap-[2vh] py-[1.5vh]">
      <div className="col-span-12 grid grid-cols-2 gap-[2vh] lg:grid-cols-4">
        {g.indicadores.map((i) => (
          <div
            key={i.titulo}
            className="rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0e2246]/60 to-[#071329]/80 p-[2.4vh] shadow-xl backdrop-blur-md"
          >
            <div className="text-[2.2vh] font-medium text-sky-200/70">{i.titulo}</div>
            <div className="mt-1 text-[5.6vh] leading-none font-extrabold text-white tabular-nums drop-shadow-sm">
              {fmt(i.realizado, i.unidade)}
            </div>
            {i.meta ? (
              <>
                <div className="mt-2 text-[2vh] text-sky-300/60">meta {fmt(i.meta, i.unidade)}</div>
                <div className="mt-2 h-[1.2vh] overflow-hidden rounded-full bg-sky-950/60 border border-sky-500/30">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, i.pct ?? 0)}%` }}
                    transition={{ duration: 1.4 }}
                  />
                </div>
                <div className="mt-1 text-[2.2vh] font-semibold text-cyan-300">{fmt(i.pct ?? 0, "%")}</div>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="col-span-12 rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0e2246]/60 to-[#071329]/80 p-[2.4vh] shadow-xl backdrop-blur-md lg:col-span-8">
        <div className="mb-2 flex flex-wrap gap-6 text-[2.2vh] text-sky-100/90 font-medium">
          {g.series.map((s, i) => (
            <span key={s.chave} className="flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-6 rounded-full"
                style={{ background: i === 0 ? "#38bdf8" : "#a855f7" }}
              />
              {s.rotulo} (acumulado)
            </span>
          ))}
        </div>
        <div className="h-[34vh]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={g.serie} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <XAxis dataKey="dia" stroke="#38bdf880" tickLine={false} axisLine={false} fontSize={14} minTickGap={20} />
              <YAxis stroke="#38bdf880" tickLine={false} axisLine={false} fontSize={14} width={44} allowDecimals={false} />
              {g.series.map((s, i) => (
                <Line
                  key={s.chave}
                  dataKey={s.chave}
                  stroke={i === 0 ? "#38bdf8" : "#a855f7"}
                  strokeWidth={3.5}
                  dot={false}
                  isAnimationActive="auto"
                  animationDuration={1500}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="col-span-12 flex flex-col justify-center gap-[2vh] rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0e2246]/60 to-[#071329]/80 p-[2.4vh] shadow-xl backdrop-blur-md lg:col-span-4">
        <div className="text-[2.4vh] font-semibold text-sky-100">Como a equipe está</div>
        {(
          [
            ["mega_feliz", "Meta Superada", "#a855f7"],
            ["feliz", "Meta Atingida", "#38bdf8"],
            ["neutra", "Em Andamento", "#2dd4bf"],
          ] as const
        ).map(([t, rotulo, cor]) => (
          <div key={t} className="flex items-center gap-4">
            <RostinhoExpressao tipo={t} cor={cor} tamanho={58} />
            <span className="flex-1 text-[2.5vh] font-medium text-white">{rotulo}</span>
            <span className="text-[4.8vh] font-black text-white tabular-nums drop-shadow-sm">{g.carinhas[t]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TvCliente({ token }: { token: string }) {
  const [dados, setDados] = useState<PayloadTv | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [fraseRodapeIdx, setFraseRodapeIdx] = useState(0);
  const [subtituloIdx, setSubtituloIdx] = useState(0);
  const [dispararConfetes, setDispararConfetes] = useState(false);
  const agora = useRelogio();

  // Rotação da frase motivacional do rodapé a cada 8 segundos
  useEffect(() => {
    const t = setInterval(() => {
      setFraseRodapeIdx((prev) => (prev + 1) % FRASES_RODAPE.length);
    }, 8500);
    return () => clearInterval(t);
  }, []);

  // Rotação do subtítulo a cada 12 segundos
  useEffect(() => {
    const t = setInterval(() => {
      setSubtituloIdx((prev) => (prev + 1) % SUBTITULOS_CABECALHO.length);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  // Efeito de confetes quando alguém bate a meta
  useEffect(() => {
    if (!dados) return;
    const temAlguemComMetaBatida = dados.telas.some((t) =>
      t.itens?.some((i) => i.carinha === "mega_feliz" || (i.atingimento !== null && i.atingimento >= 100))
    );

    if (temAlguemComMetaBatida) {
      setDispararConfetes(true);
      const timer = setTimeout(() => setDispararConfetes(false), 5000);
      // Salva periódica de confetes a cada 75s se a meta continuar batida
      const intervaloConfetes = setInterval(() => {
        setDispararConfetes(true);
        setTimeout(() => setDispararConfetes(false), 5000);
      }, 75000);

      return () => {
        clearTimeout(timer);
        clearInterval(intervaloConfetes);
      };
    }
  }, [dados]);

  // Carregamento de dados (demo ou token real)
  useEffect(() => {
    if (token === "demo") {
      let passo = 0;
      const t0 = setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const inicial = Number(params.get("tela") ?? "1") - 1;
        if (inicial > 0 && inicial < 4) setIndice(inicial);
        setDados(dadosDemo(0));
      }, 0);
      const t = setInterval(() => setDados(dadosDemo(++passo % 8)), 5000);
      return () => {
        clearTimeout(t0);
        clearInterval(t);
      };
    }

    let vivo = true;
    async function carregar() {
      try {
        const r = await fetch(`/api/tv/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (r.status === 404) {
          if (vivo) setErro("Painel desativado ou link inválido.");
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as PayloadTv;
        if (vivo) {
          setDados(d);
          setErro(null);
        }
      } catch {
        if (vivo) setErro((e) => e ?? "Reconectando…");
      }
    }
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token]);

  const telas = useMemo(() => dados?.telas ?? [], [dados]);
  const intervalo = Math.max(10, dados?.config.intervalo ?? 30) * 1000;

  useEffect(() => {
    if (telas.length < 1) return;
    const t = setInterval(() => {
      setIndice((i) => (i + 1) % telas.length);
    }, intervalo);
    return () => clearInterval(t);
  }, [telas.length, intervalo]);

  const tela = telas[indice % Math.max(1, telas.length)];

  return (
    <main className="fixed inset-0 flex cursor-none flex-col overflow-hidden bg-[#030914] px-[3.5vw] py-[3.2vh] text-white select-none">
      {/* Confetes animados em canvas quando houver meta batida */}
      <ConfetesTv disparar={dispararConfetes} />

      {/* Camada de Fundo Estilizado idêntica à referência (Glows neon e reflexos tecnológicos) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Gradiente radial de profundidade central */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_35%,#0a1d3f_0%,#040c1d_55%,#020611_100%)]" />

        {/* Efeito circular tecnológico no canto superior direito (inspirado na íris da imagem de referência) */}
        <div className="absolute -top-[16vw] -right-[16vw] h-[52vw] w-[52vw] rounded-full border border-sky-500/10 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14)_0%,rgba(14,165,233,0.04)_40%,transparent_70%)] blur-2xl" />
        <div className="absolute -top-[8vw] -right-[8vw] h-[36vw] w-[36vw] rounded-full border border-sky-400/15" />
        <div className="absolute -top-[2vw] -right-[2vw] h-[24vw] w-[24vw] rounded-full border border-cyan-400/20" />

        {/* Glow neon azul sutil no canto inferior direito */}
        <div className="absolute -bottom-[15vh] -right-[10vw] h-[40vh] w-[45vw] rounded-full bg-blue-600/10 blur-3xl" />
        {/* Glow ciano no canto inferior esquerdo */}
        <div className="absolute -bottom-[20vh] -left-[10vw] h-[40vh] w-[40vw] rounded-full bg-cyan-600/10 blur-3xl" />
      </div>

      {/* CABEÇALHO (Header executivo corporativo idêntico à referência com hora) */}
      <header className="relative z-10 flex items-center justify-between">
        {/* Esquerda: Troféu Neon + Linha Divisória + Título & Subtítulo */}
        <div className="flex items-center gap-5">
          <IconeTrofeuNeon />

          {/* Linha vertical divisória iluminada */}
          <div className="h-12 w-[2px] bg-gradient-to-b from-sky-400/10 via-sky-400/50 to-sky-400/10" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[4.6vh] font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(56,189,248,0.3)]">
                {tela?.titulo ?? "Desempenho da Equipe"}
              </h1>
              {dados?.equipes?.[0] && (
                <span className="ml-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[1.6vh] font-semibold text-sky-300">
                  {dados.equipes.join(" · ")}
                </span>
              )}
            </div>

            {/* Subtítulo dinâmico corporativo e motivacional */}
            <div className="mt-0.5 h-[2.5vh] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={subtituloIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.5 }}
                  className="text-[2.1vh] font-medium text-sky-200/70"
                >
                  {SUBTITULOS_CABECALHO[subtituloIdx]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Direita: Relógio grande e nítido + Data por extenso */}
        <div className="text-right">
          <div className="text-[5.4vh] font-black tracking-tight text-white tabular-nums drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]">
            {agora
              ? agora.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Bahia",
                })
              : "--:--"}
          </div>
          <div className="text-[1.8vh] font-medium text-sky-200/60 capitalize">
            {agora
              ? agora.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "America/Bahia",
                })
              : erro ?? "Sincronizado"}
          </div>
        </div>
      </header>

      {/* ÁREA CENTRAL: Ranking em Barras ou Visão Geral */}
      <div className="relative z-10 mt-[2vh] flex flex-1 flex-col">
        {tela && (
          <div
            key={`${indice}-${tela.titulo}`}
            className="animate-in fade-in flex flex-1 flex-col duration-700 motion-reduce:animate-none"
          >
            {tela.tipo === "barras" ? <TelaBarras tela={tela} /> : <TelaGeral tela={tela} />}
          </div>
        )}
      </div>

      {/* RODAPÉ: Mensagem dinâmica que muda com frequência + Linha de gradiente */}
      <footer className="relative z-10 mt-[2vh] flex flex-col gap-2">
        {/* Linha horizontal com gradiente brilhante azul/ciano na base */}
        <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

        <div className="flex items-center justify-between pt-1">
          {/* Mensagem dinâmica com ícone de crescimento */}
          <div className="flex items-center gap-3">
            <IconeTendencia />
            <AnimatePresence mode="wait">
              <motion.span
                key={fraseRodapeIdx}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.5 }}
                className="text-[2.2vh] font-semibold text-slate-200"
              >
                {FRASES_RODAPE[fraseRodapeIdx]}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Paginação discreta das telas e marca */}
          <div className="flex items-center gap-3">
            {telas.length > 1 && (
              <div className="flex items-center gap-1.5">
                {telas.map((t, i) => (
                  <span
                    key={`${t.titulo}-${i}`}
                    className={`h-[0.7vh] rounded-full transition-all duration-500 ${
                      i === indice % telas.length ? "w-6 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" : "w-2 bg-white/20"
                    }`}
                  />
                ))}
              </div>
            )}
            <span className="text-[1.8vh] font-semibold tracking-wider text-sky-400/50 uppercase">
              Trackco · IOBA
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
