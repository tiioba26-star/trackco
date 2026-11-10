import { Plus } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/app/blocos";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { campoDaFonte, FONTES } from "@/engine/fontes";
import { descreverContagem } from "@/engine/metricas";
import type { Metrica } from "@/engine/tipos";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Métricas" };

function resumo(m: Metrica): string {
  const d = m.definicao;
  const r = (f: Parameters<typeof campoDaFonte>[0]) => (c: string) => campoDaFonte(f, c)?.rotulo.toLowerCase() ?? c;
  if (d.tipo_calculo === "taxa") {
    return `${descreverContagem(d.numerador, r(d.numerador.fonte))} ÷ ${descreverContagem(d.denominador, r(d.denominador.fonte))}`;
  }
  return descreverContagem(d, r(d.fonte));
}

export default async function PaginaMetricas() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const { data } = await db.from("metricas").select("*").order("ativo", { ascending: false }).order("nome");
  const metricas = (data ?? []) as Metrica[];

  return (
    <div>
      <CabecalhoPagina
        titulo="Métricas"
        descricao="O que é medido. Cada métrica lê uma fonte de dados (Klingo ou lançamentos), escolhe a data que define o mês e aplica filtros."
        acoes={
          <Link href="/metricas/nova" className={buttonVariants()} data-tour="met-nova">
            <Plus /> Nova métrica
          </Link>
        }
      />
      <div className="grid gap-3 md:grid-cols-2" data-tour="met-lista">
        {metricas.map((m) => {
          const fonte = m.definicao.tipo_calculo === "taxa" ? m.definicao.numerador.fonte : m.definicao.fonte;
          return (
            <Link key={m.id} href={`/metricas/${m.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{m.nome}</div>
                      <div className="font-mono text-xs text-muted-foreground">{m.codigo}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge variant={m.tipo === "quantitativa" ? "secondary" : "outline"}>{m.tipo}</Badge>
                      <Badge variant="outline">{m.unidade}</Badge>
                      {!m.ativo && <Badge variant="destructive">inativa</Badge>}
                    </div>
                  </div>
                  {m.descricao && <p className="text-sm text-muted-foreground">{m.descricao}</p>}
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{FONTES[fonte]?.rotulo}</span> · {resumo(m)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
