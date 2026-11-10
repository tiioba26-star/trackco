"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
      <fieldset disabled={pendente} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

/** Botão que dispara uma Server Action (com confirmação opcional). */
export function BotaoAcao({
  acao,
  children,
  confirmar,
  sucesso = "Feito.",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & {
  acao: () => Promise<RetornoAcao>;
  confirmar?: string;
  sucesso?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      {...props}
      disabled={pendente || props.disabled}
      onClick={() => {
        if (confirmar && !window.confirm(confirmar)) return;
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
