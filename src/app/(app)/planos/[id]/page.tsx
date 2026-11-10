import { notFound } from "next/navigation";
import { CabecalhoPagina, NivelBadge } from "@/components/app/blocos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { competenciaAnterior, competenciaDe, formatarDataBR, hojeNoFuso } from "@/engine/datas";
import type { DefinicaoPlano } from "@/engine/tipos";
import { exigirAdmin } from "@/lib/auth";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorPlano } from "./editor-plano";

export const metadata = { title: "Plano" };

export default async function PaginaPlano(props: PageProps<"/planos/[id]">) {
  await exigirAdmin();
  const { id } = await props.params;
  const db = await criarClienteServidor();
  const [{ data: plano }, { data: metricas }, { data: versoes }] = await Promise.all([
    db.from("planos").select("id, nome, descricao, modalidade, status, equipe_id, rascunho, equipes(nome)").eq("id", id).maybeSingle(),
    db.from("metricas").select("id, nome, unidade").eq("ativo", true).order("nome"),
    db
      .from("plano_versoes")
      .select("id, numero, vigente_desde, observacao, publicado_em")
      .eq("plano_id", id)
      .order("numero", { ascending: false }),
  ]);
  if (!plano) notFound();
  const atual = competenciaDe(hojeNoFuso());
  const equipe = (plano.equipes as unknown as { nome: string } | null)?.nome;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={plano.nome}
        descricao={
          <span className="inline-flex flex-wrap items-center gap-2">
            Equipe {equipe} ·
            <NivelBadge
              nivel={plano.status === "ativo" ? "Ativo" : plano.status === "rascunho" ? "Rascunho" : "Arquivado"}
              cor={plano.status === "ativo" ? "var(--up)" : "var(--muted-foreground)"}
            />
            · você edita o rascunho; os cálculos usam a versão publicada.
          </span>
        }
      />
      <EditorPlano
        plano={{
          id: plano.id,
          nome: plano.nome,
          descricao: plano.descricao ?? "",
          modalidade: plano.modalidade,
          status: plano.status,
          equipe_id: plano.equipe_id,
        }}
        rascunho={plano.rascunho as DefinicaoPlano}
        metricas={metricas ?? []}
        competencia={atual}
        competenciaAnterior={competenciaAnterior(atual)}
      />
      <Card>
        <CardHeader>
          <CardTitle>Histórico de versões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(versoes ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão publicada.</p>}
          {(versoes ?? []).map((v) => (
            <div key={v.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-medium">Versão {v.numero}</span>{" "}
                <span className="text-muted-foreground">· vale desde {formatarDataBR(v.vigente_desde).slice(3)}</span>
                {v.observacao && <div className="text-muted-foreground">{v.observacao}</div>}
              </div>
              <span className="text-xs text-muted-foreground">publicada em {fmtDataHora(v.publicado_em)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
