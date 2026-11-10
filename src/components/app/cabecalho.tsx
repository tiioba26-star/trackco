"use client";

import { KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const PAPEL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", colaborador: "Colaborador" };

export function Cabecalho({ nome, papel, equipes }: { nome: string; papel: string; equipes: string }) {
  const pathname = usePathname();
  const titulo = itemAtivo(pathname)?.titulo ?? "Trackco";
  const { theme, setTheme } = useTheme();
  const proximo = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const IconeTema = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <h1 className="truncate text-base font-semibold">{titulo}</h1>
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
            <DropdownMenuItem variant="destructive" onClick={() => sair()}>
              <LogOut /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
