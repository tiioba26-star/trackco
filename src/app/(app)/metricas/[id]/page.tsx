import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/app/blocos";
import { competenciaDe, hojeNoFuso } from "@/engine/datas";
import type { Metrica } from "@/engine/tipos";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorMetrica } from "../editor-metrica";

export const metadata = { title: "Editar métrica" };

export default async function PaginaEditarMetrica(props: PageProps<"/metricas/[id]">) {
  await exigirAdmin();
  const { id } = await props.params;
  let metrica: Metrica | null = null;
  if (id !== "nova") {
    const db = await criarClienteServidor();
    const { data } = await db.from("metricas").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    metrica = data as Metrica;
  }
  return (
    <div>
      <CabecalhoPagina
        titulo={metrica ? `Métrica: ${metrica.nome}` : "Nova métrica"}
        descricao="Alterações valem a partir do próximo recálculo. Fechamentos já aprovados não mudam."
      />
      <EditorMetrica metrica={metrica} competencia={competenciaDe(hojeNoFuso())} />
    </div>
  );
}
