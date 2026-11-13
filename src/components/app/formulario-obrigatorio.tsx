"use client";

import { ClipboardList, Lock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { responderFormulario } from "@/app/(app)/acoes-formulario";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { type Formulario, type Pergunta, ROTULOS_ESCALA5 } from "@/lib/formularios";
import { cn } from "@/lib/utils";

type Valor = number | string | undefined;

function Escala({ p, valor, onChange }: { p: Pergunta; valor: Valor; onChange: (v: number) => void }) {
  const opcoes = p.tipo === "escala5" ? [1, 2, 3, 4, 5] : Array.from({ length: 11 }, (_, i) => i);
  const [min, max] = p.tipo === "escala5" ? [ROTULOS_ESCALA5[0], ROTULOS_ESCALA5[4]] : ["0 = nada", "10 = totalmente"];
  return (
    <div>
      <div role="radiogroup" aria-label={p.texto} className={cn("grid gap-1.5", p.tipo === "escala5" ? "grid-cols-5" : "grid-cols-6 sm:grid-cols-11")}>
        {opcoes.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            title={p.tipo === "escala5" ? ROTULOS_ESCALA5[n - 1] : String(n)}
            onClick={() => onChange(n)}
            className={cn(
              "h-10 rounded-lg border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              valor === n ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/**
 * Pesquisa obrigatória: cobre o site (desfocado) até a pessoa responder.
 * Para o admin, fica liberado nas telas de Formulários (para poder corrigir um formulário com problema).
 */
export function FormularioObrigatorio({ formulario, rodada, admin }: { formulario: Formulario; rodada: string; admin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const tituloId = useId();
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const [valores, setValores] = useState<Record<string, Valor>>({});
  const [faltando, setFaltando] = useState<string[]>([]);
  const [enviado, setEnviado] = useState(false);
  const [enviando, iniciar] = useTransition();
  // só no navegador (o portal precisa do document)
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const liberado = admin && pathname.startsWith("/formularios");
  const aberto = montado && !enviado && !liberado;

  // trava o fundo: sem rolar e sem foco por teclado fora da pesquisa
  useEffect(() => {
    if (!aberto) return;
    const raiz = caixaRef.current?.closest("[data-formulario-raiz]");
    const outros = Array.from(document.body.children).filter((el) => el !== raiz) as HTMLElement[];
    outros.forEach((el) => el.setAttribute("inert", ""));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caixaRef.current?.focus();
    return () => {
      outros.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = overflow;
    };
  }, [aberto]);

  if (!montado || enviado) return null;
  if (liberado)
    return (
      <div className="fixed right-4 bottom-4 z-50 max-w-xs rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
        Você tem o formulário <b>{formulario.titulo}</b> para responder. Ele fica liberado aqui para você poder editar; ao sair desta tela, ele aparece.
      </div>
    );

  const perguntas = formulario.perguntas;
  const respondidas = perguntas.filter((p) => valores[p.id] !== undefined && valores[p.id] !== "").length;
  const minutos = Math.max(1, Math.round(perguntas.reduce((s, p) => s + (p.tipo === "texto" ? 30 : 10), 0) / 60));
  const definir = (id: string, v: Valor) => {
    setValores((x) => ({ ...x, [id]: v }));
    setFaltando((f) => f.filter((k) => k !== id));
  };

  const enviar = () =>
    iniciar(async () => {
      const r = await responderFormulario(formulario.id, rodada, valores);
      if (r.ok) {
        setEnviado(true);
        toast.success("Obrigado! Suas respostas foram enviadas.");
        router.refresh();
        return;
      }
      if (r.faltando?.length) {
        setFaltando(r.faltando);
        document.getElementById(`pergunta-${r.faltando[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast.error(r.erro ?? "Não foi possível enviar. Tente de novo.");
    });

  return createPortal(
    <div data-formulario-raiz className="fixed inset-0 z-[70] overflow-y-auto bg-background/40 backdrop-blur-md">
      <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-6">
        <div
          ref={caixaRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl outline-none"
        >
          <div className="space-y-2 border-b p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary">
                <ClipboardList className="size-3.5" /> Pesquisa rápida
              </span>
              <span>~{minutos} min</span>
              {formulario.anonimo && (
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3" /> Anônima: ninguém vê o que você respondeu
                </span>
              )}
            </div>
            <h2 id={tituloId} className="text-xl font-semibold tracking-tight">
              {formulario.titulo}
            </h2>
            {formulario.descricao && <p className="text-sm text-muted-foreground">{formulario.descricao}</p>}
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Progress value={(respondidas / Math.max(1, perguntas.length)) * 100} className="flex-1" />
              <span className="tabular-nums">
                {respondidas}/{perguntas.length}
              </span>
            </div>
          </div>

          <ol className="space-y-5 p-5">
            {perguntas.map((p, i) => {
              const erro = faltando.includes(p.id);
              return (
                <li key={p.id} id={`pergunta-${p.id}`} className={cn("space-y-2 rounded-lg", erro && "ring-2 ring-destructive/60 ring-offset-4 ring-offset-card")}>
                  <div className="text-sm font-medium">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {p.texto}
                    {!p.obrigatoria && <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>}
                  </div>
                  {p.tipo === "escala5" || p.tipo === "escala10" ? (
                    <Escala p={p} valor={valores[p.id]} onChange={(v) => definir(p.id, v)} />
                  ) : p.tipo === "escolha" ? (
                    <div role="radiogroup" aria-label={p.texto} className="flex flex-wrap gap-1.5">
                      {(p.opcoes ?? []).map((o) => (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={valores[p.id] === o}
                          onClick={() => definir(p.id, o)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            valores[p.id] === o ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                          )}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Textarea
                      rows={3}
                      maxLength={2000}
                      value={String(valores[p.id] ?? "")}
                      onChange={(e) => definir(p.id, e.target.value)}
                      placeholder="Escreva com suas palavras…"
                    />
                  )}
                  {erro && <p className="text-xs text-destructive">Esta pergunta é obrigatória.</p>}
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col-reverse items-stretch gap-2 border-t p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">O Trackco libera assim que você enviar.</p>
            <Button onClick={enviar} disabled={enviando} size="lg">
              {enviando ? "Enviando…" : "Enviar respostas"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
