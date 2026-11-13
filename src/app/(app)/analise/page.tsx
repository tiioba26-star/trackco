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
import { competenciaAnterior, competenciaDe, hojeNoFuso, nomeCompetencia } from "@/engine/datas";
import type { Metrica } from "@/engine/tipos";
import { exigirSessao } from "@/lib/auth";
import { type Granularidade, metricaMarcadasPara, serieAnalise, usaSoKlingo } from "@/lib/dados/analise";
import { competenciaValida, fmtPct, fmtValor } from "@/lib/formato";
import { resolverMetrica } from "@/lib/metricas-papel";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Análise" };

/** Perguntas prontas: cada uma já sabe quais métricas, período e visão usar. */
const PERGUNTAS = [
  {
    id: "consultas-mes",
    pergunta: "As consultas marcadas para este mês estão acontecendo?",
    explica: "Dia a dia do mês: quantas consultas estavam marcadas para cada dia × quantas aconteceram.",
    a: "marcadas_para",
    b: "realizadas",
    g: "dia",
    acum: "0",
  },
  {
    id: "mes-formando",
    pergunta: "Como o mês está se formando?",
    explica: "O mesmo, somando dia após dia (acumulado): mostra a distância entre o marcado e o que aconteceu.",
    a: "marcadas_para",
    b: "realizadas",
    g: "dia",
    acum: "1",
  },
  {
    id: "agendamentos-12m",
    pergunta: "Estamos agendando mais ou menos que antes?",
    explica: "Agendamentos feitos em cada mês, nos últimos 12 meses: válidos × total marcado (a diferença são remarcações, bloqueios e erros).",
    a: "agendamentos_validos",
    b: "agendamentos",
    g: "mes",
    acum: "0",
  },
  {
    id: "esforco-resultado",
    pergunta: "O esforço vira consulta?",
    explica: "Por mês: agendamentos válidos feitos × consultas que aconteceram.",
    a: "agendamentos_validos",
    b: "realizadas",
    g: "mes",
    acum: "0",
  },
  {
    id: "comparecimento",
    pergunta: "A taxa de comparecimento está melhorando?",
    explica: "Por mês: de cada 100 consultas marcadas, quantas aconteceram (conversão).",
    a: "conversao",
    b: "",
    g: "mes",
    acum: "0",
  },
  {
    id: "particular-sus",
    pergunta: "Quanto é Particular e quanto é SUS?",
    explica: "Por mês: agendamentos Particular × agendamentos SUS.",
    a: "agendamentos",
    b: "agendamentos_sus",
    g: "mes",
    acum: "0",
  },
] as const;

export default async function PaginaAnalise(props: PageProps<"/analise">) {
  const s = await exigirSessao();
  const sp = await props.searchParams;
  const hoje = hojeNoFuso();
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
  const pergunta = PERGUNTAS.find((q) => q.id === sp.q) ?? PERGUNTAS[0];

  const gestao = s.vêTudo || s.lidera.length > 0;
  const pessoas = (pessoasRows ?? []) as { id: string; nome: string; login_klingo: string | null }[];
  type Eq = { id: string; nome: string; equipe_membros: { colaborador_id: string; fim: string | null }[] };
  const equipes = ((equipesRows ?? []) as unknown as Eq[]).filter((e) => s.vêTudo || s.lidera.includes(e.id));

  const g: Granularidade = modo === "prontas" ? pergunta.g : sp.g === "mes" ? "mes" : "dia";
  const acumulado = modo === "prontas" ? pergunta.acum === "1" : sp.acum === "1";
  const mes = competenciaValida(sp.mes) ?? atual;
  const ate = competenciaValida(sp.ate) ?? atual;
  const de = competenciaValida(sp.de) ?? competenciaAnterior(ate, 11);
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
    a && alvo.length
      ? await serieAnalise(db, {
          a,
          b,
          colaboradores: alvo,
          granularidade: g,
          de: g === "dia" ? mes : de,
          ate: g === "dia" ? mes : ate,
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
      ate,
      ...extra,
    }).toString();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Análise"
        descricao="Para investigar: escolha uma pergunta pronta ou monte a sua. Uma coisa de cada vez."
      />

      <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Como analisar" data-tour="analise-modo">
        {(
          [
            ["prontas", "Perguntas prontas", "Escolha uma pergunta e veja a resposta. Ideal para o dia a dia."],
            ["livre", "Montar a minha análise", "Escolha as métricas, o período e a visão. Para quem quer ir fundo."],
          ] as const
        ).map(([m, t, d]) => (
          <Link
            key={m}
            role="tab"
            aria-selected={modo === m}
            href={`/analise?${new URLSearchParams({ modo: m, ...(equipe ? { equipe: equipe.id } : {}), ...(pessoa ? { pessoa: pessoa.id } : {}) }).toString()}`}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              modo === m ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "bg-card hover:bg-muted/60",
            )}
          >
            <div className="font-medium">{t}</div>
            <div className="text-sm text-muted-foreground">{d}</div>
          </Link>
        ))}
      </div>

      {modo === "prontas" ? (
        <>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-tour="analise-atalhos">
            {PERGUNTAS.map((q) => (
              <Link
                key={q.id}
                href={`/analise?${qs({ modo: "prontas", q: q.id })}`}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  q.id === pergunta.id ? "border-primary bg-primary-soft" : "bg-card hover:bg-muted/60",
                )}
              >
                <div className="font-medium">{q.pergunta}</div>
                <div className="text-xs text-muted-foreground">{q.explica}</div>
              </Link>
            ))}
          </div>
          {(gestao || g === "dia") && (
            <Card data-tour="analise-parametros">
              <CardContent>
                <form action="/analise" className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="modo" value="prontas" />
                  <input type="hidden" name="q" value={pergunta.id} />
                  {g === "dia" ? (
                    <div className="space-y-1.5">
                      <Label>Mês</Label>
                      <Input type="month" name="mes" defaultValue={mes} />
                    </div>
                  ) : (
                    <>
                      <input type="hidden" name="de" value={de} />
                      <input type="hidden" name="ate" value={ate} />
                    </>
                  )}
                  {gestao && (
                    <div className="min-w-56 space-y-1.5">
                      <Label>Quem</Label>
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
                  )}
                  <button type="submit" className={buttonVariants({ variant: "outline" })}>
                    Ver
                  </button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card data-tour="analise-parametros">
          <CardContent>
            <form action="/analise" className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                <Input type="month" name="mes" defaultValue={mes} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <Input type="month" name="de" defaultValue={de} />
                </div>
                <div className="space-y-1.5">
                  <Label>Até</Label>
                  <Input type="month" name="ate" defaultValue={ate} />
                </div>
              </div>
            )}
            {gestao ? (
              <div className="space-y-1.5">
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
            ) : (
              <div />
            )}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="acum" value="1" defaultChecked={acumulado} /> Acumulado
                <Dica texto="Ligado: cada ponto soma tudo desde o início do período (vê o mês se formando). Desligado: cada ponto mostra só aquele dia/mês." />
              </label>
              <button type="submit" className={buttonVariants()}>
                Aplicar
              </button>
            </div>
            </form>
          </CardContent>
        </Card>
      )}

      {resultado && a ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="space-y-1">
                <Rotulo>{a.nome}</Rotulo>
                <div className="font-heading text-3xl font-semibold tabular-nums">
                  {a.unidade === "%" ? "—" : fmtValor(resultado.totalA, a.unidade)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {g === "dia" ? `no mês todo de ${nomeCompetencia(mes)}` : "soma do período"}
                </div>
              </CardContent>
            </Card>
            {b && (
              <Card>
                <CardContent className="space-y-1">
                  <Rotulo>{b.nome}</Rotulo>
                  <div className="font-heading text-3xl font-semibold tabular-nums">
                    {b.unidade === "%" ? "—" : fmtValor(resultado.totalB, b.unidade)}
                  </div>
                  <div className="text-xs text-muted-foreground">{g === "dia" ? "no mês todo" : "soma do período"}</div>
                </CardContent>
              </Card>
            )}
            {b && contagens && (
              <Card>
                <CardContent className="space-y-1">
                  <Rotulo>B ÷ A</Rotulo>
                  <div className="font-heading text-3xl font-semibold tabular-nums">
                    {resultado.totalA ? fmtPct((resultado.totalB / resultado.totalA) * 100) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.id === achar("marcadas_para")?.id && b.id === achar("realizadas")?.id
                      ? "das consultas marcadas para o período, quantas aconteceram (dias futuros ainda contam como marcadas)"
                      : "proporção entre as duas"}
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
                {g === "dia" ? `Dia a dia em ${nomeCompetencia(mes)}` : `Mês a mês, ${nomeCompetencia(de, true)} a ${nomeCompetencia(ate, true)}`}
                {acumulado ? " · acumulado" : ""}
                {g === "dia" ? " · barras claras = dias que ainda vão acontecer" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoComparativo
                dados={resultado.pontos}
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
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{g === "dia" ? "Dia" : "Mês"}</TableHead>
                    <TableHead className="text-right">{a.nome}</TableHead>
                    {b && <TableHead className="text-right">{b.nome}</TableHead>}
                    {b && contagens && <TableHead className="text-right">B ÷ A</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.pontos.map((p) => (
                    <TableRow key={p.chave} className={p.futuro ? "text-muted-foreground" : ""}>
                      <TableCell className="capitalize">
                        {g === "dia" ? p.chave.split("-").reverse().join("/") : p.rotulo}
                        {p.futuro ? " · a acontecer" : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtValor(p.a, a.unidade)}</TableCell>
                      {b && <TableCell className="text-right tabular-nums">{fmtValor(p.b, b.unidade)}</TableCell>}
                      {b && contagens && (
                        <TableCell className="text-right tabular-nums">{p.a ? fmtPct(((p.b ?? 0) / p.a) * 100) : "—"}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Escolha as métricas e o período.</p>
      )}
    </div>
  );
}
