import { BarChart3, CalendarCheck, type LucideIcon, Percent, PieChart, Target, TrendingUp } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Dica } from "@/components/ajuda/dica";
import { CabecalhoPagina, Rotulo } from "@/components/app/blocos";
import { GraficoComparativo } from "@/components/graficos/comparativo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competenciaAnterior, competenciaDe, formatarDataBR, hojeNoFuso, nomeCompetencia, somarDias } from "@/engine/datas";
import type { Metrica } from "@/engine/tipos";
import { exigirSessao } from "@/lib/auth";
import { type Granularidade, metricaMarcadasPara, type PontoAnalise, serieAnalise, usaSoKlingo } from "@/lib/dados/analise";
import { competenciaValida, fmtPct, fmtValor } from "@/lib/formato";
import { resolverMetrica } from "@/lib/metricas-papel";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Análise" };

/** Perguntas prontas: cada uma já sabe quais métricas, período e visão usar. */
const PERGUNTAS: readonly {
  id: string;
  icone: LucideIcon;
  pergunta: string;
  explica: string;
  a: string;
  b: string;
  g: Granularidade;
  acum: "0" | "1";
}[] = [
  {
    id: "consultas-mes",
    icone: CalendarCheck,
    pergunta: "As consultas marcadas para este mês estão acontecendo?",
    explica: "Dia a dia do mês: quantas consultas estavam marcadas para cada dia × quantas aconteceram.",
    a: "marcadas_para",
    b: "realizadas",
    g: "dia",
    acum: "0",
  },
  {
    id: "mes-formando",
    icone: TrendingUp,
    pergunta: "Como o mês está se formando?",
    explica: "O mesmo, somando dia após dia (acumulado): mostra a distância entre o marcado e o que aconteceu.",
    a: "marcadas_para",
    b: "realizadas",
    g: "dia",
    acum: "1",
  },
  {
    id: "agendamentos-12m",
    icone: BarChart3,
    pergunta: "Estamos agendando mais ou menos que antes?",
    explica: "Agendamentos feitos em cada mês, nos últimos 12 meses: válidos × total marcado (a diferença são remarcações, bloqueios e erros).",
    a: "agendamentos_validos",
    b: "agendamentos",
    g: "mes",
    acum: "0",
  },
  {
    id: "esforco-resultado",
    icone: Target,
    pergunta: "O esforço vira consulta?",
    explica: "Por mês: agendamentos válidos feitos × consultas que aconteceram.",
    a: "agendamentos_validos",
    b: "realizadas",
    g: "mes",
    acum: "0",
  },
  {
    id: "comparecimento",
    icone: Percent,
    pergunta: "A taxa de comparecimento está melhorando?",
    explica: "Por mês: de cada 100 consultas marcadas, quantas aconteceram (conversão).",
    a: "conversao",
    b: "",
    g: "mes",
    acum: "0",
  },
  {
    id: "particular-sus",
    icone: PieChart,
    pergunta: "Quanto é Particular e quanto é SUS?",
    explica: "Por mês: agendamentos Particular × agendamentos SUS.",
    a: "agendamentos",
    b: "agendamentos_sus",
    g: "mes",
    acum: "0",
  },
];

const ddmm = (dia: string) => formatarDataBR(dia).slice(0, 5);

/** Valor de uma série até um dia (inclusive): soma dos dias ou, no acumulado, o próprio ponto. */
function ate(pontos: PontoAnalise[], campo: "a" | "b", limite: string, acumulado: boolean): number {
  const antes = pontos.filter((p) => p.chave <= limite);
  if (acumulado) return antes.at(-1)?.[campo] ?? 0;
  return antes.reduce((s, p) => s + (p[campo] ?? 0), 0);
}

export default async function PaginaAnalise(props: PageProps<"/analise">) {
  const s = await exigirSessao();
  const sp = await props.searchParams;
  const hoje = hojeNoFuso();
  const ontem = somarDias(hoje, -1);
  const atual = competenciaDe(hoje);
  const db = await criarClienteServidor();

  const [{ data: metRows }, { data: pessoasRows }, { data: equipesRows }] = await Promise.all([
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo").eq("ativo", true).order("nome"),
    db.from("colaboradores").select("id, nome, login_klingo").eq("ativo", true).order("nome"),
    db.from("equipes").select("id, nome, equipe_membros(colaborador_id, fim)").eq("ativo", true).order("nome"),
  ]);
  const todas = ((metRows ?? []) as Metrica[]).filter((m) => usaSoKlingo(m.definicao));
  const marcadas = metricaMarcadasPara(todas);
  const metricas = marcadas && !todas.some((m) => m.id === marcadas.id) ? [marcadas, ...todas] : todas;
  // perguntas prontas e links antigos usam códigos "clássicos": resolve pelo papel se a métrica foi renomeada
  const achar = (ref: string) => resolverMetrica(metricas, ref);
  const modo: "prontas" | "livre" = sp.modo === "livre" ? "livre" : "prontas";
  const escolhida = PERGUNTAS.find((q) => q.id === sp.q);
  // sem pergunta na URL: primeiro escolhe (uma coisa de cada vez)
  const escolhendo = modo === "prontas" && !escolhida;
  const pergunta = escolhida ?? PERGUNTAS[0];

  const gestao = s.vêTudo || s.lidera.length > 0;
  const pessoas = (pessoasRows ?? []) as { id: string; nome: string; login_klingo: string | null }[];
  type Eq = { id: string; nome: string; equipe_membros: { colaborador_id: string; fim: string | null }[] };
  const equipes = ((equipesRows ?? []) as unknown as Eq[]).filter((e) => s.vêTudo || s.lidera.includes(e.id));

  const g: Granularidade = modo === "prontas" ? pergunta.g : sp.g === "mes" ? "mes" : "dia";
  const acumulado = modo === "prontas" ? pergunta.acum === "1" : sp.acum === "1";
  const mes = competenciaValida(sp.mes) ?? atual;
  const ateMes = competenciaValida(sp.ate) ?? atual;
  const de = competenciaValida(sp.de) ?? competenciaAnterior(ateMes, 11);
  const refA = modo === "prontas" ? pergunta.a : String(sp.a ?? "marcadas_para");
  const refB = modo === "prontas" ? pergunta.b : sp.b === "" ? "" : String(sp.b ?? "realizadas");
  const a = achar(refA) ?? metricas[0];
  const b = refB === "" ? null : (achar(refB) ?? null);
  const equipe = equipes.find((e) => e.id === sp.equipe) ?? equipes[0];
  const pessoa = pessoas.find((p) => p.id === sp.pessoa);

  // quem entra na conta: a pessoa escolhida, a equipe (membros) ou, para atendentes, só ela mesma
  let alvo: { id: string; login_klingo: string | null }[];
  if (!gestao) alvo = pessoas.filter((p) => p.id === s.colaborador.id);
  else if (pessoa) alvo = [pessoa];
  else if (equipe) {
    const ids = new Set(equipe.equipe_membros.map((m) => m.colaborador_id));
    alvo = pessoas.filter((p) => ids.has(p.id));
  } else alvo = [];

  const resultado =
    !escolhendo && a && alvo.length
      ? await serieAnalise(db, {
          a,
          b,
          colaboradores: alvo,
          granularidade: g,
          de: g === "dia" ? mes : de,
          ate: g === "dia" ? mes : ateMes,
          acumulado,
          hoje,
        })
      : null;
  const contagens = a?.unidade !== "%" && (!b || b.unidade !== "%") && a?.unidade === b?.unidade;
  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({
      ...(equipe ? { equipe: equipe.id } : {}),
      ...(pessoa ? { pessoa: pessoa.id } : {}),
      mes,
      de,
      ate: ateMes,
      ...extra,
    }).toString();
  const quem = pessoa ? pessoa.nome.split(" ")[0] : gestao && equipe ? `Equipe ${equipe.nome}` : "Você";
  const periodo = g === "dia" ? nomeCompetencia(mes) : `${nomeCompetencia(de, true)} a ${nomeCompetencia(ateMes, true)}`;

  // Visão por dia do mês corrente: dias que ainda não chegaram mostram o que JÁ ESTÁ MARCADO para eles.
  // Por isso a proporção B ÷ A só usa os dias que já passaram (até ontem, como a taxa de conversão).
  const mesCorrente = g === "dia" && mes === atual;
  const mesFuturo = g === "dia" && mes > atual;
  const marcadasXRealizadas = !!b && a.id === achar("marcadas_para")?.id && b.id === achar("realizadas")?.id;
  let razao: { a: number; b: number; texto: string } | null = null;
  if (resultado && b && contagens) {
    if (g === "dia" && mesCorrente) {
      const ra = ate(resultado.pontos, "a", ontem, acumulado);
      const rb = ate(resultado.pontos, "b", ontem, acumulado);
      razao = {
        a: ra,
        b: rb,
        texto:
          ontem < `${mes}-01`
            ? "o mês começou hoje: ainda não há dia fechado para comparar"
            : `nos dias que já passaram (01/${mes.slice(5)} a ${ddmm(ontem)})${marcadasXRealizadas ? ": das consultas marcadas, quantas aconteceram" : ""}. Hoje e os próximos dias ainda não contam.`,
      };
    } else if (!mesFuturo) {
      razao = {
        a: resultado.totalA,
        b: resultado.totalB,
        texto: marcadasXRealizadas ? "das consultas marcadas para o período, quantas aconteceram" : "proporção entre as duas no período",
      };
    }
  }
  const textoTotal = (campo: "a" | "b", m: Metrica) => {
    if (!resultado) return "";
    if (g !== "dia") return `soma de ${periodo}`;
    if (!mesCorrente) return `no mês todo de ${nomeCompetencia(mes)}`;
    const total = campo === "a" ? resultado.totalA : resultado.totalB;
    const atéHoje = ate(resultado.pontos, campo, hoje, acumulado);
    const futuro = total - atéHoje;
    return futuro > 0
      ? `${fmtValor(atéHoje, m.unidade)} de 01/${mes.slice(5)} até hoje + ${fmtValor(futuro, m.unidade)} já marcadas para os próximos dias`
      : `de 01/${mes.slice(5)} até hoje`;
  };

  const seletorQuem = gestao && (
    <div className="min-w-56 space-y-1.5">
      <Label>Equipe ou pessoa</Label>
      <NativeSelect name="pessoa" defaultValue={pessoa?.id ?? ""}>
        <option value="">Equipe {equipe?.nome ?? ""} (todos)</option>
        {pessoas
          .filter((p) => !equipe || equipe.equipe_membros.some((m) => m.colaborador_id === p.id))
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
      </NativeSelect>
      {equipe && <input type="hidden" name="equipe" value={equipe.id} />}
    </div>
  );

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Análise" descricao="Para investigar: escolha uma pergunta pronta ou monte a sua. Uma coisa de cada vez." />

      {/* 1. o jeito de analisar: abas compactas, uma de cada vez */}
      <div className="inline-flex rounded-xl border bg-muted p-1" role="tablist" aria-label="Como analisar" data-tour="analise-modo">
        {(
          [
            ["prontas", "Perguntas prontas"],
            ["livre", "Montar a minha análise"],
          ] as const
        ).map(([m, t]) => (
          <Link
            key={m}
            role="tab"
            aria-selected={modo === m}
            href={`/analise?${new URLSearchParams({ modo: m, ...(equipe ? { equipe: equipe.id } : {}), ...(pessoa ? { pessoa: pessoa.id } : {}) }).toString()}`}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              modo === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* 2. o que perguntar */}
      {escolhendo ? (
        <section className="space-y-3" data-tour="analise-atalhos">
          <div>
            <h3 className="font-semibold">Qual é a sua pergunta?</h3>
            <p className="text-sm text-muted-foreground">Escolha uma e a resposta aparece logo abaixo, com o gráfico e a tabela.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PERGUNTAS.map((q) => (
              <Link
                key={q.id}
                href={`/analise?${qs({ modo: "prontas", q: q.id })}`}
                className="group flex gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary-soft"
              >
                <q.icone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-medium">{q.pergunta}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{q.explica}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : modo === "prontas" ? (
        <section className="space-y-4 rounded-2xl border bg-muted/40 p-4 md:p-5" data-tour="analise-parametros">
          <div className="flex flex-wrap items-start justify-between gap-3" data-tour="analise-atalhos">
            <div className="flex min-w-0 gap-3">
              <pergunta.icone className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pergunta</div>
                <div className="text-lg leading-snug font-semibold">{pergunta.pergunta}</div>
                <p className="text-sm text-muted-foreground">{pergunta.explica}</p>
              </div>
            </div>
            <Link href={`/analise?${qs({ modo: "prontas" })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Trocar pergunta
            </Link>
          </div>
          {(gestao || g === "dia") && (
            <Form action="/analise" className="flex flex-wrap items-end gap-3 border-t pt-4">
              <input type="hidden" name="modo" value="prontas" />
              <input type="hidden" name="q" value={pergunta.id} />
              {g === "dia" ? (
                <div className="space-y-1.5">
                  <Label>Mês</Label>
                  <Input type="month" name="mes" defaultValue={mes} className="bg-background" />
                </div>
              ) : (
                <>
                  <input type="hidden" name="de" value={de} />
                  <input type="hidden" name="ate" value={ateMes} />
                </>
              )}
              {seletorQuem}
              <button type="submit" className={buttonVariants()}>
                Ver
              </button>
            </Form>
          )}
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-muted/40 p-4 md:p-5" data-tour="analise-parametros">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sua análise</div>
            <p className="text-sm text-muted-foreground">Escolha as métricas, a visão e o período. Depois clique em Aplicar.</p>
          </div>
          <Form action="/analise" className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-6">
            <input type="hidden" name="modo" value="livre" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Métrica A</Label>
                <Dica texto="A primeira série do gráfico. As métricas vêm da tela Métricas: crie novas lá para analisar outros recortes." />
              </div>
              <NativeSelect name="a" defaultValue={a?.codigo}>
                {metricas.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Comparar com (B)</Label>
              <NativeSelect name="b" defaultValue={b?.codigo ?? ""}>
                <option value="">— nenhuma —</option>
                {metricas.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Ver por</Label>
                <Dica texto="Dia = cada dia de um mês (dias futuros mostram o que já está marcado para eles, em cor mais clara). Mês = um ponto por mês num intervalo." />
              </div>
              <NativeSelect name="g" defaultValue={g}>
                <option value="dia">Dia (um mês)</option>
                <option value="mes">Mês (intervalo)</option>
              </NativeSelect>
            </div>
            {g === "dia" ? (
              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Input type="month" name="mes" defaultValue={mes} className="bg-background" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <Input type="month" name="de" defaultValue={de} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label>Até</Label>
                  <Input type="month" name="ate" defaultValue={ateMes} className="bg-background" />
                </div>
              </div>
            )}
            {seletorQuem || <div />}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="acum" value="1" defaultChecked={acumulado} /> Acumulado
                <Dica texto="Ligado: cada ponto soma tudo desde o início do período (vê o mês se formando). Desligado: cada ponto mostra só aquele dia/mês." />
              </label>
              <button type="submit" className={buttonVariants()}>
                Aplicar
              </button>
            </div>
          </Form>
        </section>
      )}

      {/* 3. a resposta */}
      {escolhendo ? null : resultado && a ? (
        <section className="space-y-4" aria-labelledby="resposta-titulo">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-2">
            <h3 id="resposta-titulo" className="text-lg font-semibold">
              {modo === "prontas" ? "Resposta" : "Resultado"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {quem} · {periodo}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="space-y-1">
                <Rotulo>{a.nome}</Rotulo>
                <div className="font-heading text-3xl font-semibold tabular-nums">{a.unidade === "%" ? "—" : fmtValor(resultado.totalA, a.unidade)}</div>
                <div className="text-xs text-muted-foreground">{textoTotal("a", a)}</div>
              </CardContent>
            </Card>
            {b && (
              <Card>
                <CardContent className="space-y-1">
                  <Rotulo>{b.nome}</Rotulo>
                  <div className="font-heading text-3xl font-semibold tabular-nums">{b.unidade === "%" ? "—" : fmtValor(resultado.totalB, b.unidade)}</div>
                  <div className="text-xs text-muted-foreground">{textoTotal("b", b)}</div>
                </CardContent>
              </Card>
            )}
            {b && contagens && (
              <Card>
                <CardContent className="space-y-1">
                  <Rotulo>{marcadasXRealizadas ? "Aconteceram (B ÷ A)" : "B ÷ A"}</Rotulo>
                  <div className="font-heading text-3xl font-semibold tabular-nums">{razao?.a ? fmtPct((razao.b / razao.a) * 100) : "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {razao ? (
                      <>
                        {razao.a ? `${fmtValor(razao.b, b.unidade)} de ${fmtValor(razao.a, a.unidade)} ` : ""}
                        {razao.texto}
                      </>
                    ) : (
                      "o mês ainda não começou"
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card data-tour="analise-grafico">
            <CardHeader>
              <CardTitle>
                {a.nome}
                {b ? ` × ${b.nome}` : ""}
              </CardTitle>
              <CardDescription>
                {g === "dia" ? `Dia a dia em ${nomeCompetencia(mes)}` : `Mês a mês, ${periodo}`}
                {acumulado ? " · acumulado" : ""}
                {g === "dia" ? " · barras claras = dias que ainda vão acontecer (o que já está marcado para eles)" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoComparativo
                dados={resultado.pontos.map((p) => ({ ...p, data: g === "dia" ? p.chave : null }))}
                rotuloA={a.nome}
                unidadeA={a.unidade}
                rotuloB={b?.nome}
                unidadeB={b?.unidade}
                linhas={acumulado}
                altura={300}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabela</CardTitle>
              <CardDescription>Role a lista: os títulos das colunas ficam parados no topo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table containerClassName="max-h-[440px] overflow-y-auto rounded-lg border">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-20 bg-card">{g === "dia" ? "Dia" : "Mês"}</TableHead>
                    <TableHead className="text-right">{a.nome}</TableHead>
                    {b && <TableHead className="text-right">{b.nome}</TableHead>}
                    {b && contagens && <TableHead className="text-right">B ÷ A</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.pontos.map((p) => (
                    <TableRow key={p.chave} className={p.futuro ? "text-muted-foreground" : ""}>
                      <TableCell className="sticky left-0 z-[1] bg-card capitalize">
                        {g === "dia" ? p.chave.split("-").reverse().join("/") : p.rotulo}
                        {p.futuro ? " · a acontecer" : g === "dia" && p.chave === hoje ? " · hoje" : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtValor(p.a, a.unidade)}</TableCell>
                      {b && <TableCell className="text-right tabular-nums">{fmtValor(p.b, b.unidade)}</TableCell>}
                      {b && contagens && (
                        <TableCell className="text-right tabular-nums">
                          {p.futuro || !p.a ? "—" : fmtPct(((p.b ?? 0) / p.a) * 100)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados para mostrar: confira a equipe ou a pessoa escolhida.</p>
      )}
    </div>
  );
}
