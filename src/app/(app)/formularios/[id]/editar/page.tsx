import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/app/blocos";
import { hojeNoFuso } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { obterFormulario } from "@/lib/dados/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorFormulario } from "../../editor";

export const metadata = { title: "Editar formulário" };

export default async function PaginaEditarFormulario(props: PageProps<"/formularios/[id]/editar">) {
  await exigirAdmin();
  const { id } = await props.params;
  const db = await criarClienteServidor();
  const [f, { data: equipes }, { count }] = await Promise.all([
    obterFormulario(db, id),
    db.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
    db.from("formulario_envios").select("formulario_id", { count: "exact", head: true }).eq("formulario_id", id),
  ]);
  if (!f) notFound();
  const { id: _, ...dados } = f;
  return (
    <div>
      <CabecalhoPagina titulo="Editar formulário" descricao={f.titulo} />
      <EditorFormulario id={f.id} inicial={dados} equipes={equipes ?? []} hoje={hojeNoFuso()} temRespostas={(count ?? 0) > 0} />
    </div>
  );
}
