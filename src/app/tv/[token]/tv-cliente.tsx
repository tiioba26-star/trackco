"use client";

import { LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { nomeCompetencia } from "@/engine/datas";
import type { PayloadTv, TelaTv } from "@/lib/dados/tv";
import { Carinha } from "./carinha";

// Fundos que alternam a cada ciclo ("muda de cor de vez em quando"). As cores das barras seguem a pessoa, não o fundo.
const FUNDOS = [
  "radial-gradient(120% 90% at 0% 0%, #1c5cab 0%, #0b1f3d 55%, #060d1a 100%)",
  "radial-gradient(120% 90% at 100% 0%, #0f766e 0%, #0b2b33 55%, #061416 100%)",
  "radial-gradient(120% 90% at 0% 100%, #5b3cc4 0%, #1e1640 55%, #0b0919 100%)",
  "radial-gradient(120% 90% at 100% 100%, #b4531f 0%, #3a1d10 55%, #140a06 100%)",
];
// paleta categórica validada (modo escuro)
const CORES = ["#3987e5", "#d95926", "#199e70", "#9085e9", "#c98500", "#d55181"];

/** /tv/demo: dados fictícios que crescem sozinhos, para ver o layout e a animação antes de ter dados reais. */
function dadosDemo(passo: number): PayloadTv {
  const base = [42, 38, 35, 29, 24];
  const cresc = [3, 5, 2, 6, 4];
  const itens = (fator: number) =>
    base
      .map((b, i) => {
        const valor = Math.round((b + cresc[i] * passo) * fator);
        const ating = (valor / (46 * fator)) * 100;
        return {
          id: `demo${i}`,
          valor,
          atingimento: ating,
          carinha: (ating >= 100 ? "mega_feliz" : ating >= 80 ? "feliz" : "neutra") as "neutra" | "feliz" | "mega_feliz",
        };
      })
      .sort((a, b) => b.valor - a.valor);
  const hoje = new Date().getDate();
  return {
    nome: "Demonstração",
    equipes: ["Comercial (demonstração)"],
    competencia: new Date().toISOString().slice(0, 7),
    atualizado_em: new Date().toISOString(),
    config: { intervalo: 12, modos: [], limites: { feliz: 80, mega_feliz: 100 } },
    telas: [
      { tipo: "barras", titulo: "Agendamentos do mês", unidade: "un", itens: itens(1) },
      { tipo: "barras", titulo: "Consultas realizadas", unidade: "un", itens: itens(0.6) },
      { tipo: "barras", titulo: "SUS · agendamentos", unidade: "un", itens: itens(0.3) },
      {
        tipo: "geral",
        titulo: "Visão geral da equipe",
        geral: {
          indicadores: [
            { titulo: "Agendamentos", realizado: 168 + passo * 20, meta: 300, pct: ((168 + passo * 20) / 300) * 100, unidade: "un" },
            { titulo: "Consultas realizadas", realizado: 101 + passo * 12, meta: 180, pct: ((101 + passo * 12) / 180) * 100, unidade: "un" },
            { titulo: "Taxa de conversão", realizado: 61.4, meta: null, pct: null, unidade: "%" },
            { titulo: "SUS · agendamentos", realizado: 51 + passo * 6, meta: null, pct: null, unidade: "un" },
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
          carinhas: { mega_feliz: 1, feliz: 2, neutra: 2 },
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

function useRelogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const atualizar = () => setAgora(new Date());
    const t0 = setTimeout(atualizar, 0);
    const t = setInterval(atualizar, 15_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);
  return agora;
}

function TelaBarras({ tela, corDe }: { tela: TelaTv; corDe: (id: string) => string }) {
  const itens = tela.itens ?? [];
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <LayoutGroup>
      <ul className="flex flex-1 flex-col justify-center gap-[1.6vh]">
        {itens.map((it, pos) => (
          <motion.li
            key={it.id}
            layout
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            className="flex items-center gap-[1.4vw]"
          >
            <span className="w-[3vw] text-right text-[2.6vh] font-semibold text-white/60 tabular-nums">{pos + 1}º</span>
            <Carinha tipo={it.carinha} cor={corDe(it.id)} tamanho={Math.round(Math.min(72, Math.max(40, 560 / Math.max(itens.length, 6))))} />
            <div className="relative h-[5.5vh] flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: corDe(it.id) }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, (it.valor / max) * 100)}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <span className="w-[8vw] text-[3.6vh] font-semibold text-white tabular-nums">{fmt(it.valor, tela.unidade)}</span>
          </motion.li>
        ))}
        {!itens.length && <li className="text-center text-[3vh] text-white/60">Sem dados neste mês ainda.</li>}
      </ul>
    </LayoutGroup>
  );
}

function TelaGeral({ tela }: { tela: TelaTv }) {
  const g = tela.geral!;
  return (
    <div className="grid flex-1 grid-cols-12 gap-[2vh]">
      <div className="col-span-12 grid grid-cols-2 gap-[2vh] lg:grid-cols-4">
        {g.indicadores.map((i) => (
          <div key={i.titulo} className="rounded-3xl bg-white/10 p-[2.4vh] backdrop-blur">
            <div className="text-[2.2vh] text-white/70">{i.titulo}</div>
            <div className="mt-1 text-[6vh] leading-none font-semibold text-white tabular-nums">{fmt(i.realizado, i.unidade)}</div>
            {i.meta ? (
              <>
                <div className="mt-2 text-[2vh] text-white/60">meta {fmt(i.meta, i.unidade)}</div>
                <div className="mt-2 h-[1.2vh] overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, i.pct ?? 0)}%` }}
                    transition={{ duration: 1.4 }}
                  />
                </div>
                <div className="mt-1 text-[2.2vh] font-medium text-white">{fmt(i.pct ?? 0, "%")}</div>
              </>
            ) : null}
          </div>
        ))}
      </div>
      <div className="col-span-12 rounded-3xl bg-white/10 p-[2.4vh] lg:col-span-8">
        <div className="mb-2 flex flex-wrap gap-6 text-[2.2vh] text-white/80">
          {g.series.map((s, i) => (
            <span key={s.chave} className="flex items-center gap-2">
              <span className="inline-block h-1 w-6 rounded-full" style={{ background: i === 0 ? "#ffffff" : "#9ec5f4" }} />
              {s.rotulo} (acumulado)
            </span>
          ))}
        </div>
        <div className="h-[34vh]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={g.serie} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <XAxis dataKey="dia" stroke="#ffffff80" tickLine={false} axisLine={false} fontSize={14} minTickGap={20} />
              <YAxis stroke="#ffffff80" tickLine={false} axisLine={false} fontSize={14} width={44} allowDecimals={false} />
              {g.series.map((s, i) => (
                <Line
                  key={s.chave}
                  dataKey={s.chave}
                  stroke={i === 0 ? "#ffffff" : "#9ec5f4"}
                  strokeWidth={3}
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
      <div className="col-span-12 flex flex-col justify-center gap-[2vh] rounded-3xl bg-white/10 p-[2.4vh] lg:col-span-4">
        <div className="text-[2.4vh] text-white/80">Como a equipe está</div>
        {(
          [
            ["mega_feliz", "Arrasando"],
            ["feliz", "Quase lá"],
            ["neutra", "Acelerando"],
          ] as const
        ).map(([t, rotulo]) => (
          <div key={t} className="flex items-center gap-4">
            <Carinha tipo={t} cor="#f5b72e" tamanho={64} />
            <span className="flex-1 text-[2.6vh] text-white">{rotulo}</span>
            <span className="text-[5vh] font-semibold text-white tabular-nums">{g.carinhas[t]}</span>
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
  const [ciclo, setCiclo] = useState(0);
  const agora = useRelogio();

  // busca os dados a cada 60 s e se recupera sozinho de falhas
  useEffect(() => {
    if (token === "demo") {
      let passo = 0;
      const t0 = setTimeout(() => {
        // /tv/demo?tela=N abre direto num modo (útil para conferir o layout)
        const inicial = Number(new URLSearchParams(window.location.search).get("tela") ?? "1") - 1;
        if (inicial > 0 && inicial < 4) setIndice(inicial);
        setDados(dadosDemo(0));
      }, 0);
      const t = setInterval(() => setDados(dadosDemo(++passo % 8)), 4000);
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
      setCiclo((c) => c + 1);
    }, intervalo);
    return () => clearInterval(t);
  }, [telas.length, intervalo]);

  // cor fixa por pessoa anônima (a cor segue a pessoa, não a posição)
  const corDe = useMemo(() => {
    const ids = Array.from(new Set(telas.flatMap((t) => t.itens?.map((i) => i.id) ?? []))).sort();
    const mapa = new Map(ids.map((id, i) => [id, CORES[i % CORES.length]]));
    return (id: string) => mapa.get(id) ?? CORES[0];
  }, [telas]);

  const tela = telas[indice % Math.max(1, telas.length)];
  const fundo = FUNDOS[ciclo % FUNDOS.length];

  return (
    <main
      className="fixed inset-0 flex cursor-none flex-col overflow-hidden px-[3vw] py-[3vh] text-white transition-[background] duration-[2000ms]"
      style={{ background: fundo }}
    >
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[2.2vh] tracking-[0.2em] text-white/60 uppercase">
            {dados ? `${dados.equipes.join(" · ")} · ${nomeCompetencia(dados.competencia)}` : "Trackco"}
          </div>
          {/* troca por "key" + fade em CSS: não depende de animação de saída (mais seguro em navegador de TV) */}
          <h1
            key={tela?.titulo ?? "carregando"}
            className="animate-in fade-in slide-in-from-bottom-2 text-[5.5vh] leading-tight font-semibold duration-700 motion-reduce:animate-none"
          >
            {tela?.titulo ?? "Carregando…"}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[4.5vh] font-semibold tabular-nums">
            {agora?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}
          </div>
          <div className="text-[1.8vh] text-white/60">
            {erro ??
              (dados?.atualizado_em
                ? `Klingo atualizado às ${new Date(dados.atualizado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}`
                : "")}
          </div>
        </div>
      </header>

      <div className="mt-[3vh] flex flex-1 flex-col">
        {tela && (
          <div key={`${indice}-${tela.titulo}`} className="animate-in fade-in flex flex-1 flex-col duration-700 motion-reduce:animate-none">
            {tela.tipo === "barras" ? <TelaBarras tela={tela} corDe={corDe} /> : <TelaGeral tela={tela} />}
          </div>
        )}
      </div>

      <footer className="mt-[2vh] flex items-center gap-3">
        {telas.map((t, i) => (
          <span
            key={`${t.titulo}-${i}`}
            className={`h-[0.8vh] flex-1 rounded-full ${i === indice % telas.length ? "bg-white" : "bg-white/20"}`}
          />
        ))}
        <span className="ml-3 text-[1.8vh] text-white/50">trackco · IOBA</span>
      </footer>
    </main>
  );
}
