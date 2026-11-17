import { Check } from "lucide-react";
import { formatarDataBR } from "@/engine/datas";
import type { EtapaLinha } from "@/lib/fechamento";
import { fmtDataHora } from "@/lib/formato";
import { cn } from "@/lib/utils";

const QUEM: Record<NonNullable<EtapaLinha["responsavel"]>, string> = {
  admin: "administrador",
  lider_ou_admin: "líder ou administrador",
};

const primeiroNome = (nome: string) => nome.split(" ")[0];

function Detalhe({ e, prazo }: { e: EtapaLinha; prazo: string | null }) {
  if (e.estado === "feita") {
    const m = e.fim ?? e.inicio;
    if (!m) return <>Feita</>;
    return (
      <>
        {fmtDataHora(m.em)} · {primeiroNome(m.por)}
      </>
    );
  }
  if (e.estado === "atual") {
    return (
      <>
        {e.inicio ? `Desde ${fmtDataHora(e.inicio.em)}` : "Etapa atual"}
        {e.status === "em_contestacao" && prazo && <span className="block">Contestações até {formatarDataBR(prazo)}</span>}
        {e.status === "aberto" ? (
          <span className="block">Falta calcular</span>
        ) : (
          e.responsavel && <span className="block">Próximo passo: {QUEM[e.responsavel]}</span>
        )}
      </>
    );
  }
  return <>{e.responsavel ? `Com o ${QUEM[e.responsavel]}` : "A fazer"}</>;
}

/**
 * "Em que pé está o mês": cada etapa como feita (✓, com data e quem concluiu), atual (destacada) ou a fazer.
 * No celular fica na vertical; do tablet para cima, na horizontal.
 */
export function LinhaDoTempoFechamento({ etapas, prazoContestacao }: { etapas: EtapaLinha[]; prazoContestacao: string | null }) {
  return (
    <ol className="md:grid md:auto-cols-fr md:grid-flow-col">
      {etapas.map((e, i) => {
        const ultimo = i === etapas.length - 1;
        const seguinteFeita = etapas[i + 1]?.estado === "feita" || etapas[i + 1]?.estado === "atual";
        return (
          <li
            key={e.status}
            aria-current={e.estado === "atual" ? "step" : undefined}
            className="relative flex gap-3 pb-6 last:pb-0 md:flex-col md:gap-2 md:pr-3 md:pb-0"
          >
            {!ultimo && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full md:top-[13px] md:right-1 md:bottom-auto md:left-9 md:h-0.5 md:w-auto",
                  e.estado === "feita" && seguinteFeita ? "bg-up" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                e.estado === "feita" && "bg-up text-white",
                e.estado === "atual" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                e.estado === "a_fazer" && "border-2 border-border bg-background text-muted-foreground",
              )}
            >
              {e.estado === "feita" ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 pt-0.5 md:pt-0">
              <div className={cn("text-sm leading-tight font-medium", e.estado === "a_fazer" && "text-muted-foreground")}>
                {e.rotulo}
                <span className="sr-only">{e.estado === "feita" ? " (feita)" : e.estado === "atual" ? " (etapa atual)" : " (a fazer)"}</span>
              </div>
              <div className={cn("mt-0.5 text-xs", e.estado === "atual" ? "text-foreground" : "text-muted-foreground")}>
                <Detalhe e={e} prazo={prazoContestacao} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
