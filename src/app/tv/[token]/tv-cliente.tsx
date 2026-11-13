"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConfigTv, ItemBarra, PayloadTv, TelaTv } from "@/lib/dados/tv";
import { AvatarPosicaoTv, corDaPosicao } from "./carinha";
import { ConfetesTv, type DisparoConfete } from "./confetes";
import { OlhoFundoIoba } from "./olho-fundo";

// Gradientes horizontais para as barras conforme posição
const GRADIENTES_BARRAS = [
  "linear-gradient(90deg, #1d4ed8 0%, #2563eb 45%, #38bdf8 100%)",
  "linear-gradient(90deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%)",
  "linear-gradient(90deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)",
  "linear-gradient(90deg, #0d9488 0%, #14b8a6 55%, #2dd4bf 100%)",
  "linear-gradient(90deg, #4338ca 0%, #6366f1 55%, #818cf8 100%)",
  "linear-gradient(90deg, #059669 0%, #10b981 55%, #34d399 100%)",
];

const SOMBRAS_BARRAS = [
  "rgba(56, 189, 248, 0.35)",
  "rgba(14, 165, 233, 0.3)",
  "rgba(168, 85, 247, 0.3)",
  "rgba(45, 212, 191, 0.3)",
  "rgba(129, 140, 248, 0.3)",
  "rgba(52, 211, 153, 0.3)",
];

// Cores fixas das séries (marcadas × realizadas) e da clínica
const COR_MARCADAS = "#38bdf8";
const COR_REALIZADAS = "#34d399";

const FRASES_RODAPE_PADRAO = [
  "Grandes conquistas começam com uma equipe unida.",
  "Cada agendamento aproxima a nossa equipe da superação.",
  "Consistência e dedicação transformam metas em grandes conquistas.",
  "Estamos evoluindo juntos, com foco e alta performance.",
  "Cada conquista importa para o sucesso de todos nós.",
  "Seguimos crescendo e construindo o nosso melhor resultado.",
];

const SUBTITULOS_PADRAO = [
  "Ritmo contínuo, consistência e excelência em cada atendimento",
  "Evolução diária da equipe rumo à superação de metas",
  "Foco no paciente, agilidade e resultados de alto impacto",
  "Dedicação diária construindo grandes realizações",
];

function fmt(n: number, unidade?: string) {
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 0 });
  return unidade === "%" ? `${s}%` : s;
}

/** /tv/demo: dados fictícios que crescem sozinhos para ver o layout em ação */
function dadosDemo(passo: number): PayloadTv {
  const codigos = ["4821", "1307", "7720", "5154", "2968"];
  const base = [100, 78, 53, 28, 15];
  const cresc = [4, 5, 3, 6, 2];
  const periodos = [
    { nome: "Hoje", datas: "sex, 13/11", emAndamento: true, f: 0.06 },
    { nome: "Esta semana", datas: "09/11 a 13/11", emAndamento: true, f: 0.3 },
    { nome: "Novembro até agora", datas: "01/11 a 13/11", emAndamento: true, f: 1 },
    { nome: "Outubro (mês passado)", datas: "01/10 a 31/10", emAndamento: false, f: 2.1 },
  ];
  const ranking = (f: number): ItemBarra[] =>
    base
      .map((b, i) => {
        const valor = Math.round((b + cresc[i] * passo) * f);
        const ating = (valor / (70 * f)) * 100;
        return {
          id: codigos[i],
          valor,
          atingimento: ating,
          carinha: (ating >= 120 ? "mega_feliz" : ating >= 80 ? "feliz" : "neutra") as ItemBarra["carinha"],
        };
      })
      .sort((a, b) => b.valor - a.valor);
  const telas: TelaTv[] = [];
  for (const sus of [false, true])
    for (const p of periodos) {
      const itens = ranking(p.f * (sus ? 0.35 : 1));
      telas.push({
        tipo: "barras",
        titulo: sus ? "SUS · Agendamentos" : "Agendamentos Particular",
        periodo: p,
        unidade: "un",
        itens,
        total: itens.reduce((s, i) => s + i.valor, 0),
      });
    }
  ranking(1).forEach((it, i) =>
    telas.push({
      tipo: "pessoa",
      titulo: "Consultas marcadas × realizadas",
      pessoa: {
        codigo: it.id,
        posicao: i + 1,
        carinha: it.carinha,
        periodos: periodos.map((p) => {
          const marcadas = Math.round((60 - i * 8) * p.f) + 1;
          return { nome: p.nome, datas: p.datas, marcadas, realizadas: Math.round(marcadas * (0.72 - i * 0.04)) };
        }),
      },
    }),
  );
  for (const p of periodos)
    telas.push({
      tipo: "equipe",
      titulo: "Visão Geral da Equipe",
      periodo: p,
      equipe: {
        pessoas: 5,
        agendamentosParticular: Math.round((274 + passo * 18) * p.f),
        agendamentosSus: Math.round((64 + passo * 5) * p.f),
        realizadasParticular: { equipe: Math.round(174 * p.f), clinica: Math.round(410 * p.f) },
        realizadasSus: { equipe: Math.round(40 * p.f), clinica: Math.round(290 * p.f) },
      },
    });
  return {
    nome: "Demonstração",
    equipes: ["Equipe Comercial"],
    competencia: new Date().toISOString().slice(0, 7),
    atualizado_em: new Date().toISOString(),
    config: { versao: 2, intervalo: 30, modos: [], limites: { feliz: 80, mega_feliz: 120 } },
    telas,
  };
}

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

function IconeTrofeuNeon() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-sky-400/20 blur-xl" />
      <svg width="60" height="60" viewBox="0 0 64 64" fill="none" className="relative drop-shadow-[0_0_14px_rgba(56,189,248,0.7)]">
        <path d="M18 12 H46 V24 C46 32 39 38 32 38 C25 38 18 32 18 24 Z" stroke="#38bdf8" strokeWidth="3.2" fill="rgba(56, 189, 248, 0.12)" strokeLinejoin="round" />
        <path d="M18 16 H12 C9.5 16 8 18 8 21 C8 26 12 28 18 28" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M46 16 H52 C54.5 16 56 18 56 21 C56 26 52 28 46 28" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M32 38 V48" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M22 48 H42 V54 H22 Z" stroke="#38bdf8" strokeWidth="3" fill="rgba(56, 189, 248, 0.2)" strokeLinejoin="round" />
        <path
          d="M32 18 L33.8 21.8 L38 22.4 L35 25.3 L35.7 29.5 L32 27.5 L28.3 29.5 L29 25.3 L26 22.4 L30.2 21.8 Z"
          fill="#38bdf8"
          className="drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
        />
      </svg>
    </div>
  );
}

function IconeTendencia() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]">
      <path d="M3 17 L9 11 L13 15 L21 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7 H21 V13" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Caixa padrão das telas (vidro escuro). */
function Painel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-3xl border border-sky-500/20 bg-gradient-to-b from-[#0e2246]/60 to-[#071329]/80 p-[2.4vh] shadow-xl backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

/** Uma linha do ranking: posição + código, barra que cresce, ícone na ponta e o número fora. */
function LinhaBarraTv({
  it,
  pos,
  maxValor,
  destaque,
  unidade,
  configBarra,
  onDispararConfete,
}: {
  it: ItemBarra;
  pos: number;
  maxValor: number;
  destaque: boolean;
  unidade?: string;
  configBarra?: ConfigTv["mensagens_barra"];
  onDispararConfete: (x: number, y: number) => void;
}) {
  const bolinhaRef = useRef<HTMLDivElement | null>(null);
  const jaDisparouRef = useRef(false);
  const [indiceMsg, setIndiceMsg] = useState(0);
  const posicao = pos + 1;
  const corPos = corDaPosicao(posicao);

  const gradiente = GRADIENTES_BARRAS[pos % GRADIENTES_BARRAS.length];
  const sombra = SOMBRAS_BARRAS[pos % SOMBRAS_BARRAS.length];
  const pctLargura = Math.max(22, (it.valor / maxValor) * 72);

  const mensagens = useMemo(() => {
    if (it.atingimento !== null && it.atingimento >= 100) {
      if (configBarra?.meta_batida?.length) return configBarra.meta_batida;
      const superacao = Math.round(it.atingimento - 100);
      return ["Meta batida! 🎯", "Excelente resultado! ⭐", superacao > 0 ? `Meta superada (+${superacao}%) 🚀` : "Meta atingida! 🏆"];
    }
    if (it.atingimento !== null && it.atingimento >= 80) {
      if (configBarra?.quase_la?.length) return configBarra.quase_la;
      return ["Falta pouco! 🔥", "Na reta final!", "Excelente resultado!"];
    }
    if (pos === 0 && it.valor > 0) return ["Liderando o ranking! 🌟", "Excelente ritmo!", "Seguimos crescendo!"];
    if (configBarra?.evoluindo?.length) return configBarra.evoluindo;
    return ["Vamos lá! 💪", "Estamos evoluindo!", "Cada conquista importa!", "Seguimos crescendo!"];
  }, [it.atingimento, it.valor, pos, configBarra]);

  useEffect(() => {
    const duracaoMsg = destaque ? 15000 + (pos % 3) * 1500 : 9500 + (pos % 3) * 1200;
    const interval = setInterval(() => setIndiceMsg((prev) => (prev + 1) % mensagens.length), duracaoMsg);
    return () => clearInterval(interval);
  }, [destaque, mensagens.length, pos]);

  const mensagemAtual = mensagens[indiceMsg % mensagens.length];

  // confete uma vez (com intervalo de 40s) quando a mensagem vira "Meta batida"
  const ultimaMsgRef = useRef(mensagemAtual);
  useEffect(() => {
    const ehMeta = (m: string) => m.includes("Meta batida") || m.includes("Meta superada");
    const mudouParaMeta = ehMeta(mensagemAtual) && !ehMeta(ultimaMsgRef.current);
    ultimaMsgRef.current = mensagemAtual;
    if (mudouParaMeta && !jaDisparouRef.current) {
      jaDisparouRef.current = true;
      if (bolinhaRef.current) {
        const rect = bolinhaRef.current.getBoundingClientRect();
        onDispararConfete(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      const timer = setTimeout(() => (jaDisparouRef.current = false), 40000);
      return () => clearTimeout(timer);
    }
  }, [mensagemAtual, onDispararConfete]);

  return (
    <motion.li layout transition={{ type: "spring", stiffness: 120, damping: 20 }} className="relative flex items-center">
      {/* posição (cor do pódio) + código da pessoa */}
      <div className="w-[6.4vw] flex-shrink-0 text-left leading-none">
        <span
          className="text-[3.6vh] font-bold tracking-tight tabular-nums select-none"
          style={{ color: corPos, textShadow: posicao <= 3 ? `0 0 14px ${corPos}99` : undefined }}
        >
          {posicao}º
        </span>
        <div className="mt-[0.4vh] text-[1.6vh] font-semibold tracking-[0.18em] text-sky-200/60 tabular-nums">#{it.id}</div>
      </div>

      <div className="relative flex flex-1 items-center">
        <motion.div
          className="relative flex h-[58px] min-w-[260px] items-center rounded-full"
          style={{ background: gradiente, boxShadow: `0 4px 20px -2px ${sombra}` }}
          initial={{ width: "260px" }}
          animate={{ width: `${pctLargura}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex-1 overflow-hidden pr-14 pl-5 select-none">
            <AnimatePresence mode="wait">
              <motion.span
                key={mensagemAtual}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 0.95, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.4 }}
                className="truncate text-[1.75vh] font-semibold tracking-wide whitespace-nowrap text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
              >
                {mensagemAtual}
              </motion.span>
            </AnimatePresence>
          </div>
          <div ref={bolinhaRef} className="absolute top-1/2 right-1 z-30 flex -translate-y-1/2 items-center justify-center">
            <AvatarPosicaoTv tipo={it.carinha} posicao={posicao} tamanho={52} />
          </div>
          <span className="absolute top-1/2 left-[calc(100%+14px)] -translate-y-1/2 text-[3.8vh] font-black tracking-tight whitespace-nowrap text-white tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] select-none">
            {fmt(it.valor, unidade)}
          </span>
        </motion.div>
      </div>
    </motion.li>
  );
}

function TelaBarras({
  tela,
  configBarra,
  onDispararConfete,
}: {
  tela: TelaTv;
  configBarra?: ConfigTv["mensagens_barra"];
  onDispararConfete: (x: number, y: number) => void;
}) {
  const itens = tela.itens ?? [];
  const maxValor = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="relative flex flex-1 flex-col">
      {tela.total !== undefined && (
        <div className="absolute top-0 right-0 z-10 text-right">
          <div className="text-[1.8vh] font-semibold tracking-wider text-sky-200/60 uppercase">Total da equipe</div>
          <div className="text-[5.2vh] leading-none font-black text-white tabular-nums drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]">
            {fmt(tela.total)}
          </div>
        </div>
      )}
      <LayoutGroup>
        <ul className="flex flex-1 flex-col justify-center gap-[2.4vh] py-[1.5vh] pr-[9vw]">
          {itens.map((it, pos) => (
            <LinhaBarraTv
              key={it.id}
              it={it}
              pos={pos}
              maxValor={maxValor}
              destaque={!!tela.destaque}
              unidade={tela.unidade}
              configBarra={configBarra}
              onDispararConfete={onDispararConfete}
            />
          ))}
          {!itens.length && (
            <li className="flex flex-1 items-center justify-center text-center text-[3vh] text-sky-200/50">Nenhuma marcação neste período ainda.</li>
          )}
        </ul>
      </LayoutGroup>
    </div>
  );
}

/** Detalhe de uma pessoa: ícone e código no canto, marcadas × realizadas em cada período. */
function TelaPessoa({ tela }: { tela: TelaTv }) {
  const p = tela.pessoa!;
  const max = Math.max(1, ...p.periodos.flatMap((x) => [x.marcadas, x.realizadas]));
  const cor = corDaPosicao(p.posicao);
  return (
    <div className="grid flex-1 grid-cols-12 gap-[2.4vh] py-[1.5vh]">
      <Painel className="col-span-3 flex flex-col items-center justify-center gap-[2vh] text-center">
        <AvatarPosicaoTv tipo={p.carinha} posicao={p.posicao} tamanho={150} />
        <div>
          <div className="text-[1.8vh] font-semibold tracking-[0.25em] text-sky-200/60 uppercase">Código</div>
          <div className="text-[7vh] leading-none font-black tracking-[0.12em] text-white tabular-nums">{p.codigo}</div>
        </div>
        <div className="text-[2.6vh] font-bold" style={{ color: cor }}>
          {p.posicao}º no ranking do mês
        </div>
      </Painel>

      <Painel className="col-span-9 flex flex-col">
        <div className="flex flex-wrap items-center gap-8 text-[2.2vh] font-medium text-sky-100/90">
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 rounded" style={{ background: COR_MARCADAS }} /> Consultas marcadas por ela para o período
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 rounded" style={{ background: COR_REALIZADAS }} /> Dessas, o paciente compareceu
          </span>
        </div>
        <div className="mt-[2vh] grid flex-1 items-end gap-[2vw]" style={{ gridTemplateColumns: `repeat(${p.periodos.length}, minmax(0, 1fr))` }}>
          {p.periodos.map((x) => (
            <div key={x.nome} className="flex h-full flex-col">
              <div className="flex flex-1 items-end justify-center gap-[0.8vw]">
                {(
                  [
                    [x.marcadas, COR_MARCADAS],
                    [x.realizadas, COR_REALIZADAS],
                  ] as const
                ).map(([v, c], k) => (
                  <div key={k} className="flex h-full w-[4.2vw] flex-col items-center justify-end">
                    <span className="mb-[0.6vh] text-[3.4vh] font-black text-white tabular-nums">{fmt(v)}</span>
                    <motion.div
                      className="w-full rounded-t-2xl"
                      style={{ background: c, boxShadow: `0 0 24px -6px ${c}` }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(1.5, (v / max) * 100)}%` }}
                      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: k * 0.12 }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-[1.4vh] border-t border-sky-500/20 pt-[1vh] text-center">
                <div className="text-[2.3vh] font-bold text-white">{x.nome}</div>
                <div className="text-[1.9vh] font-medium text-sky-200/70 tabular-nums">{x.datas}</div>
                {x.marcadas > 0 && (
                  <div className="mt-[0.4vh] text-[1.8vh] font-semibold text-emerald-300/90 tabular-nums">
                    {Math.round((x.realizadas / x.marcadas) * 100)}% compareceram
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Painel>
    </div>
  );
}

function CartaoNumero({ rotulo, valor, detalhe }: { rotulo: string; valor: number; detalhe: string }) {
  return (
    <Painel className="flex flex-col justify-center">
      <div className="text-[2.3vh] font-semibold text-sky-200/80">{rotulo}</div>
      <div className="mt-[0.6vh] text-[8vh] leading-none font-black text-white tabular-nums drop-shadow-sm">{fmt(valor)}</div>
      <div className="mt-[1vh] text-[1.9vh] text-sky-200/60">{detalhe}</div>
    </Painel>
  );
}

function CartaoParticipacao({ rotulo, equipe, clinica }: { rotulo: string; equipe: number; clinica: number | null }) {
  const pct = clinica ? Math.min(100, (equipe / clinica) * 100) : null;
  return (
    <Painel className="flex flex-col justify-center gap-[1.4vh]">
      <div className="text-[2.3vh] font-semibold text-sky-200/80">{rotulo}</div>
      <div className="flex items-baseline gap-3">
        <span className="text-[7vh] leading-none font-black text-white tabular-nums">{fmt(equipe)}</span>
        <span className="text-[2.6vh] font-semibold text-sky-200/70">
          de {clinica !== null ? fmt(clinica) : "—"} na clínica
        </span>
      </div>
      <div className="h-[2.2vh] overflow-hidden rounded-full border border-sky-500/30 bg-sky-950/60">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${COR_REALIZADAS}, #a7f3d0)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct ?? 0}%` }}
          transition={{ duration: 1.3 }}
        />
      </div>
      <div className="text-[2vh] text-sky-100/80">
        {pct !== null ? (
          <>
            <b className="text-emerald-300">{fmt(pct, "%")}</b> das consultas realizadas na clínica foram marcadas pela equipe
          </>
        ) : (
          "Total da clínica indisponível no momento"
        )}
      </div>
    </Painel>
  );
}

function TelaEquipe({ tela }: { tela: TelaTv }) {
  const e = tela.equipe!;
  return (
    <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-[2.4vh] py-[1.5vh]">
      <CartaoNumero rotulo="Agendamentos Particular" valor={e.agendamentosParticular} detalhe={`marcados pela equipe (${e.pessoas} pessoas) no período`} />
      <CartaoNumero rotulo="Agendamentos SUS" valor={e.agendamentosSus} detalhe="marcados pela equipe no período · só acompanhamento" />
      <CartaoParticipacao rotulo="Consultas Particular realizadas" equipe={e.realizadasParticular.equipe} clinica={e.realizadasParticular.clinica} />
      <CartaoParticipacao rotulo="Consultas SUS realizadas" equipe={e.realizadasSus.equipe} clinica={e.realizadasSus.clinica} />
    </div>
  );
}

export function TvCliente({ token }: { token: string }) {
  const [dados, setDados] = useState<PayloadTv | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [fraseRodapeIdx, setFraseRodapeIdx] = useState(0);
  const [subtituloIdx, setSubtituloIdx] = useState(0);
  const [disparoConfete, setDisparoConfete] = useState<DisparoConfete | null>(null);
  const agora = useRelogio();

  const dispararConfeteEm = useCallback((x: number, y: number) => {
    setDisparoConfete({ id: Date.now() + Math.random(), x, y });
  }, []);

  const frasesConfig = dados?.config?.frases_rodape;
  const frasesRodape = useMemo(() => (frasesConfig?.length ? frasesConfig : FRASES_RODAPE_PADRAO), [frasesConfig]);
  const subtitulosConfig = dados?.config?.subtitulos;
  const subtitulos = useMemo(() => (subtitulosConfig?.length ? subtitulosConfig : SUBTITULOS_PADRAO), [subtitulosConfig]);

  useEffect(() => {
    const t = setInterval(() => setFraseRodapeIdx((prev) => (prev + 1) % frasesRodape.length), 8500);
    return () => clearInterval(t);
  }, [frasesRodape.length]);

  useEffect(() => {
    const t = setInterval(() => setSubtituloIdx((prev) => (prev + 1) % subtitulos.length), 12000);
    return () => clearInterval(t);
  }, [subtitulos.length]);

  // dados: demo ou token real (atualiza a cada 60s mesmo com a rotação pausada)
  useEffect(() => {
    if (token === "demo") {
      let passo = 0;
      const t0 = setTimeout(() => setDados(dadosDemo(0)), 0);
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
  const total = Math.max(1, telas.length);
  const atual = indice % total;
  const tela = telas[atual];

  const ir = useCallback((delta: number) => setIndice((i) => (((i % total) + delta) % total + total) % total), [total]);

  // rotação automática (o "pausar" trava só o carrossel; os dados continuam atualizando)
  useEffect(() => {
    if (pausado || telas.length <= 1 || !tela) return;
    const base = (dados?.config?.intervalo ?? 30) * 1000;
    const t = setTimeout(() => ir(1), tela.destaque ? base * 2 : base);
    return () => clearTimeout(t);
  }, [pausado, telas.length, tela, dados?.config?.intervalo, ir, atual]);

  // teclado: ← → (e PageUp/PageDown dos controles) trocam de tela; espaço ou P pausa
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown") ir(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") ir(-1);
      else if (e.key === "Home") setIndice(0);
      else if (e.key === " " || e.key.toLowerCase() === "p" || e.key === "MediaPlayPause") setPausado((p) => !p);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ir]);

  // o cursor aparece ao mexer o mouse e some depois de 3s parado
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    function mexeu() {
      setCursor(true);
      clearTimeout(t);
      t = setTimeout(() => setCursor(false), 3000);
    }
    window.addEventListener("mousemove", mexeu);
    return () => {
      window.removeEventListener("mousemove", mexeu);
      clearTimeout(t);
    };
  }, []);

  return (
    <main
      className={`fixed inset-0 flex flex-col overflow-hidden bg-[#030914] px-[3.5vw] py-[3.2vh] text-white select-none ${cursor ? "" : "cursor-none"}`}
    >
      <ConfetesTv disparo={disparoConfete} />

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_35%,#0a1d3f_0%,#040c1d_55%,#020611_100%)]" />
        <OlhoFundoIoba />
        <div className="absolute -right-[10vw] -bottom-[15vh] h-[40vh] w-[45vw] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-[20vh] -left-[10vw] h-[40vh] w-[40vw] rounded-full bg-cyan-600/10 blur-3xl" />
      </div>

      {/* CABEÇALHO: o que é, de quando é e o relógio */}
      <header className="relative z-10 flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <IconeTrofeuNeon />
          <div className="h-12 w-[2px] bg-gradient-to-b from-sky-400/10 via-sky-400/50 to-sky-400/10" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[4.4vh] font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(56,189,248,0.3)]">
                {tela?.titulo ?? "Desempenho da Equipe"}
              </h1>
              {dados?.equipes?.[0] && (
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[1.6vh] font-semibold text-sky-300">
                  {dados.equipes.join(" · ")}
                </span>
              )}
            </div>
            {tela?.periodo && (
              <div className="mt-[0.6vh] flex items-center gap-3">
                <span className="flex items-baseline gap-3 rounded-xl border border-sky-300/40 bg-sky-400/15 px-3.5 py-1">
                  <span className="text-[2.9vh] font-extrabold text-white">{tela.periodo.nome}</span>
                  <span className="text-[2.6vh] font-semibold text-sky-200 tabular-nums">{tela.periodo.datas}</span>
                </span>
                {tela.periodo.emAndamento && <span className="text-[1.9vh] font-medium text-sky-200/60">parcial · atualiza sozinho</span>}
              </div>
            )}
            <div className={`mt-0.5 h-[2.5vh] overflow-hidden ${tela?.periodo ? "hidden 2xl:block" : ""}`}>
              <AnimatePresence mode="wait">
                <motion.p
                  key={subtituloIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.5 }}
                  className="text-[2.1vh] font-medium text-sky-200/70"
                >
                  {subtitulos[subtituloIdx % subtitulos.length]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[5.4vh] font-black tracking-tight text-white tabular-nums drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]">
            {agora ? agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" }) : "--:--"}
          </div>
          <div className="text-[1.8vh] font-medium text-sky-200/60 capitalize">
            {erro ??
              (agora
                ? agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bahia" })
                : "Sincronizado")}
          </div>
        </div>
      </header>


      <div className="relative z-10 mt-[2vh] flex flex-1 flex-col">
        {tela && (
          <div key={`${atual}-${tela.titulo}`} className="flex flex-1 flex-col duration-700 animate-in fade-in motion-reduce:animate-none">
            {tela.tipo === "barras" ? (
              <TelaBarras tela={tela} configBarra={dados?.config?.mensagens_barra} onDispararConfete={dispararConfeteEm} />
            ) : tela.tipo === "pessoa" ? (
              <TelaPessoa tela={tela} />
            ) : (
              <TelaEquipe tela={tela} />
            )}
          </div>
        )}
      </div>

      {/* RODAPÉ: frase, indicador de telas (clicável) e pausa */}
      <footer className="relative z-10 mt-[2vh] flex flex-col gap-2">
        <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex min-w-0 items-center gap-3">
            <IconeTendencia />
            <AnimatePresence mode="wait">
              <motion.span
                key={fraseRodapeIdx}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.5 }}
                className="truncate text-[2.2vh] font-semibold text-slate-200"
              >
                {frasesRodape[fraseRodapeIdx % frasesRodape.length]}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {pausado && (
              <span className="rounded-full border border-amber-300/50 bg-amber-400/15 px-3 py-0.5 text-[1.8vh] font-bold text-amber-200">
                ⏸ Pausado · espaço continua · ← → trocam
              </span>
            )}
            {telas.length > 1 && (
              <div className="flex items-center gap-1.5">
                {telas.map((t, i) => (
                  <button
                    key={`${t.titulo}-${i}`}
                    type="button"
                    aria-label={`Ir para a tela ${i + 1}`}
                    title={`${t.titulo}${t.periodo ? ` · ${t.periodo.nome}` : t.pessoa ? ` · #${t.pessoa.codigo}` : ""}`}
                    onClick={() => setIndice(i)}
                    className={`h-[0.8vh] rounded-full transition-all duration-500 ${
                      i === atual ? "w-6 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" : "w-2 bg-white/20 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
            <span className="text-[1.7vh] font-semibold text-sky-200/50 tabular-nums">
              {atual + 1}/{total}
            </span>
            <button
              type="button"
              onClick={() => setPausado((p) => !p)}
              aria-label={pausado ? "Continuar a rotação" : "Pausar a rotação"}
              className={`flex size-[3.4vh] items-center justify-center rounded-full border text-[1.6vh] transition-colors ${
                pausado ? "border-amber-300/60 bg-amber-400/20 text-amber-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200/70 hover:text-white"
              }`}
            >
              {pausado ? "▶" : "❚❚"}
            </button>
            <span className="text-[1.8vh] font-semibold tracking-wider text-sky-400/50 uppercase">Trackco · IOBA</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
