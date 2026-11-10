import { Users } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, NivelBadge } from "@/components/app/blocos";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarEquipe } from "./actions";

export const metadata = { title: "Equipes" };

const VIS: Record<string, string> = { aberto: "Ranking aberto", posicoes: "Só posições", privado: "Privado" };

export default async function PaginaEquipes() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const { data } = await db
    .from("equipes")
    .select("id, nome, descricao, ativo, visibilidade_ranking, equipe_membros(id, funcao, fim, colaboradores(nome)), planos(nome, status)")
    .order("nome");
  type E = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    visibilidade_ranking: string;
    equipe_membros: { id: string; funcao: string; fim: string | null; colaboradores: { nome: string } | null }[];
    planos: { nome: string; status: string }[];
  };
  const equipes = (data ?? []) as unknown as E[];
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <CabecalhoPagina
        titulo="Equipes"
        descricao="Comece pelo Comercial e adicione outras equipes (limpeza, recepção…) quando quiser. Cada equipe tem seu plano, metas e regras de visibilidade."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3 md:grid-cols-2" data-tour="equipes-lista">
          {equipes.map((e) => {
            const ativos = e.equipe_membros.filter((m) => !m.fim || m.fim >= hoje);
            const lider = ativos.find((m) => m.funcao === "lider");
            const plano = e.planos.find((p) => p.status === "ativo");
            return (
              <Link key={e.id} href={`/equipes/${e.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {e.nome}
                      {!e.ativo && <NivelBadge nivel="Inativa" cor="var(--muted-foreground)" />}
                    </CardTitle>
                    {e.descricao && <CardDescription>{e.descricao}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="size-4" /> {ativos.length} pessoa(s) · líder: {lider?.colaboradores?.nome ?? "não definido"}
                    </div>
                    <div>Plano: {plano?.nome ?? "nenhum ativo"}</div>
                    <div>{VIS[e.visibilidade_ranking]}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nova equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <FormAcao acao={criarEquipe} className="space-y-3" limpar>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="descricao">Descrição</Label>
                <Input id="descricao" name="descricao" />
              </div>
              <Button type="submit" className="w-full">
                Criar equipe
              </Button>
            </FormAcao>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
