"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DICA_LEITURA, type OpcoesConfirmar, useConfirmar, useSomenteLeitura } from "./confirmacao";

export type RetornoAcao = { ok: boolean; erro?: string; mensagem?: string };

/** Formulário que chama uma Server Action e mostra o resultado em toast. */
export function FormAcao({
  acao,
  children,
  className,
  sucesso = "Salvo.",
  limpar = false,
}: {
  acao: (fd: FormData) => Promise<RetornoAcao>;
  children: React.ReactNode;
  className?: string;
  sucesso?: string;
  limpar?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pendente, iniciar] = useTransition();
  const leitura = useSomenteLeitura();
  return (
    <form
      ref={ref}
      className={className}
      aria-busy={pendente}
      action={(fd) =>
        iniciar(async () => {
          const r = await acao(fd);
          if (r.ok) {
            toast.success(r.mensagem ?? sucesso);
            if (limpar) ref.current?.reset();
            router.refresh();
          } else toast.error(r.erro ?? "Não foi possível concluir.");
        })
      }
    >
      <fieldset disabled={pendente || leitura} title={leitura ? DICA_LEITURA : undefined} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

/** Botão que dispara uma Server Action. `confirmar` abre a caixa de confirmação antes (texto curto ou título + consequência). */
export function BotaoAcao({
  acao,
  children,
  confirmar,
  sucesso = "Feito.",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & {
  acao: () => Promise<RetornoAcao>;
  confirmar?: string | OpcoesConfirmar;
  sucesso?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const leitura = useSomenteLeitura();
  const pedir = useConfirmar();
  return (
    <Button
      {...props}
      disabled={pendente || leitura || props.disabled}
      title={leitura ? DICA_LEITURA : props.title}
      onClick={async () => {
        if (confirmar && !(await pedir(typeof confirmar === "string" ? { titulo: confirmar, perigo: props.variant === "destructive" } : confirmar))) return;
        iniciar(async () => {
          const r = await acao();
          if (r.ok) {
            toast.success(r.mensagem ?? sucesso);
            router.refresh();
          } else toast.error(r.erro ?? "Não foi possível concluir.");
        });
      }}
    >
      {children}
    </Button>
  );
}
