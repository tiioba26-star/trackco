"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, Maximize, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { clienteRealtime, type ComandoTv, type EstadoTv } from "@/lib/controle-tv";

type Conexao = "conectando" | "online" | "sem_tv";

/** Três botões grandes: anterior, pausar/continuar e próxima. Fala com a TV por WebSocket (Supabase Realtime). */
export function ControleRemoto({ canal, nome, ativo }: { canal: string; nome: string; ativo: boolean }) {
  const [estado, setEstado] = useState<EstadoTv | null>(null);
  const [conexao, setConexao] = useState<Conexao>("conectando");
  const [apertado, setApertado] = useState<string | null>(null);
  const canalRef = useRef<RealtimeChannel | null>(null);
  const ultimoRef = useRef(0);

  useEffect(() => {
    const sb = clienteRealtime();
    const ch = sb.channel(canal, { config: { broadcast: { self: false } } });
    const ping = () => void ch.send({ type: "broadcast", event: "ping", payload: {} });
    const inicio = Date.now();
    ch.on("broadcast", { event: "estado" }, ({ payload }) => {
      ultimoRef.current = Date.now();
      setEstado(payload as EstadoTv);
      setConexao("online");
    }).subscribe((st) => {
      if (st === "SUBSCRIBED") ping();
    });
    canalRef.current = ch;
    // a cada 5 s pergunta se a TV continua ligada; sem resposta em 12 s, avisa
    const t = setInterval(() => {
      ping();
      const desde = ultimoRef.current || inicio;
      if (Date.now() - desde > 12_000) setConexao("sem_tv");
    }, 5000);
    return () => {
      clearInterval(t);
      canalRef.current = null;
      void sb.removeChannel(ch);
    };
  }, [canal]);

  const enviar = useCallback((c: ComandoTv, rotulo: string) => {
    void canalRef.current?.send({ type: "broadcast", event: "cmd", payload: c });
    if (c.acao === "alternar") setEstado((e) => (e ? { ...e, pausado: !e.pausado } : e)); // a TV confirma em ~0,1 s
    setApertado(rotulo);
    try {
      navigator.vibrate?.(15);
    } catch {
      /* aparelho sem vibração */
    }
    setTimeout(() => setApertado(null), 180);
  }, []);

  // no PC também dá para usar o teclado
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") enviar({ acao: "anterior" }, "anterior");
      else if (e.key === "ArrowRight") enviar({ acao: "proxima" }, "proxima");
      else if (e.key === " ") {
        e.preventDefault();
        enviar({ acao: "alternar" }, "alternar");
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [enviar]);

  const botao = (rotulo: string, aria: string, acao: ComandoTv, conteudo: React.ReactNode, grande = false) => (
    <button
      type="button"
      aria-label={aria}
      onClick={() => enviar(acao, rotulo)}
      className={`flex items-center justify-center rounded-3xl border border-sky-400/30 text-sky-50 transition-transform select-none active:scale-95 ${
        grande ? "aspect-square w-[36vw] max-w-44 bg-sky-400/20" : "aspect-square w-[26vw] max-w-32 bg-sky-400/10"
      } ${apertado === rotulo ? "scale-95 bg-sky-400/40" : ""}`}
    >
      {conteudo}
    </button>
  );

  return (
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_50%_20%,#0a1d3f_0%,#030914_70%)] px-5 py-6 text-white">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-widest text-sky-300/70 uppercase">Controle da TV</div>
          <h1 className="truncate text-lg font-bold">{nome}</h1>
        </div>
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
          className="rounded-full border border-white/15 p-2 text-sky-100/80"
          aria-label="Tela cheia"
        >
          <Maximize className="size-5" />
        </button>
      </header>

      <div className="mt-3 flex items-center gap-2 text-sm" role="status">
        <span
          className={`size-2.5 shrink-0 rounded-full ${
            conexao === "online" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : conexao === "conectando" ? "animate-pulse bg-amber-300" : "bg-red-400"
          }`}
        />
        <span className="text-sky-100/80">
          {conexao === "online" ? "TV conectada" : conexao === "conectando" ? "Procurando a TV…" : "Nenhuma TV respondeu. A TV está ligada com este painel aberto?"}
        </span>
      </div>
      {!ativo && <p className="mt-2 rounded-lg bg-amber-400/15 px-3 py-2 text-sm text-amber-100">Este painel está desativado: a TV não mostra nada.</p>}

      <section className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center" aria-live="polite">
        {estado ? (
          <>
            <div className="text-sm text-sky-200/70 tabular-nums">
              Tela {estado.atual + 1} de {estado.total}
              {estado.pausado && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 font-semibold text-amber-200">⏸ pausada</span>}
            </div>
            <div className="text-2xl leading-tight font-extrabold">{estado.titulo}</div>
            {estado.periodo && <div className="text-base text-sky-200">{estado.periodo}</div>}
          </>
        ) : (
          <div className="text-sky-200/70">Abra o link do painel na TV e ela aparece aqui.</div>
        )}
      </section>

      <nav className="flex items-center justify-center gap-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]" aria-label="Comandos da TV">
        {botao("anterior", "Tela anterior", { acao: "anterior" }, <ChevronLeft className="size-12" />)}
        {botao(
          "alternar",
          estado?.pausado ? "Continuar a rotação" : "Pausar a rotação",
          { acao: "alternar" },
          estado?.pausado ? <Play className="size-14 fill-current" /> : <Pause className="size-14 fill-current" />,
          true,
        )}
        {botao("proxima", "Próxima tela", { acao: "proxima" }, <ChevronRight className="size-12" />)}
      </nav>
      <p className="text-center text-xs text-sky-200/50">Pausar trava só a troca de telas; os números continuam atualizando. No PC: ← → e espaço.</p>
    </main>
  );
}
