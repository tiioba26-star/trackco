"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { itemAtivo, NAV, type ItemNav, type Perfil } from "./nav";

/**
 * Grupos do menu com o que a pessoa pode ver. Para quem não é administrador, o que sobra de
 * "Configuração" (Colaboradores, Painéis de TV) vai para "Gestão": um grupo com 2 itens soltos confunde.
 */
function gruposVisiveis(admin: boolean, pode: (p: Perfil) => boolean): { titulo: string; itens: ItemNav[] }[] {
  const grupos = NAV.map((g) => ({ titulo: g.titulo, itens: g.itens.filter((i) => pode(i.perfil)) })).filter((g) => g.itens.length);
  if (admin) return grupos;
  const config = grupos.find((g) => g.titulo === "Configuração");
  const gestao = grupos.find((g) => g.titulo === "Gestão");
  if (!config || !gestao) return grupos;
  gestao.itens = [...gestao.itens, ...config.itens];
  return grupos.filter((g) => g !== config);
}

export function AppSidebar({ perfil }: { perfil: { admin: boolean; gestao: boolean } }) {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);
  const { setOpenMobile } = useSidebar();
  const pode = (p: Perfil) => p === "todos" || (p === "lider" && perfil.gestao) || (p === "admin" && perfil.admin);
  const grupos = gruposVisiveis(perfil.admin, pode);

  return (
    <Sidebar collapsible="icon" data-tour="menu">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="group-data-[collapsible=icon]:hidden" onClick={() => setOpenMobile(false)}>
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {grupos.map(({ titulo, itens }) => {
          const g = { titulo };
          return (
            <SidebarGroup key={g.titulo}>
              <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {itens.map((i) => (
                    <SidebarMenuItem key={i.href}>
                      <SidebarMenuButton
                        isActive={ativo?.href === i.href}
                        tooltip={i.titulo}
                        data-tour={i.tour}
                        render={<Link href={i.href} onClick={() => setOpenMobile(false)} />}
                      >
                        <i.icone />
                        <span>{i.titulo}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
        trackco.ioba.com.br
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
