"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trocarSenha } from "./actions";
import { Campo } from "@/components/ui/campo";

export function FormSenha() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      action={(fd) =>
        iniciar(async () => {
          const r = await trocarSenha(fd);
          if (r.ok) {
            toast.success("Senha alterada.");
            router.push("/");
          } else setErro(r.erro ?? "Falha ao trocar a senha.");
        })
      }
    >
      <Campo rotulo="Senha atual" htmlFor="atual">
        <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
      </Campo>
      <Campo rotulo="Nova senha" htmlFor="nova">
        <Input id="nova" name="nova" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Campo>
      <Campo rotulo="Confirme a nova senha" htmlFor="confirmacao">
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" disabled={pendente}>
        Salvar nova senha
      </Button>
    </form>
  );
}
