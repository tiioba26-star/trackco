"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trocarSenha } from "./actions";

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
      <div className="space-y-1.5">
        <Label htmlFor="atual">Senha atual</Label>
        <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nova">Nova senha</Label>
        <Input id="nova" name="nova" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmacao">Confirme a nova senha</Label>
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" disabled={pendente}>
        Salvar nova senha
      </Button>
    </form>
  );
}
