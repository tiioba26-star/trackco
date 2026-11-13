import { notFound } from "next/navigation";
import { Suspense } from "react";
import { exigirGestaoOuLider } from "@/lib/auth";
import { canalControle } from "@/lib/dados/tv";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ControleRemoto } from "./controle";

export const metadata = { title: "Controle da TV" };

/** Controle remoto de um painel de TV (celular ou PC). Só para quem gerencia o painel. */
async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigirGestaoOuLider();
  const { id } = await params;
  const db = await criarClienteServidor();
  const { data } = await db.from("paineis_tv").select("id, nome, ativo, equipes").eq("id", id).maybeSingle();
  if (!data) notFound();
  if (!s.vêTudo && !((data.equipes as string[]) ?? []).some((e) => s.lidera.includes(e))) notFound();
  return <ControleRemoto canal={canalControle(String(data.id))} nome={String(data.nome)} ativo={data.ativo === true} />;
}

export default function PaginaControle(props: PageProps<"/controle-tv/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#030914]" />}>
      <Conteudo params={props.params} />
    </Suspense>
  );
}
