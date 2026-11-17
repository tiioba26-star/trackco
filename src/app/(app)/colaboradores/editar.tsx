"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { atualizarColaborador, redefinirSenha, salvarNascimento } from "./actions";
import { BotaoPreviaParabens } from "@/components/retrospectiva/parabens";
import { Campo } from "@/components/ui/campo";

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
          {/* três partes independentes: cada uma com título e um botão que diz o que salva */}
          <FormAcao acao={atualizarColaborador.bind(null, c.id)} className="space-y-5">
            <h3 className="text-sm font-semibold">Dados e perfil</h3>
            <Campo rotulo="Nome">
              <Input name="nome" defaultValue={c.nome} required />
            </Campo>
            <Campo rotulo="Login no Klingo (campo Responsável)" dica="colab.klingo">
              <Input name="login_klingo" defaultValue={c.login_klingo ?? ""} list="logins-klingo" />
            </Campo>
            <Campo rotulo="Perfil" dica="colab.perfil">
              <NativeSelect name="papel" defaultValue={c.papel}>
                <option value="colaborador">Colaborador</option>
                <option value="gestor">Gestor (vê tudo, não configura)</option>
                <option value="leitura">Somente leitura (vê o que o administrador vê, não altera nada)</option>
                <option value="admin">Administrador</option>
              </NativeSelect>
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="ativo" defaultChecked={c.ativo} /> Ainda trabalha na clínica (desmarque só para quem saiu)
            </label>
            <Button type="submit">Salvar dados</Button>
          </FormAcao>
          {nascimento !== null && (
            <>
              <Separator />
              <FormAcao acao={salvarNascimento.bind(null, c.id)} className="space-y-2">
                <h3 className="text-sm font-semibold">Aniversário</h3>
                <div className="flex items-end gap-2">
                  <Campo rotulo="Data de nascimento (para os parabéns)" htmlFor={`nasc-${c.id}`} className="flex-1">
                    <Input id={`nasc-${c.id}`} name="nascimento" type="date" defaultValue={nascimento} max={new Date().toISOString().slice(0, 10)} />
                  </Campo>
                  <Button type="submit" variant="outline">
                    Salvar aniversário
                  </Button>
                </div>
              </FormAcao>
              {nascimento && (
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  Veja como a pessoa vai receber os parabéns.
                  <BotaoPreviaParabens id={c.id} nome={c.nome} />
                </div>
              )}
            </>
          )}
          <Separator />
          <FormAcao acao={redefinirSenha.bind(null, c.id)} className="space-y-2" limpar>
            <h3 className="text-sm font-semibold">Senha de acesso</h3>
            <div className="flex items-end gap-2">
              <Campo rotulo="Nova senha (mínimo 8 caracteres)" htmlFor={`senha-${c.id}`} className="flex-1">
                <Input id={`senha-${c.id}`} name="senha" type="password" minLength={8} autoComplete="new-password" required />
              </Campo>
              <Button type="submit" variant="outline">
                Definir nova senha
              </Button>
            </div>
          </FormAcao>
        </DialogContent>
      </Dialog>
    </>
  );
}
