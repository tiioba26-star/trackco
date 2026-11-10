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
import { itemAtivo, NAV, type Perfil } from "./nav";

export function AppSidebar({ perfil }: { perfil: { admin: boolean; gestao: boolean } }) {
  const pathname = usePathname();
  const ativo = itemAtivo(pathname);
  const { setOpenMobile } = useSidebar();
  const pode = (p: Perfil) => p === "todos" || (p === "lider" && perfil.gestao) || (p === "admin" && perfil.admin);

  return (
    <Sidebar collapsible="icon" data-tour="menu">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="group-data-[collapsible=icon]:hidden" onClick={() => setOpenMobile(false)}>
          <Logo />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((g) => {
          const itens = g.itens.filter((i) => pode(i.perfil));
          if (!itens.length) return null;
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
