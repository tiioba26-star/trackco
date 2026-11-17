"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { criarColaborador } from "./actions";

export interface UsuarioKlingo {
  login: string;
  /** nome como está no Klingo, já em "Título" */
  nome: string;
  agendamentos: number;
  /** data da última marcação (AAAA-MM-DD) */
  ultimo: string | null;
}

/** Sugestão de usuário de acesso a partir do login do Klingo (só letras minúsculas, números, ponto, hífen e _). */
function sugerirUsuario(loginKlingo: string): string {
  return loginKlingo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

const dataBR = (d: string | null) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—";

/** Pessoas que marcam no Klingo e ainda não têm cadastro no Trackco: um toque e o cadastro já vem preenchido. */
export function UsuariosDoKlingo({
  usuarios,
  podeAlterar,
}: {
  usuarios: UsuarioKlingo[];
  podeAlterar: boolean;
}) {
  const [escolhido, setEscolhido] = useState<UsuarioKlingo | null>(null);
  if (!usuarios.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todo mundo que marcou no Klingo nos últimos 90 dias já tem cadastro.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-y">
        {usuarios.map((u) => (
          <li
            key={u.login}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {u.nome || u.login}
              </div>
              <div className="text-xs text-muted-foreground">
                {u.login} · {u.agendamentos} marcação(ões) · última em{" "}
                {dataBR(u.ultimo)}
              </div>
            </div>
            {podeAlterar && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => setEscolhido(u)}
              >
                <UserPlus /> Adicionar
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!escolhido} onOpenChange={(v) => !v && setEscolhido(null)}>
        <DialogContent>
          {escolhido && (
            <>
              <DialogHeader>
                <DialogTitle>Adicionar do Klingo</DialogTitle>
                <DialogDescription>
                  Login no Klingo: <b>{escolhido.login}</b>. Confira o nome e
                  escolha o usuário e a senha inicial que a pessoa vai usar no
                  Trackco.
                </DialogDescription>
              </DialogHeader>
              <FormAcao
                key={escolhido.login}
                acao={async (fd) => {
                  const r = await criarColaborador(fd);
                  if (r.ok) setEscolhido(null);
                  return r;
                }}
                className="space-y-3"
              >
                <input
                  type="hidden"
                  name="login_klingo"
                  value={escolhido.login}
                />
                <div className="space-y-2">
                  <Label htmlFor="k-nome">Nome completo</Label>
                  <Input
                    id="k-nome"
                    name="nome"
                    defaultValue={escolhido.nome}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="k-login">Usuário de acesso</Label>
                  <Input
                    id="k-login"
                    name="login"
                    defaultValue={sugerirUsuario(escolhido.login)}
                    required
                    autoCapitalize="none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="k-papel">Perfil</Label>
                  <NativeSelect
                    id="k-papel"
                    name="papel"
                    defaultValue="colaborador"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="gestor">Gestor</option>
                    <option value="leitura">Somente leitura</option>
                    <option value="admin">Administrador</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="k-senha">Senha inicial</Label>
                  <Input
                    id="k-senha"
                    name="senha"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se esse usuário de acesso já existir, ele é aproveitado e a
                    senha continua a mesma.
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Adicionar ao Trackco
                </Button>
              </FormAcao>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
