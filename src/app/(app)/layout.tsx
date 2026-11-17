import { Eye } from "lucide-react";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { Cabecalho } from "@/components/app/cabecalho";
import { ConviteInstalar } from "@/components/app/convite-instalar";
import { FormularioObrigatorio } from "@/components/app/formulario-obrigatorio";
import { IndicadorNavegacao } from "@/components/app/indicador-navegacao";
import { ProvedorLeitura } from "@/components/app/confirmacao";
import { NavInferior } from "@/components/app/nav-inferior";
import { RodapeVersiculo } from "@/components/app/versiculo";
import { HistoriaParabens, OuvinteMeusParabens } from "@/components/retrospectiva/parabens";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { hojeNoFuso } from "@/engine/datas";
import { exigirSessao, type Sessao } from "@/lib/auth";
import { parabensDoDia } from "@/lib/dados/aniversarios";
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

/** Parabéns do aniversário (no dia ou na primeira visita depois). Carrega à parte: nunca atrasa a página. */
async function Parabens({ s }: { s: Sessao }) {
  const dados = await parabensDoDia(s, hojeNoFuso()).catch(() => null);
  if (!dados) return null;
  return <HistoriaParabens dados={dados} />;
}

async function Shell({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  const cookieStore = await cookies();
  const aberto = cookieStore.get("sidebar_state")?.value !== "false";
  const equipes = s.equipes.map((e) => (e.funcao === "lider" ? `líder ${e.nome}` : e.nome)).join(", ");
  return (
    <SidebarProvider defaultOpen={aberto}>
      <AppSidebar perfil={{ admin: s.veComoAdmin, gestao: s.vêTudo || s.lidera.length > 0 }} />
      <SidebarInset className="min-w-0">
        <Cabecalho nome={s.colaborador.nome} papel={s.colaborador.papel} equipes={equipes} />
        {s.somenteLeitura && (
          <p className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground md:px-6">
            <Eye className="size-3.5 shrink-0" />
            Acesso somente leitura: você vê tudo o que o administrador vê. Para mudar algo, peça a um administrador.
          </p>
        )}
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6" data-conteudo>
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            }
          >
            <ProvedorLeitura ativo={s.somenteLeitura}>{children}</ProvedorLeitura>
          </Suspense>
        </div>
        <RodapeVersiculo className="mt-6 border-t" />
      </SidebarInset>
      {/* só o perfil Colaborador (sem gestão nem admin) ganha a barra de baixo no celular */}
      {!s.veComoAdmin && !(s.vêTudo || s.lidera.length > 0) && <NavInferior />}
      <Suspense fallback={null}>
        <BloqueioFormulario s={s} />
      </Suspense>
      <Suspense fallback={null}>
        <Parabens s={s} />
      </Suspense>
      <OuvinteMeusParabens />
      <Suspense fallback={null}>
        <IndicadorNavegacao />
      </Suspense>
      <ConviteInstalar />
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
