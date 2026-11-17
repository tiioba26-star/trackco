"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Vazio } from "@/components/app/blocos";
import { Button, buttonVariants } from "@/components/ui/button";

/** Erro numa tela do sistema: fica dentro do layout (menu e cabeçalho continuam), em português. */
export default function ErroDaTela({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const codigo = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <Vazio
      icone={CircleAlert}
      className="my-10"
      titulo="Não foi possível abrir esta tela"
      texto={
        <>
          Pode ter sido uma falha passageira na conexão. Tente de novo; se continuar, avise o administrador
          {codigo ? <> e informe o código <span className="font-mono">{codigo}</span></> : null}.
        </>
      }
      acao={
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Voltar ao Painel
          </Link>
        </div>
      }
    />
  );
}
