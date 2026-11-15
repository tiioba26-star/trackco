"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redefinirSenha } from "./actions";

/** O líder redefine a senha de quem está na equipe dele (a senha vale também no sistema de relatórios). */
export function RedefinirSenhaLider({ id, nome }: { id: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)} aria-label={`Redefinir a senha de ${nome}`}>
        <KeyRound /> Senha
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova senha para {nome}</DialogTitle>
            <DialogDescription>A senha é a mesma do sistema de relatórios: a nova vale nos dois. Passe para a pessoa pessoalmente.</DialogDescription>
          </DialogHeader>
          <FormAcao acao={redefinirSenha.bind(null, id)} className="flex items-end gap-2" limpar>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`senha-${id}`}>Nova senha (mínimo 8 caracteres)</Label>
              <Input id={`senha-${id}`} name="senha" type="password" minLength={8} autoComplete="new-password" required />
            </div>
            <Button type="submit">Redefinir</Button>
          </FormAcao>
        </DialogContent>
      </Dialog>
    </>
  );
}
