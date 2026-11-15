"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { atualizarColaborador, redefinirSenha, salvarNascimento } from "./actions";
import { Dica } from "@/components/ajuda/dica";

export function EditarColaborador({
  c,
  nascimento,
}: {
  c: { id: string; nome: string; login: string | null; login_klingo: string | null; papel: string; ativo: boolean };
  /** null: a migração de aniversários ainda não foi aplicada */
  nascimento: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${c.nome}`} onClick={() => setAberto(true)}>
        <Pencil />
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c.nome}</DialogTitle>
            <DialogDescription>Usuário de acesso: {c.login ?? "—"}</DialogDescription>
          </DialogHeader>
          <FormAcao acao={atualizarColaborador.bind(null, c.id)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input name="nome" defaultValue={c.nome} required />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1"><Label>Login no Klingo (campo Responsável)</Label><Dica id="colab.klingo" /></div>
              <Input name="login_klingo" defaultValue={c.login_klingo ?? ""} list="logins-klingo" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1"><Label>Perfil</Label><Dica id="colab.perfil" /></div>
              <NativeSelect name="papel" defaultValue={c.papel}>
                <option value="colaborador">Colaborador</option>
                <option value="gestor">Gestor (vê tudo, não configura)</option>
                <option value="admin">Administrador</option>
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={c.ativo} /> Acesso ativo
            </label>
            <Button type="submit">Salvar</Button>
          </FormAcao>
          {nascimento !== null && (
            <>
              <Separator />
              <FormAcao acao={salvarNascimento.bind(null, c.id)} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`nasc-${c.id}`}>Data de nascimento (para os parabéns)</Label>
                  <Input id={`nasc-${c.id}`} name="nascimento" type="date" defaultValue={nascimento} max={new Date().toISOString().slice(0, 10)} />
                </div>
                <Button type="submit" variant="outline">
                  Salvar
                </Button>
              </FormAcao>
            </>
          )}
          <Separator />
          <FormAcao acao={redefinirSenha.bind(null, c.id)} className="flex items-end gap-2" limpar>
            <div className="flex-1 space-y-1.5">
              <Label>Nova senha</Label>
              <Input name="senha" type="password" minLength={8} autoComplete="new-password" required />
            </div>
            <Button type="submit" variant="outline">
              Redefinir
            </Button>
          </FormAcao>
          <p className="text-xs text-muted-foreground">
            O login é compartilhado com o sistema de relatórios: a nova senha vale nos dois.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
