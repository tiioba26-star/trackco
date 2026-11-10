import { CabecalhoPagina, NivelBadge } from "@/components/app/blocos";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarColaborador } from "./actions";
import { EditarColaborador } from "./editar";

export const metadata = { title: "Colaboradores" };

const PAPEL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", colaborador: "Colaborador" };

export default async function PaginaColaboradores() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const [{ data }, { data: klingo }] = await Promise.all([
    db
      .from("colaboradores")
      .select("id, nome, login, login_klingo, papel, ativo, auth_id, equipe_membros(fim, funcao, equipes(nome))")
      .order("ativo", { ascending: false })
      .order("nome"),
    db.from("klingo_usuarios").select("login, nome").order("nome"),
  ]);
  type C = {
    id: string;
    nome: string;
    login: string | null;
    login_klingo: string | null;
    papel: string;
    ativo: boolean;
    auth_id: string | null;
    equipe_membros: { fim: string | null; funcao: string; equipes: { nome: string } | null }[];
  };
  const lista = (data ?? []) as unknown as C[];
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <CabecalhoPagina
        titulo="Colaboradores"
        descricao="Quem acessa o Trackco. O usuário e a senha são os mesmos do sistema de relatórios da IOBA."
      />
      <datalist id="logins-klingo">
        {(klingo ?? []).map((k) => (
          <option key={k.login} value={k.login}>
            {k.nome}
          </option>
        ))}
      </datalist>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card data-tour="colab-lista">
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Login Klingo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Equipes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((c) => (
                  <TableRow key={c.id} className={c.ativo ? "" : "opacity-50"}>
                    <TableCell className="font-medium">
                      {c.nome}
                      {!c.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.login ?? "—"}</TableCell>
                    <TableCell>{c.login_klingo ?? <span className="text-down">não vinculado</span>}</TableCell>
                    <TableCell>
                      <NivelBadge nivel={PAPEL[c.papel]} cor={c.papel === "admin" ? "var(--primary)" : "var(--muted-foreground)"} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.equipe_membros
                        .filter((m) => !m.fim || m.fim >= hoje)
                        .map((m) => `${m.equipes?.nome}${m.funcao === "lider" ? " (líder)" : ""}`)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <EditarColaborador c={c} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="h-fit" data-tour="colab-novo">
          <CardHeader>
            <CardTitle>Novo colaborador</CardTitle>
            <CardDescription>
              Se o usuário já existe no sistema de relatórios, ele é só vinculado (a senha continua a mesma). Senão, é criado com a
              senha inicial informada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormAcao acao={criarColaborador} className="space-y-3" limpar>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input name="nome" required />
              </div>
              <div className="space-y-1.5">
                <Label>Usuário de acesso</Label>
                <Input name="login" required autoCapitalize="none" placeholder="ex.: maria.souza" />
              </div>
              <div className="space-y-1.5">
                <Label>Login no Klingo</Label>
                <Input name="login_klingo" list="logins-klingo" autoCapitalize="none" />
              </div>
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <NativeSelect name="papel" defaultValue="colaborador">
                  <option value="colaborador">Colaborador</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Administrador</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Senha inicial (só para usuário novo)</Label>
                <Input name="senha" type="password" autoComplete="new-password" minLength={8} />
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </FormAcao>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
