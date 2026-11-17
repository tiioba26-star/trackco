import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, FileSpreadsheet } from "lucide-react";
import { CabecalhoPagina } from "@/components/app/blocos";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { titulo } from "@/engine/classificacao";
import { exigirAdmin } from "@/lib/auth";
import { filtrosParaUrl, lerFiltros, opcoesDosFiltros, type AgruparPor, type FiltrosGestao } from "@/lib/dados/gestao";
import { cn } from "@/lib/utils";
import { AbaConversao } from "./aba-conversao";
import { AbaEquipes } from "./aba-equipes";
import { AbaFaturamento } from "./aba-faturamento";
import { AbaAnaliseGeral } from "./aba-geral";
import { AnaliseIA } from "./analise-ia";
import { textoBase } from "./blocos";
import { FiltrosRecolhiveis } from "./filtros-recolhiveis";
import { AbaPerdas } from "./aba-perdas";
import { AbaQuem } from "./aba-quem";
import { PeriodoGestaoCampos } from "./periodo";
import { Campo } from "@/components/ui/campo";

export const metadata = { title: "Gestão" };

const ABAS = [
  { k: "faturamento", t: "Faturamento" },
  { k: "conversao", t: "Agendamento → R$" },
  { k: "equipes", t: "Equipes" },
  { k: "quem", t: "Quem agenda para quem" },
  { k: "perdas", t: "Perdas e operadoras" },
  { k: "geral", t: "Análise geral (IA)" },
] as const;
type Aba = (typeof ABAS)[number]["k"];

const um = <T extends string>(v: unknown, ops: readonly T[], padrao: T): T => (typeof v === "string" && (ops as readonly string[]).includes(v) ? (v as T) : padrao);

/** Quantos filtros saem do padrão e valem nesta aba (o período não conta: ele aparece sempre na linha "Mostrando"). */
function filtrosAtivos(f: FiltrosGestao, ignorados: string[] = []): number {
  const fora: Record<string, boolean> = {
    equipe: !!f.equipe,
    pessoa: !!f.pessoa,
    categoria: !!f.categoria,
    medico: !!f.medico,
    procedimento: !!f.procedimento,
    operadora: f.operadora !== "Particular",
    cortesia: f.cortesia !== "incluir",
    agenda: f.agenda !== "todas",
  };
  return Object.entries(fora).filter(([k, v]) => v && !ignorados.includes(k)).length;
}

/** Filtros que a aba ignora (os dados dela não têm esse recorte): aparecem apagados, mas o valor segue para as outras abas. */
const NAO_VALE: Record<Aba, string[]> = {
  faturamento: ["equipe", "pessoa"],
  conversao: ["categoria"],
  quem: ["categoria"],
  perdas: ["categoria"],
  equipes: ["equipe", "pessoa", "categoria", "medico", "procedimento", "cortesia", "agenda"],
  geral: [],
};

async function Filtros({ f, aba }: { f: FiltrosGestao; aba: Aba }) {
  const o = await opcoesDosFiltros(f);
  const ignora = (nome: string) => NAO_VALE[aba].includes(nome);
  const opcoes = (lista: { v: string; t: string }[], todos?: string) => (
    <>
      {todos !== undefined && <option value="">{todos}</option>}
      {lista.map((x) => (
        <option key={x.v} value={x.v}>
          {x.t}
        </option>
      ))}
    </>
  );
  // um filtro: desligado quando a aba não usa (com o valor guardado num campo escondido, para não se perder)
  const filtro = (nome: string, rotulo: string, valor: string, conteudo: React.ReactNode) => {
    const off = ignora(nome);
    return (
      <Campo rotulo={rotulo} htmlFor={`g-${nome}`} ajuda={off ? "Não vale nesta aba" : undefined}>
        {off && <input type="hidden" name={nome} value={valor} />}
        <NativeSelect id={`g-${nome}`} name={off ? undefined : nome} defaultValue={valor} disabled={off} className="w-full">
          {conteudo}
        </NativeSelect>
      </Campo>
    );
  };
  return (
    <Card data-tour="gestao-filtros">
      <CardContent className="space-y-4">
        <FiltrosRecolhiveis ativos={filtrosAtivos(f, NAO_VALE[aba])}>
          <Form action="/gestao" className="space-y-5">
            <input type="hidden" name="aba" value={aba} />
            <div className="grid items-end gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
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
            <div className="grid items-start gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtro("equipe", "Equipe", f.equipe, opcoes(o.equipes.map((e) => ({ v: e, t: e })), "Clínica toda"))}
              {filtro("pessoa", "Quem agendou", f.pessoa, opcoes(o.pessoas.map((p) => ({ v: p.login, t: p.nome })), "Todas as pessoas"))}
              {filtro(
                "operadora",
                "Operadora",
                f.operadora,
                opcoes([
                  { v: "Particular", t: "Particular" },
                  { v: "SUS", t: "SUS" },
                  { v: "Convênios", t: "Convênios" },
                  { v: "todas", t: "Todas" },
                ]),
              )}
              {filtro("categoria", "Categoria", f.categoria, opcoes(o.categorias.map((c) => ({ v: c, t: titulo(c) })), "Todas"))}
              {filtro("medico", "Médico / agenda", f.medico, opcoes(o.medicos.map((m) => ({ v: m, t: titulo(m) })), "Todos"))}
              {filtro("procedimento", "Procedimento", f.procedimento, opcoes(o.procedimentos.map((p) => ({ v: p, t: p })), "Todos"))}
              {filtro(
                "cortesia",
                "Cortesias",
                f.cortesia,
                opcoes([
                  { v: "incluir", t: "Incluir" },
                  { v: "excluir", t: "Tirar cortesias" },
                  { v: "so", t: "Só cortesias" },
                ]),
              )}
              {filtro(
                "agenda",
                "Tipo de agenda",
                f.agenda,
                opcoes([
                  { v: "todas", t: "Médicos e exames" },
                  { v: "medico", t: "Só médicos" },
                  { v: "exame", t: "Só agendas de exame" },
                ]),
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Aplicar</Button>
              <Link href={`/gestao?aba=${aba}`} className={buttonVariants({ variant: "ghost" })}>
                Limpar filtros
              </Link>
            </div>
          </Form>
        </FiltrosRecolhiveis>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-sm">
          <CalendarDays className="size-4 text-primary" />
          <span className="text-muted-foreground">Mostrando:</span>
          <b>{f.janela.nome}</b>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium tabular-nums">{f.janela.datas}</span>
          {f.janela.emAndamento && <span className="text-muted-foreground">· parcial, ainda vai mudar</span>}
          {f.base && <span className="text-muted-foreground">· comparado com {textoBase(f.base)}</span>}
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
  const ia = typeof sp.ia === "string" ? sp.ia : undefined;
  const chave = filtrosParaUrl(f, { aba, por, saz, mat, ia: ia ?? "" }).toString();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Gestão"
        descricao="A clínica toda, com o dinheiro: faturamento, quanto cada agendamento gerou, equipes, quem agenda para quem e por que consultas se perdem. Só administradores veem esta área."
        acoes={
          <a href={`/api/gestao/xlsx?${filtrosParaUrl(f)}`} className={buttonVariants({ variant: "outline" })} data-tour="gestao-excel">
            <FileSpreadsheet /> Gerar Excel
          </a>
        }
      />
      {/* a análise geral da IA não usa filtros: o período dela aparece na própria aba */}
      {aba !== "geral" && (
        <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
          <Filtros f={f} aba={aba} />
        </Suspense>
      )}
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
          {aba === "geral" && <AbaAnaliseGeral />}
        </Suspense>
        {aba !== "geral" && (
          <div className="mt-6">
            <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
              <AnaliseIA f={f} aba={aba} ia={ia} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
