import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { Cabecalho } from "@/components/app/cabecalho";
import { FormularioObrigatorio } from "@/components/app/formulario-obrigatorio";
import { IndicadorNavegacao } from "@/components/app/indicador-navegacao";
import { RodapeVersiculo } from "@/components/app/versiculo";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { hojeNoFuso } from "@/engine/datas";
import { exigirSessao, type Sessao } from "@/lib/auth";
import { formularioPendente } from "@/lib/dados/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Esqueleto mostrado enquanto a sessão e os dados carregam (shell estático do Cache Components). */
function CarregandoApp() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-64 border-r bg-sidebar md:block" />
      <div className="flex-1 space-y-6 p-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/** Pesquisa obrigatória da rodada, se houver. Carrega à parte: nunca atrasa a página. */
async function BloqueioFormulario({ s }: { s: Sessao }) {
  const db = await criarClienteServidor();
  const pendente = await formularioPendente(db, s, hojeNoFuso());
  if (!pendente) return null;
  return <FormularioObrigatorio formulario={pendente.formulario} rodada={pendente.rodada} admin={s.ehAdmin} />;
}

async function Shell({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  const cookieStore = await cookies();
  const aberto = cookieStore.get("sidebar_state")?.value !== "false";
  const equipes = s.equipes.map((e) => (e.funcao === "lider" ? `líder ${e.nome}` : e.nome)).join(", ");
  return (
    <SidebarProvider defaultOpen={aberto}>
      <AppSidebar perfil={{ admin: s.ehAdmin, gestao: s.vêTudo || s.lidera.length > 0 }} />
      <SidebarInset className="min-w-0">
        <Cabecalho nome={s.colaborador.nome} papel={s.colaborador.papel} equipes={equipes} />
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6" data-conteudo>
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
        <RodapeVersiculo className="mt-6 border-t" />
      </SidebarInset>
      <Suspense fallback={null}>
        <BloqueioFormulario s={s} />
      </Suspense>
      <Suspense fallback={null}>
        <IndicadorNavegacao />
      </Suspense>
    </SidebarProvider>
  );
}

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<CarregandoApp />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
