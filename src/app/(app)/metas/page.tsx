import { Target } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, Vazio } from "@/components/app/blocos";
import { SeletorCompetencia } from "@/components/app/seletor-competencia";
import { competenciaAnterior, competenciaDe, hojeNoFuso, inicioCompetencia } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { membrosDaEquipe, planoVigente } from "@/lib/calculo/carregar";
import { competenciaValida } from "@/lib/formato";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Metrica } from "@/engine/tipos";
import { historicoParaMetas } from "@/lib/dados/sugestoes";
import { Suspense } from "react";
import { GradeMetas } from "./grade-metas";
import { CarregandoRealEsperado, filtrosRealEsperado, RealizadoEsperado } from "./realizado-esperado";

export const metadata = { title: "Metas" };

export default async function PaginaMetas(props: PageProps<"/metas">) {
  await exigirAdmin();
  const sp = await props.searchParams;
  const hoje = hojeNoFuso();
  const atual = competenciaDe(hoje);
  const comp = competenciaValida(sp.comp) ?? atual;
  const db = await criarClienteServidor();
  const { data: equipes } = await db.from("equipes").select("id, nome").eq("ativo", true).order("nome");
  const equipe = (equipes ?? []).find((e) => e.id === sp.equipe) ?? equipes?.[0];

  let conteudo: React.ReactNode = <Vazio icone={Target} titulo="Nenhuma equipe ativa" />;
  if (equipe) {
    const [plano, membros, { data: todas }] = await Promise.all([
      planoVigente(db, equipe.id, comp),
      membrosDaEquipe(db, equipe.id, comp),
      db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao").eq("ativo", true),
    ]);
    const nMeses = sp.meses === "6" ? 6 : 3;
    const idsPlano = Array.from(new Set(plano?.definicao.indicadores.map((i) => i.metrica_id) ?? []));
    // na ordem dos indicadores do plano: a mesma da seção "Realizado × esperado" e do Extrato
    const metricasPlano = ((todas ?? []) as Metrica[])
      .filter((m) => idsPlano.includes(m.id))
      .sort((a, b) => idsPlano.indexOf(a.id) - idsPlano.indexOf(b.id));
    const metricas = metricasPlano.map(({ id, nome, unidade }) => ({ id, nome, unidade }));
    // página exclusiva de admin (exigirAdmin acima): o histórico lê direto, sem o custo das regras por linha
    const historico = plano ? await historicoParaMetas(criarClienteAdmin(), equipe.id, comp, metricasPlano, nMeses) : {};
    const { data: metas } = await db
      .from("metas")
      .select("metrica_id, colaborador_id, equipe_id, valor")
      .eq("competencia", inicioCompetencia(comp))
      .in("metrica_id", idsPlano.length ? idsPlano : ["00000000-0000-0000-0000-000000000000"]);
    const iniciais = (metas ?? [])
      .filter((m) => m.colaborador_id || m.equipe_id === equipe.id)
      .map((m) => ({ metrica_id: m.metrica_id, colaborador_id: m.colaborador_id, valor: Number(m.valor) }));

    conteudo = !plano ? (
      <Vazio
        icone={Target}
        titulo="A equipe não tem plano ativo neste mês"
        texto="As colunas da grade vêm dos indicadores do plano ativo."
        acao={
          <Link href="/planos" className="text-sm text-primary underline">
            Configurar plano
          </Link>
        }
      />
    ) : (
      <GradeMetas
        key={`${equipe.id}-${comp}`}
        equipeId={equipe.id}
        competencia={comp}
        metricas={metricas}
        pessoas={membros.map((m) => ({ id: m.colaborador_id, nome: m.nome, funcao: m.funcao }))}
        iniciais={iniciais}
        historico={historico}
        nMeses={nMeses}
      />
    );
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Metas"
        descricao="Metas mensais por pessoa e da equipe. O painel calcula sozinho o ritmo diário e a projeção."
        acoes={
          <div data-tour="metas-mes" className="flex flex-wrap items-center gap-2">
            {(equipes ?? []).length > 1 && (
              <div className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
                {(equipes ?? []).map((e) => (
                  <Link
                    key={e.id}
                    href={`/metas?equipe=${e.id}&comp=${comp}`}
                    className={cn("rounded-md px-3 py-1", e.id === equipe?.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {e.nome}
                  </Link>
                ))}
              </div>
            )}
            <SeletorCompetencia competencia={comp} maxima={competenciaAnterior(atual, -3)} />
          </div>
        }
      />
      {conteudo}
      {equipe && (
        <Suspense
          key={JSON.stringify({ e: equipe.id, ...filtrosRealEsperado(sp, hoje) })}
          fallback={
            <div className="mt-10 space-y-4">
              <h3 className="text-lg font-semibold">Realizado × esperado por pessoa</h3>
              <CarregandoRealEsperado />
            </div>
          }
        >
          <RealizadoEsperado
            equipe={equipe}
            sp={sp}
            hoje={hoje}
            manter={{ equipe: equipe.id, comp, ...(sp.meses === "6" ? { meses: "6" } : {}) }}
          />
        </Suspense>
      )}
    </div>
  );
}
