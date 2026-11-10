import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { Cabecalho } from "@/components/app/cabecalho";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { exigirSessao } from "@/lib/auth";

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
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
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
      </SidebarInset>
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
