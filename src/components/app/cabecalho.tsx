"use client";

import { Cake, ChevronLeft, KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { sair } from "@/app/login/actions";
import { BotaoAjuda } from "@/components/ajuda/botao-ajuda";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { itemAtivo } from "./nav";

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const PAPEL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", leitura: "Somente leitura", colaborador: "Colaborador" };

export function Cabecalho({ nome, papel, equipes }: { nome: string; papel: string; equipes: string }) {
  const pathname = usePathname();
  const item = itemAtivo(pathname);
  const titulo = item?.titulo ?? (pathname === "/trocar-senha" ? "Trocar senha" : "Trackco");
  // tela de detalhe (uma equipe, um plano…): o topo vira "‹ Equipes" para voltar à lista
  const detalhe = item && item.href !== "/" && pathname !== item.href ? item : null;
  const { theme: temaSalvo, setTheme } = useTheme();
  // o tema só é conhecido no navegador: até lá, "system" (igual ao servidor, sem diferença na hidratação)
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const theme = montado ? temaSalvo : "system";
  const proximo = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const IconeTema = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      {/* o título grande já está na página: aqui ele fica só para o leitor de tela (antes aparecia duas vezes) */}
      <h1 className="sr-only">{titulo}</h1>
      {detalhe && (
        <Link
          href={detalhe.href}
          className="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {detalhe.titulo}
        </Link>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <BotaoAjuda />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Tema: ${theme === "system" ? "automático" : theme === "dark" ? "escuro" : "claro"}`}
          onClick={() => setTheme(proximo)}
        >
          <IconeTema />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-9 gap-2 px-1.5">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">{iniciais(nome)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate text-sm md:inline">{nome.split(" ")[0]}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="space-y-0.5">
                <div className="truncate text-sm font-medium text-foreground">{nome}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {PAPEL[papel] ?? papel}
                  {equipes ? ` · ${equipes}` : ""}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/trocar-senha" />}>
              <KeyRound /> Trocar senha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new Event("trackco:meus-parabens"))}>
              <Cake /> Meus parabéns
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => sair()}>
              <LogOut /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
