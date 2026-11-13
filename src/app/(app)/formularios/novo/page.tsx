import { CabecalhoPagina } from "@/components/app/blocos";
import { hojeNoFuso } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { MODELOS } from "@/lib/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EditorFormulario } from "../editor";

export const metadata = { title: "Novo formulário" };

export default async function PaginaNovoFormulario(props: PageProps<"/formularios/novo">) {
  await exigirAdmin();
  const sp = await props.searchParams;
  const modelo = MODELOS.find((m) => m.id === sp.modelo) ?? MODELOS[0];
  const db = await criarClienteServidor();
  const { data: equipes } = await db.from("equipes").select("id, nome").eq("ativo", true).order("nome");
  return (
    <div>
      <CabecalhoPagina titulo="Novo formulário" descricao={`Modelo: ${modelo.titulo}. ${modelo.porque}`} />
      <EditorFormulario
        id={null}
        inicial={{ ...modelo.dados, inicio: null, ativo: false, publico: { equipes: [], funcoes: ["membro", "lider"] } }}
        equipes={equipes ?? []}
        hoje={hojeNoFuso()}
        temRespostas={false}
      />
    </div>
  );
}
