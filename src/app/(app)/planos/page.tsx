import { Scale } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, NivelBadge, Vazio } from "@/components/app/blocos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatarDataBR } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarPlano } from "./actions";

export const metadata = { title: "Planos e regras" };

const MODALIDADE: Record<string, string> = {
  reconhecimento: "Reconhecimento",
  premio: "Prêmios",
  dinheiro: "Comissão em R$",
  pontos: "Pontos",
  misto: "Misto",
};

export default async function PaginaPlanos() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const [{ data: planos }, { data: equipes }] = await Promise.all([
    db
      .from("planos")
      .select("id, nome, descricao, status, modalidade, atualizado_em, equipes(nome), plano_versoes(numero, vigente_desde)")
      .order("status")
      .order("nome"),
    db.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  type P = {
    id: string;
    nome: string;
    descricao: string | null;
    status: string;
    modalidade: string;
    equipes: { nome: string } | null;
    plano_versoes: { numero: number; vigente_desde: string }[];
  };
  const lista = (planos ?? []) as unknown as P[];

  return (
    <div>
      <CabecalhoPagina
        titulo="Planos e regras"
        descricao="Como o desempenho vira resultado: indicadores, pesos, faixas, condições e recompensas. Cada equipe tem um plano ativo; cada publicação gera uma versão imutável."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {lista.length === 0 && <Vazio icone={Scale} titulo="Nenhum plano" texto="Crie o primeiro plano ao lado." />}
          {lista.map((p) => {
            const ultima = [...p.plano_versoes].sort((a, b) => b.numero - a.numero)[0];
            return (
              <Link key={p.id} href={`/planos/${p.id}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        <NivelBadge
                          nivel={p.status === "ativo" ? "Ativo" : p.status === "rascunho" ? "Rascunho" : "Arquivado"}
                          cor={p.status === "ativo" ? "var(--up)" : "var(--muted-foreground)"}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {p.equipes?.nome} · {MODALIDADE[p.modalidade] ?? p.modalidade}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {ultima ? `v${ultima.numero} desde ${formatarDataBR(ultima.vigente_desde).slice(3)}` : "sem versão publicada"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Novo plano</CardTitle>
            <CardDescription>Ex.: &quot;Comercial · Prêmios&quot; para a fase 2.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={criarPlano} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" required minLength={3} />
              </div>
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
                <Label>Modalidade</Label>
                <NativeSelect name="modalidade" defaultValue="reconhecimento">
                  {Object.entries(MODALIDADE).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" className="w-full">
                Criar e configurar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
