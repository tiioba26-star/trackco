import {
  BarChart3,
  ClipboardCheck,
  Database,
  FileText,
  Flag,
  Gauge,
  History,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  MessageSquareWarning,
  Monitor,
  Scale,
  Target,
  UserMinus,
  Users,
  UsersRound,
} from "lucide-react";

export type Perfil = "todos" | "lider" | "admin";

export interface ItemNav {
  href: string;
  titulo: string;
  icone: LucideIcon;
  perfil: Perfil;
  tour: string;
}

export interface GrupoNav {
  titulo: string;
  itens: ItemNav[];
}

export const NAV: GrupoNav[] = [
  {
    titulo: "Acompanhamento",
    itens: [
      { href: "/", titulo: "Painel", icone: LayoutDashboard, perfil: "todos", tour: "nav-painel" },
      { href: "/extrato", titulo: "Extrato", icone: FileText, perfil: "todos", tour: "nav-extrato" },
      { href: "/analise", titulo: "Análise", icone: LineChart, perfil: "todos", tour: "nav-analise" },
      { href: "/contestacoes", titulo: "Contestações", icone: MessageSquareWarning, perfil: "todos", tour: "nav-contestacoes" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/fechamentos", titulo: "Fechamentos", icone: ClipboardCheck, perfil: "lider", tour: "nav-fechamentos" },
      { href: "/relatorios", titulo: "Relatórios", icone: BarChart3, perfil: "lider", tour: "nav-relatorios" },
      { href: "/ausencias", titulo: "Ausências", icone: UserMinus, perfil: "lider", tour: "nav-ausencias" },
    ],
  },
  {
    titulo: "Configuração",
    itens: [
      { href: "/metricas", titulo: "Métricas", icone: Gauge, perfil: "admin", tour: "nav-metricas" },
      { href: "/planos", titulo: "Planos e regras", icone: Scale, perfil: "admin", tour: "nav-planos" },
      { href: "/metas", titulo: "Metas", icone: Target, perfil: "admin", tour: "nav-metas" },
      { href: "/equipes", titulo: "Equipes", icone: UsersRound, perfil: "admin", tour: "nav-equipes" },
      { href: "/colaboradores", titulo: "Colaboradores", icone: Users, perfil: "admin", tour: "nav-colaboradores" },
      { href: "/dados", titulo: "Dados e lançamentos", icone: Database, perfil: "admin", tour: "nav-dados" },
      { href: "/paineis-tv", titulo: "Painéis de TV", icone: Monitor, perfil: "lider", tour: "nav-tv" },
      { href: "/auditoria", titulo: "Auditoria", icone: History, perfil: "admin", tour: "nav-auditoria" },
    ],
  },
];

export function itemAtivo(pathname: string): ItemNav | undefined {
  const todos = NAV.flatMap((g) => g.itens);
  if (pathname === "/") return todos[0];
  return todos
    .filter((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export const ICONE_MARCA = Flag;
