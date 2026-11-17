"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useConfirmar } from "@/components/app/confirmacao";
import { NivelBadge } from "@/components/app/blocos";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { darAcesso, definirAcesso } from "./actions";
import { EditarColaborador } from "./editar";

export interface LinhaColab {
  chave: string;
  /** null = está só no Klingo (ainda sem cadastro no Trackco) */
  id: string | null;
  nome: string;
  login: string | null;
  loginKlingo: string | null;
  papel: string;
  ativo: boolean;
  /** tem usuário e senha */
  temLogin: boolean;
  /** pode entrar no Trackco agora */
  acesso: boolean;
  equipes: string;
  aniversario: string | null;
  /** AAAA-MM-DD; null quando a migração de aniversários não foi aplicada */
  nascimento: string | null;
  /** agendamentos no Klingo nos últimos 90 dias (para quem está só no Klingo) */
  marcacoes90: number;
}

const PAPEL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", leitura: "Somente leitura", colaborador: "Colaborador" };

type Filtro = "todos" | "com" | "sem";

function sugerirUsuario(base: string): string {
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

/** Todo mundo numa tabela só: quem está no Trackco e quem está só no Klingo. O botão deslizante liga o acesso ao sistema. */
export function TabelaColaboradores({ linhas, podeAlterar, meuId }: { linhas: LinhaColab[]; podeAlterar: boolean; meuId: string }) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [criar, setCriar] = useState<LinhaColab | null>(null);
  const [pendente, iniciar] = useTransition();

  const conta = { todos: linhas.length, com: linhas.filter((l) => l.acesso).length, sem: linhas.filter((l) => !l.acesso).length };
  const visiveis = useMemo(() => {
    const q = busca
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return linhas.filter((l) => {
      if (filtro === "com" && !l.acesso) return false;
      if (filtro === "sem" && l.acesso) return false;
      if (!q) return true;
      const alvo = `${l.nome} ${l.login ?? ""} ${l.loginKlingo ?? ""} ${l.equipes}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return alvo.includes(q);
    });
  }, [linhas, filtro, busca]);

  const alternar = async (l: LinhaColab, ligar: boolean) => {
    if (ligar && !l.temLogin) return setCriar(l); // ainda sem usuário e senha: cria o acesso
    if (!l.id) return;
    if (
      !ligar &&
      !(await confirmar({
        titulo: `Tirar o acesso de ${l.nome}?`,
        texto: "A pessoa deixa de entrar no Trackco na hora. Os números dela continuam sendo contados e você pode devolver o acesso quando quiser.",
        confirmar: "Tirar acesso",
        perigo: true,
      }))
    )
      return;
    iniciar(async () => {
      const r = await definirAcesso(l.id!, ligar);
      if (r.ok) {
        toast.success(r.mensagem ?? "Salvo.");
        router.refresh();
      } else toast.error(r.erro ?? "Não foi possível concluir.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-card p-1" role="tablist" aria-label="Filtrar por acesso">
          {(
            [
              ["todos", "Todos"],
              ["com", "Com acesso"],
              ["sem", "Sem acesso"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filtro === k}
              onClick={() => setFiltro(k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filtro === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t} <span className="tabular-nums opacity-80">{conta[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, usuário ou equipe" className="h-9 pl-8" aria-label="Buscar" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Login Klingo</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Equipes</TableHead>
              <TableHead>Aniversário</TableHead>
              <TableHead className="text-right">Acesso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((l) => (
              <TableRow key={l.chave} className={l.ativo ? "" : "opacity-50"}>
                <TableCell>
                  <div className="font-medium">{l.nome}</div>
                  {!l.id && (
                    <div className="text-xs text-muted-foreground">
                      Só no Klingo{l.marcacoes90 ? ` · ${l.marcacoes90} agendamento(s) em 90 dias` : " · sem agendamentos recentes"}
                    </div>
                  )}
                  {!l.ativo && <div className="text-xs text-muted-foreground">Saiu da clínica</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.login ?? "—"}</TableCell>
                <TableCell>{l.loginKlingo ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {l.id ? (
                    <NivelBadge nivel={PAPEL[l.papel] ?? l.papel} cor={l.papel === "admin" ? "var(--primary)" : "var(--muted-foreground)"} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.equipes || "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{l.aniversario ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Switch
                      checked={l.acesso}
                      disabled={!podeAlterar || pendente || (l.id === meuId && l.acesso)}
                      onCheckedChange={(v) => void alternar(l, v)}
                      aria-label={l.acesso ? `Tirar o acesso de ${l.nome}` : `Dar acesso a ${l.nome}`}
                      title={l.acesso ? "Pode entrar no Trackco" : l.temLogin ? "Acesso desligado" : "Sem usuário e senha"}
                    />
                    {l.id ? (
                      <EditarColaborador
                        c={{ id: l.id, nome: l.nome, login: l.login, login_klingo: l.loginKlingo, papel: l.papel, ativo: l.ativo }}
                        nascimento={l.nascimento}
                      />
                    ) : (
                      <span className="size-7" aria-hidden />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!visiveis.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Ninguém encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!criar} onOpenChange={(v) => !v && setCriar(null)}>
        <DialogContent>
          {criar && (
            <>
              <DialogHeader>
                <DialogTitle>Dar acesso ao Trackco</DialogTitle>
                <DialogDescription>
                  {criar.nome} ainda não tem usuário e senha.
                  {criar.loginKlingo ? ` Login no Klingo: ${criar.loginKlingo}.` : ""}
                </DialogDescription>
              </DialogHeader>
              <FormAcao
                key={criar.chave}
                acao={async (fd) => {
                  const r = await darAcesso(criar.id ?? `klingo:${criar.loginKlingo}`, fd);
                  if (r.ok) setCriar(null);
                  return r;
                }}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="a-nome">Nome completo</Label>
                  <Input id="a-nome" name="nome" defaultValue={criar.nome} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-login">Usuário de acesso</Label>
                  <Input id="a-login" name="login" defaultValue={sugerirUsuario(criar.loginKlingo ?? criar.nome)} required autoCapitalize="none" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-papel">Perfil</Label>
                  <NativeSelect id="a-papel" name="papel" defaultValue={criar.id ? criar.papel : "colaborador"}>
                    <option value="colaborador">Colaborador</option>
                    <option value="gestor">Gestor</option>
                    <option value="leitura">Somente leitura</option>
                    <option value="admin">Administrador</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-senha">Senha inicial</Label>
                  <Input id="a-senha" name="senha" type="password" autoComplete="new-password" minLength={8} />
                  <p className="text-xs text-muted-foreground">Se esse usuário já existir, ele é aproveitado e a senha continua a mesma.</p>
                </div>
                <Button type="submit" className="w-full">
                  Dar acesso
                </Button>
              </FormAcao>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
