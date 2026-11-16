import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, FileSpreadsheet } from "lucide-react";
import { CabecalhoPagina } from "@/components/app/blocos";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { titulo } from "@/engine/classificacao";
import { exigirAdmin } from "@/lib/auth";
import { filtrosParaUrl, lerFiltros, opcoesDosFiltros, type AgruparPor, type FiltrosGestao } from "@/lib/dados/gestao";
import { cn } from "@/lib/utils";
import { AbaConversao } from "./aba-conversao";
import { AbaEquipes } from "./aba-equipes";
import { AbaFaturamento } from "./aba-faturamento";
import { AbaPerdas } from "./aba-perdas";
import { AbaQuem } from "./aba-quem";
import { PeriodoGestaoCampos } from "./periodo";

export const metadata = { title: "Gestão" };

const ABAS = [
  { k: "faturamento", t: "Faturamento" },
  { k: "conversao", t: "Marcação → R$" },
  { k: "equipes", t: "Equipes" },
  { k: "quem", t: "Quem marca para quem" },
  { k: "perdas", t: "Perdas e operadoras" },
] as const;
type Aba = (typeof ABAS)[number]["k"];

const um = <T extends string>(v: unknown, ops: readonly T[], padrao: T): T => (typeof v === "string" && (ops as readonly string[]).includes(v) ? (v as T) : padrao);

async function Filtros({ f, aba }: { f: FiltrosGestao; aba: Aba }) {
  const o = await opcoesDosFiltros(f);
  const sel = (nome: string, valor: string, opcoes: { v: string; t: string }[], todos: string) => (
    <NativeSelect id={`g-${nome}`} name={nome} defaultValue={valor} className="w-full">
      <option value="">{todos}</option>
      {opcoes.map((x) => (
        <option key={x.v} value={x.v}>
          {x.t}
        </option>
      ))}
    </NativeSelect>
  );
  return (
    <Card data-tour="gestao-filtros">
      <CardContent className="space-y-4">
        <Form action="/gestao" className="space-y-3">
          <input type="hidden" name="aba" value={aba} />
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
            {/* a key recria os campos quando a URL muda (ex.: "Limpar filtros") */}
            <PeriodoGestaoCampos
              key={`${f.janela.periodo}|${f.janela.inicio}|${f.janela.fim}|${f.comparar}`}
              periodo={f.janela.periodo}
              inicio={f.janela.inicio}
              fim={f.janela.fim}
              comparar={f.comparar}
              hoje={f.hoje}
            />
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="g-equipe">Equipe</Label>
              {sel("equipe", f.equipe, o.equipes.map((e) => ({ v: e, t: e })), "Clínica toda")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-pessoa">Quem marcou</Label>
              {sel("pessoa", f.pessoa, o.pessoas.map((p) => ({ v: p.login, t: p.nome })), "Todas as pessoas")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-operadora">Operadora</Label>
              <NativeSelect id="g-operadora" name="operadora" defaultValue={f.operadora} className="w-full">
                <option value="Particular">Particular</option>
                <option value="SUS">SUS</option>
                <option value="Convênios">Convênios</option>
                <option value="todas">Todas</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-categoria">Categoria</Label>
              {sel("categoria", f.categoria, o.categorias.map((c) => ({ v: c, t: titulo(c) })), "Todas")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-medico">Médico / agenda</Label>
              {sel("medico", f.medico, o.medicos.map((m) => ({ v: m, t: titulo(m) })), "Todos")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-procedimento">Procedimento</Label>
              {sel("procedimento", f.procedimento, o.procedimentos.map((p) => ({ v: p, t: p })), "Todos")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-cortesia">Cortesias</Label>
              <NativeSelect id="g-cortesia" name="cortesia" defaultValue={f.cortesia} className="w-full">
                <option value="incluir">Incluir</option>
                <option value="excluir">Tirar cortesias</option>
                <option value="so">Só cortesias</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-agenda">Tipo de agenda</Label>
              <NativeSelect id="g-agenda" name="agenda" defaultValue={f.agenda} className="w-full">
                <option value="todas">Médicos e exames</option>
                <option value="medico">Só médicos</option>
                <option value="exame">Só agendas de exame</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Aplicar</Button>
            <Link href={`/gestao?aba=${aba}`} className={buttonVariants({ variant: "ghost" })}>
              Limpar filtros
            </Link>
          </div>
        </Form>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-sm">
          <CalendarDays className="size-4 text-primary" />
          <span className="text-muted-foreground">Mostrando:</span>
          <b>{f.janela.nome}</b>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium tabular-nums">{f.janela.datas}</span>
          {f.janela.emAndamento && <span className="text-muted-foreground">· parcial, ainda vai mudar</span>}
          {f.base && <span className="text-muted-foreground">· comparado com {f.base.nome}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Carregando() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default async function PaginaGestao(props: PageProps<"/gestao">) {
  await exigirAdmin();
  const sp = await props.searchParams;
  const f = lerFiltros(sp);
  const aba = um(sp.aba, ABAS.map((a) => a.k), "faturamento");
  const por = um<AgruparPor>(sp.por, ["categoria", "medico", "operadora", "tabela"], "categoria");
  const saz = um(sp.saz, ["total", "dia"] as const, "total");
  const mat = um(sp.mat, ["n", "pct"] as const, "n");
  const chave = filtrosParaUrl(f, { aba, por, saz, mat }).toString();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Gestão"
        descricao="A clínica toda, com o dinheiro: faturamento, quanto cada marcação gerou, equipes, quem marca para quem e por que consultas se perdem. Só administradores veem esta área."
        acoes={
          <a href={`/api/gestao/xlsx?${filtrosParaUrl(f)}`} className={buttonVariants({ variant: "outline" })} data-tour="gestao-excel">
            <FileSpreadsheet /> Gerar Excel
          </a>
        }
      />
      <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
        <Filtros f={f} aba={aba} />
      </Suspense>
      <nav className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" aria-label="Seções da Gestão" data-tour="gestao-abas">
        {ABAS.map((a) => (
          <Link
            key={a.k}
            href={`/gestao?${filtrosParaUrl(f, { aba: a.k })}`}
            aria-current={aba === a.k ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              aba === a.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {a.t}
          </Link>
        ))}
      </nav>
      <div data-tour="gestao-conteudo">
        <Suspense key={chave} fallback={<Carregando />}>
          {aba === "faturamento" && <AbaFaturamento f={f} por={por} saz={saz} />}
          {aba === "conversao" && <AbaConversao f={f} />}
          {aba === "equipes" && <AbaEquipes f={f} />}
          {aba === "quem" && <AbaQuem f={f} mat={mat} />}
          {aba === "perdas" && <AbaPerdas f={f} />}
        </Suspense>
      </div>
    </div>
  );
}
