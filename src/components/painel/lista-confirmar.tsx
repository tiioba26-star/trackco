"use client";

import { Check, PhoneOff } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { marcarConfirmacao } from "@/app/(app)/acoes-rotina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PacienteConfirmar } from "@/lib/dados/rotina";
import { cn } from "@/lib/utils";

type Resultado = PacienteConfirmar["resultado"];

/** Lista da véspera: a atendente marca quem confirmou e quem não atendeu. Mostra 8 e expande. */
export function ListaConfirmar({ pacientes, podeMarcar }: { pacientes: PacienteConfirmar[]; podeMarcar: boolean }) {
  const [estado, setEstado] = useState<Record<string, Resultado>>(() => Object.fromEntries(pacientes.map((p) => [p.paciente, p.resultado])));
  const [todos, setTodos] = useState(false);
  const [, iniciar] = useTransition();
  const feitos = Object.values(estado).filter(Boolean).length;
  const confirmados = Object.values(estado).filter((r) => r === "confirmado").length;
  const visiveis = todos ? pacientes : pacientes.slice(0, 8);

  const marcar = (p: PacienteConfirmar, r: Resultado) => {
    const novo = estado[p.paciente] === r ? null : r;
    const antes = estado[p.paciente];
    setEstado((e) => ({ ...e, [p.paciente]: novo }));
    iniciar(async () => {
      const res = await marcarConfirmacao(p.chaves, novo);
      if (!res.ok) {
        setEstado((e) => ({ ...e, [p.paciente]: antes }));
        toast.error(res.erro ?? "Não foi possível salvar.");
      }
    });
  };

  return (
    <div className="space-y-3">
      {podeMarcar && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {feitos} de {pacientes.length} contatados
            </span>
            <span>{confirmados} confirmaram</span>
          </div>
          <Progress value={pacientes.length ? (feitos / pacientes.length) * 100 : 0} />
        </div>
      )}
      <ul className="divide-y rounded-lg border">
        {visiveis.map((p) => {
          const r = estado[p.paciente];
          return (
            <li key={p.paciente} className={cn("flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between", r && "bg-muted/40")}>
              <div className="min-w-0">
                <div className={cn("truncate text-sm font-medium", r === "confirmado" && "text-muted-foreground line-through decoration-1")}>
                  {p.paciente}
                  {p.sus && (
                    <Badge variant="outline" className="ml-1.5 align-middle text-[10px]">
                      SUS
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[p.procedimentos.join(" + "), p.profissional].filter(Boolean).join(" · ")}
                </div>
              </div>
              {podeMarcar && (
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant={r === "confirmado" ? "default" : "outline"}
                    onClick={() => marcar(p, "confirmado")}
                    aria-pressed={r === "confirmado"}
                  >
                    <Check className="size-3.5" /> Confirmou
                  </Button>
                  <Button
                    size="sm"
                    variant={r === "sem_contato" ? "secondary" : "ghost"}
                    onClick={() => marcar(p, "sem_contato")}
                    aria-pressed={r === "sem_contato"}
                    title="Liguei e não consegui falar"
                  >
                    <PhoneOff className="size-3.5" /> Não atendeu
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {pacientes.length > 8 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setTodos((t) => !t)}>
          {todos ? "Mostrar menos" : `Ver todos os ${pacientes.length}`}
        </Button>
      )}
    </div>
  );
}
