import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, StatusPill, Vazio } from "@/components/app/blocos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { competenciaAnterior, competenciaDe, hojeNoFuso, nomeCompetencia } from "@/engine/datas";
import { exigirGestaoOuLider } from "@/lib/auth";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarFechamento } from "./actions";

export const metadata = { title: "Fechamentos" };

export default async function PaginaFechamentos() {
  const s = await exigirGestaoOuLider();
  const db = await criarClienteServidor();
  const [{ data }, { data: equipes }] = await Promise.all([
    db
      .from("fechamentos")
      .select("id, competencia, status, calculado_em, prazo_contestacao, equipes(nome)")
      .order("competencia", { ascending: false })
      .limit(60),
    db.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  type F = {
    id: string;
    competencia: string;
    status: string;
    calculado_em: string | null;
    prazo_contestacao: string | null;
    equipes: { nome: string } | null;
  };
  const lista = (data ?? []) as unknown as F[];
  const sugestao = competenciaAnterior(competenciaDe(hojeNoFuso()));

  return (
    <div>
      <CabecalhoPagina
        titulo="Fechamentos"
        descricao="Congela o resultado do mês depois da conferência. Cada fechamento guarda o cálculo, a versão das regras e o histórico de quem aprovou."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3" data-tour="fech-lista">
          {lista.length === 0 && (
            <Vazio icone={ClipboardCheck} titulo="Nenhum fechamento ainda" texto="Abra o fechamento do mês anterior quando ele terminar." />
          )}
          {lista.map((f) => (
            <Link key={f.id} href={`/fechamentos/${f.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium capitalize">
                      {f.equipes?.nome} · {nomeCompetencia(f.competencia)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.calculado_em ? `Calculado em ${fmtDataHora(f.calculado_em)}` : "Ainda não calculado"}
                    </div>
                  </div>
                  <StatusPill status={f.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {s.ehAdmin && (
          <Card className="h-fit" data-tour="fech-novo">
            <CardHeader>
              <CardTitle>Novo fechamento</CardTitle>
              <CardDescription>Na fase de Reconhecimento o fechamento serve para validar os números com a equipe.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={criarFechamento} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Equipe</Label>
                  <NativeSelect name="equipe_id" required>
                    {(equipes ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label>Mês</Label>
                  <Input type="month" name="competencia" defaultValue={sugestao} required />
                </div>
                <Button type="submit" className="w-full">
                  Abrir fechamento
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
