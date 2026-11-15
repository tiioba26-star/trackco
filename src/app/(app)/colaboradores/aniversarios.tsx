import { CabecalhoPagina } from "@/components/app/blocos";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hojeNoFuso } from "@/engine/datas";
import type { Sessao } from "@/lib/auth";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { salvarNascimento } from "./actions";

/** Datas de nascimento por colaborador (null se a migração de aniversários ainda não foi aplicada). */
export async function nascimentos(): Promise<Map<string, string> | null> {
  const { data, error } = await criarClienteAdmin().from("colaboradores").select("id, nascimento");
  if (error) return null;
  return new Map((data ?? []).filter((c) => c.nascimento).map((c) => [String(c.id), String(c.nascimento).slice(0, 10)]));
}

/** O que o líder (ou gestor) vê em Colaboradores: só o aniversário de quem está nas equipes dele. */
export async function AniversariosDaEquipe({ s }: { s: Sessao }) {
  const admin = criarClienteAdmin();
  const hoje = hojeNoFuso();
  const { data: membros } = await admin
    .from("equipe_membros")
    .select("colaborador_id, equipe_id, funcao, fim, equipes(nome)")
    .or(`fim.is.null,fim.gte.${hoje}`);
  type M = { colaborador_id: string; equipe_id: string; funcao: string; equipes: { nome: string } | null };
  const visiveis = ((membros ?? []) as unknown as M[]).filter((m) => s.vêTudo || s.lidera.includes(m.equipe_id));
  const ids = Array.from(new Set(visiveis.map((m) => m.colaborador_id)));
  const [{ data: pessoas }, nasc] = await Promise.all([
    ids.length
      ? admin.from("colaboradores").select("id, nome").eq("ativo", true).in("id", ids).order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    nascimentos(),
  ]);
  const equipesDe = (id: string) =>
    visiveis
      .filter((m) => m.colaborador_id === id)
      .map((m) => `${m.equipes?.nome ?? "—"}${m.funcao === "lider" ? " (líder)" : ""}`)
      .join(", ");

  return (
    <div>
      <CabecalhoPagina
        titulo="Colaboradores"
        descricao="Lance aqui a data de aniversário de quem está na sua equipe. No dia, a pessoa recebe os parabéns ao abrir o Trackco, e você vê os aniversariantes na retrospectiva do mês."
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Aniversários da equipe</CardTitle>
          <CardDescription>
            O Klingo não guarda a data de nascimento dos funcionários, por isso ela é lançada aqui. A idade nunca aparece para a
            equipe: só o dia e o mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!nasc ? (
            <p className="text-sm text-muted-foreground">
              Os aniversários ainda não estão disponíveis: falta um administrador aplicar a atualização do banco.
            </p>
          ) : !pessoas?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma pessoa na sua equipe agora.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Data de nascimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pessoas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{equipesDe(p.id)}</TableCell>
                    <TableCell>
                      <FormAcao acao={salvarNascimento.bind(null, p.id)} className="flex items-center gap-2">
                        <Input
                          name="nascimento"
                          type="date"
                          aria-label={`Data de nascimento de ${p.nome}`}
                          defaultValue={nasc.get(p.id) ?? ""}
                          max={hoje}
                          className="w-40"
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Salvar
                        </Button>
                      </FormAcao>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
