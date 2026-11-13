import { AlertTriangle, BarChart3, MessageSquareWarning, UserX } from "lucide-react";
import Link from "next/link";
import { Dica } from "@/components/ajuda/dica";
import type { ChaveDica } from "@/components/ajuda/dicas";
import { NivelBadge, Vazio } from "@/components/app/blocos";
import { GraficoComparativo } from "@/components/graficos/comparativo";
import { GraficoMensal } from "@/components/graficos/mensal";
import { BarraDestino, CartaoKpi, CartaoRitmo, IconePosicao, Variacao } from "@/components/painel/periodo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competenciaAnterior, competenciaDe, fimCompetencia, nomeCompetencia } from "@/engine/datas";
import { diaMes, type JanelaPeriodo } from "@/engine/periodos";
import type { Categoria, Producao } from "@/engine/producao";
import type { Metrica } from "@/engine/tipos";
import type { Sessao } from "@/lib/auth";
import { membrosDaEquipe } from "@/lib/calculo/carregar";
import { codigosTv } from "@/lib/codigo-tv";
import { alertasGestao, apuracoesDaEquipe, minhasApuracoes } from "@/lib/dados/painel";
import { minhaPosicao, type ResumoPeriodo, resumoPeriodo } from "@/lib/dados/producao";
import { linhasRelatorio, mesesEntre } from "@/lib/dados/relatorios";
import { fmtPct, fmtValor } from "@/lib/formato";
import { metricaPorPapel } from "@/lib/metricas-papel";
import type { Db } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

// Blocos do Painel (atendente e gestão). Cada bloco carrega sozinho dentro de um <Suspense>.

export /** Mês de apuração (nível, meta) quando o período é um mês inteiro; senão null. */
function mesDaJanela(j: JanelaPeriodo): string | null {
  if (j.periodo === "mes" || j.periodo === "mes_passado") return competenciaDe(j.inicio);
  if (j.inicio.endsWith("-01") && j.fimPara === fimCompetencia(j.inicio)) return competenciaDe(j.inicio);
  return null;
}

// ------------------------------------------------------------------ cartões comuns

function Kpis({ r, janela, quem }: { r: ResumoPeriodo; janela: JanelaPeriodo; quem: "voce" | "equipe" }) {
  const t = r.total;
  const a = r.anterior;
  const voce = quem === "voce";
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="kpis">
      <CartaoKpi
        titulo={voce ? "Você agendou" : "A equipe agendou"}
        valor={t.agendou}
        dica="pn.agendou"
        tour="kpi-agendou"
        descricao={
          <>
            Pacientes marcados {voce ? "por você" : "pela equipe"} de <b>{janela.datas}</b>, para qualquer data de consulta.
          </>
        }
        variacao={<Variacao atual={t.agendou} anterior={a.total.agendou} nome={a.nome} />}
        rodape={
          <span className="inline-flex flex-wrap items-center gap-1">
            {fmtValor(t.agendouRemarcadas)} viraram remarcação <Dica id="pn.remarques" /> · <b className="text-foreground">{fmtValor(t.agendouValidos)}</b> válidos
            <Dica id="pn.validos" />
          </span>
        }
      />
      <CartaoKpi
        titulo="Consultas marcadas para o período"
        valor={t.marcadasPara}
        dica="pn.marcadas"
        tour="kpi-marcadas"
        descricao={
          <>
            Consultas com data de <b>{diaMes(janela.inicio)}</b> a <b>{diaMes(janela.fimPara)}</b> que {voce ? "você marcou" : "a equipe marcou"}
            {t.aguardando ? ` · ${fmtValor(t.aguardando)} ainda vão acontecer` : ""}.
          </>
        }
      />
      <CartaoKpi
        titulo="Compareceram"
        valor={t.compareceram}
        dica="pn.compareceram"
        tour="kpi-compareceram"
        descricao="Das consultas marcadas para o período, quantos pacientes vieram até agora."
        variacao={<Variacao atual={t.compareceram} anterior={a.total.compareceram} nome={a.nome} />}
      />
      <CartaoKpi
        titulo="Taxa de comparecimento"
        valor={t.conversao}
        unidade="%"
        dica="pn.conversao"
        tour="kpi-conversao"
        destaque
        descricao={
          t.conversao === null
            ? "Ainda não há dia encerrado neste período (o dia de hoje entra amanhã)."
            : `${fmtValor(t.encerradasCompareceram)} de ${fmtValor(t.encerradasMarcadas)} consultas em dias que já passaram. É a "conversão".`
        }
        variacao={<Variacao atual={t.conversao} anterior={a.total.conversao} nome={a.nome} unidade="%" />}
      />
    </div>
  );
}

function GraficosDia({ r, quem }: { r: ResumoPeriodo; quem: "voce" | "equipe" }) {
  if (!r.dias) return null;
  const rot = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card data-tour="grafico-agendou">
        <CardHeader>
          <CardTitle>Agendamentos feitos por dia</CardTitle>
          <CardDescription>
            Quantos pacientes {quem === "voce" ? "você marcou" : "a equipe marcou"} em cada dia (pelo dia em que marcou). É o esforço do dia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoComparativo
            dados={r.dias.map((d) => ({ rotulo: rot(d.dia), a: d.futuro ? null : d.agendou, b: null, futuro: d.futuro }))}
            rotuloA="Agendou"
            unidadeA="un"
            altura={220}
          />
        </CardContent>
      </Card>
      <Card data-tour="grafico-consultas">
        <CardHeader>
          <CardTitle>Consultas de cada dia: marcadas × compareceram</CardTitle>
          <CardDescription>Pelo dia da consulta. Barras claras = dias que ainda vão chegar (mostram o que já está marcado).</CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoComparativo
            dados={r.dias.map((d) => ({ rotulo: rot(d.dia), a: d.marcadas, b: d.futuro ? null : d.compareceram, futuro: d.futuro }))}
            rotuloA="Marcadas para o dia"
            unidadeA="un"
            rotuloB="Compareceram"
            unidadeB="un"
            altura={220}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ atendente

export async function BlocoMeu({
  db,
  s,
  equipeId,
  janela,
  hoje,
  metricas,
}: {
  db: Db;
  s: Sessao;
  equipeId: string;
  janela: JanelaPeriodo;
  hoje: string;
  metricas: Metrica[];
}) {
  const eu = [{ id: s.colaborador.id, login_klingo: s.colaborador.login_klingo }];
  const comp = mesDaJanela(janela);
  const mesAtual = competenciaDe(hoje);
  const [particular, sus, aps, posicao, codigos, historico] = await Promise.all([
    resumoPeriodo(db, { pessoas: eu, metricas, janela, hoje, categoria: "particular" }),
    resumoPeriodo(db, { pessoas: eu, metricas, janela, hoje, categoria: "sus" }),
    comp ? minhasApuracoes(db, s.colaborador.id, comp) : Promise.resolve([]),
    minhaPosicao(s.colaborador.id, equipeId, metricas, janela, hoje),
    codigosTv(),
    linhasRelatorio(db, { de: competenciaAnterior(mesAtual, 11), ate: mesAtual, colaboradorId: s.colaborador.id }),
  ]);
  const minha = aps.find((a) => a.funcao === "membro");
  const agend = metricaPorPapel(metricas, "agendamentos");
  const indAgend = minha?.resultado.indicadores.find((i) => i.metrica_id === agend?.id);
  const dias = minha?.resultado.dias;

  // histórico: realizado mês a mês (últimos 12 meses)
  const histMembro = historico.filter((l) => l.funcao === "membro");
  const indHist = Array.from(
    new Map(
      histMembro
        .flatMap((l) => l.resultado.indicadores)
        .filter((i) => i.escopo === "individual" && i.unidade !== "%")
        .map((i) => [i.metrica_id, i.nome]),
    ),
  );
  const mesesHist = histMembro.length ? mesesEntre(histMembro[0].competencia, mesAtual) : [];
  const serieHist = mesesHist.map((m) => {
    const l = histMembro.find((x) => x.competencia === m);
    const ponto: Record<string, string | number> = { mes: nomeCompetencia(m, true) };
    for (const [id] of indHist) ponto[id] = l?.resultado.indicadores.find((i) => i.metrica_id === id)?.realizado ?? 0;
    return ponto;
  });

  return (
    <section className="space-y-4" data-tour="meu-bloco">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Seu desempenho</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1" data-tour="codigo">
            Seu código na TV <b className="font-mono text-sm text-foreground">#{codigos.get(s.colaborador.id) ?? "----"}</b>
            <Dica id="pn.codigo" />
          </span>
          {posicao && <IconePosicao posicao={posicao.posicao} de={posicao.de} periodo={janela.nome.toLowerCase()} />}
        </div>
      </div>

      {indAgend?.meta_ajustada && dias ? (
        <CartaoRitmo
          titulo={`Meta de agendamentos · ${nomeCompetencia(comp!)}`}
          realizado={indAgend.realizado}
          meta={indAgend.meta_ajustada}
          esperadoHoje={dias.uteis_total ? (indAgend.meta_ajustada * dias.uteis_decorridos) / dias.uteis_total : null}
          porDia={indAgend.ritmo_necessario_dia}
          diasRestantes={dias.uteis_restantes}
          emAndamento={janela.emAndamento}
          nivel={
            minha && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Nível do mês <NivelBadge nivel={minha.resultado.faixa?.nivel} cor={minha.resultado.faixa?.cor} /> nota {fmtPct(minha.nota)} ·
                <Link href={`/extrato?c=${s.colaborador.id}&comp=${comp}`} className="text-primary hover:underline">
                  ver como foi calculado
                </Link>
              </span>
            )
          }
        />
      ) : comp ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Ainda não há meta de agendamentos para {nomeCompetencia(comp)}. Os números abaixo valem do mesmo jeito.
        </p>
      ) : null}

      {particular ? (
        <>
          <Kpis r={particular} janela={janela} quem="voce" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-tour="destino">
              <CardHeader>
                <CardTitle>O que aconteceu com as consultas que você marcou para o período</CardTitle>
                <CardDescription>
                  {fmtValor(particular.total.marcadasPara)} consultas Particular com data de {diaMes(janela.inicio)} a {diaMes(janela.fimPara)}. Dica:
                  confirmar na véspera reduz faltas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarraDestino p={particular.total} />
              </CardContent>
            </Card>
            {sus && <CartaoSus p={sus.total} />}
          </div>
          <GraficosDia r={particular} quem="voce" />
        </>
      ) : (
        <Vazio icone={BarChart3} titulo="Sem métrica de agendamentos" texto="Peça ao administrador para cadastrar a métrica de agendamentos Particular." />
      )}

      {serieHist.length > 1 && (
        <Card data-tour="historico">
          <CardHeader>
            <CardTitle>Seu histórico mês a mês</CardTitle>
            <CardDescription>Últimos 12 meses, pelo resultado oficial de cada mês. Toque num mês para abrir o extrato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GraficoMensal dados={serieHist} series={indHist.map(([chave, rotulo]) => ({ chave, rotulo }))} />
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {mesesHist.map((m) => {
                const l = histMembro.find((x) => x.competencia === m);
                return (
                  <Link
                    key={m}
                    href={`/extrato?comp=${m}`}
                    className="min-w-20 shrink-0 rounded-lg border px-2 py-1.5 text-center text-xs hover:bg-muted"
                    title="Abrir o extrato do mês"
                  >
                    <div className="text-muted-foreground capitalize">{nomeCompetencia(m, true)}</div>
                    <div className="font-medium" style={{ color: l?.resultado.faixa?.cor }}>
                      {l?.nota !== null && l?.nota !== undefined ? fmtPct(l.nota) : "—"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function CartaoSus({ p }: { p: Producao }) {
  return (
    <Card data-tour="sus">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          SUS <Dica id="pn.sus" />
        </CardTitle>
        <CardDescription>Só acompanhamento: não conta para meta, nota ou prêmios.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          {(
            [
              ["Agendou no período", p.agendou],
              ["Consultas marcadas para o período", p.marcadasPara],
              ["Compareceram", p.compareceram],
            ] as const
          ).map(([r, v]) => (
            <div key={r} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{r}</dt>
              <dd className="font-semibold tabular-nums">{fmtValor(v)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ gestão (líder / admin)

type ColunaNumerica = Exclude<keyof Producao, "conversao">;
const COLUNAS: { k: ColunaNumerica | "conversao"; t: string; dica: ChaveDica }[] = [
  { k: "agendou", t: "Agendou", dica: "pn.agendou" },
  { k: "agendouRemarcadas", t: "Remarques", dica: "pn.remarques" },
  { k: "agendouValidos", t: "Válidos", dica: "pn.validos" },
  { k: "marcadasPara", t: "Marcadas p/ período", dica: "pn.marcadas" },
  { k: "compareceram", t: "Compareceram", dica: "pn.compareceram" },
  { k: "faltaram", t: "Faltaram", dica: "pn.faltaram" },
  { k: "desmarcaram", t: "Desmarcaram", dica: "pn.desmarcaram" },
  { k: "aguardando", t: "A acontecer", dica: "pn.aguardando" },
  { k: "conversao", t: "% Comparec.", dica: "pn.conversao" },
];
const celula = (p: Producao, k: ColunaNumerica | "conversao") => (k === "conversao" ? fmtPct(p.conversao) : fmtValor(p[k]));

export async function BlocoEquipe({
  db,
  s,
  equipes,
  equipe,
  janela,
  hoje,
  metricas,
  categoria,
}: {
  db: Db;
  s: Sessao;
  equipes: { id: string; nome: string }[];
  equipe: { id: string; nome: string };
  janela: JanelaPeriodo;
  hoje: string;
  metricas: Metrica[];
  categoria: Categoria;
}) {
  const comp = mesDaJanela(janela);
  const membros = (await membrosDaEquipe(db, equipe.id, competenciaDe(janela.fim))).filter((m) => m.funcao === "membro");
  const pessoas = membros.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo }));
  const [r, alertas, aps] = await Promise.all([
    resumoPeriodo(db, { pessoas, metricas, janela, hoje, categoria }),
    s.vêTudo ? alertasGestao(db, competenciaDe(hoje)) : Promise.resolve(null),
    comp ? apuracoesDaEquipe(db, equipe.id, comp) : Promise.resolve([]),
  ]);
  const nivelDe = new Map(aps.map((a) => [a.colaborador_id, a]));
  const lider = aps.find((a) => a.funcao === "lider");
  const periodoQs = janela.periodo !== "personalizado" ? `p=${janela.periodo}` : `de=${janela.inicio}&ate=${janela.fim}`;
  const ordem = [...membros].sort((a, b) => (r?.porPessoa.get(b.colaborador_id)?.agendou ?? 0) - (r?.porPessoa.get(a.colaborador_id)?.agendou ?? 0));
  const primeiroNome = (n: string) => n.split(" ")[0];
  const nomeCurto = (n: string) => {
    const p = n.trim().split(/\s+/);
    return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : n;
  };

  return (
    <section className="space-y-4" data-tour="equipe-bloco">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Equipe {equipe.nome}</h3>
        <div className="flex flex-wrap gap-2">
          {equipes.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
              {equipes.map((e) => (
                <Link
                  key={e.id}
                  href={`/?${periodoQs}&equipe=${e.id}${categoria === "sus" ? "&cat=sus" : ""}`}
                  className={cn("rounded-md px-3 py-1 text-sm", e.id === equipe.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {e.nome}
                </Link>
              ))}
            </div>
          )}
          <div className="flex gap-1 rounded-lg border bg-card p-1" data-tour="categoria">
            {(["particular", "sus"] as const).map((c) => (
              <Link
                key={c}
                href={`/?${periodoQs}&equipe=${equipe.id}${c === "sus" ? "&cat=sus" : ""}`}
                className={cn("rounded-md px-3 py-1 text-sm", c === categoria ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {c === "sus" ? "SUS" : "Particular"}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {alertas && (alertas.contestacoesAbertas > 0 || alertas.semLoginKlingo > 0 || alertas.sync?.status === "erro") && (
        <div className="grid gap-3 md:grid-cols-3">
          {alertas.contestacoesAbertas > 0 && (
            <Alert>
              <MessageSquareWarning />
              <AlertTitle>{alertas.contestacoesAbertas} contestação(ões) aguardando resposta</AlertTitle>
              <AlertDescription>
                <Link href="/contestacoes" className="text-primary underline">
                  Responder agora
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {alertas.semLoginKlingo > 0 && (
            <Alert>
              <UserX />
              <AlertTitle>{alertas.semLoginKlingo} colaborador(es) sem login do Klingo</AlertTitle>
              <AlertDescription>
                Sem o vínculo, os agendamentos não são atribuídos.{" "}
                <Link href="/colaboradores" className="text-primary underline">
                  Vincular
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {alertas.sync?.status === "erro" && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Última sincronização com erro</AlertTitle>
              <AlertDescription>
                <Link href="/dados" className="underline">
                  Ver detalhes
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {!r ? (
        <Vazio icone={BarChart3} titulo="Sem métrica para esta categoria" texto="Cadastre a métrica de agendamentos em Métricas." />
      ) : !membros.length ? (
        <Vazio icone={BarChart3} titulo="A equipe não tem membros neste período" />
      ) : (
        <>
          <Kpis r={r} janela={janela} quem="equipe" />

          <Card data-tour="tabela-producao">
            <CardHeader>
              <CardTitle>Produção por pessoa · {categoria === "sus" ? "SUS" : "Particular"}</CardTitle>
              <CardDescription>
                {janela.nome} ({janela.datas}). &quot;Agendou&quot; conta pelo dia em que a pessoa marcou; &quot;Marcadas p/ o período&quot; e as colunas
                seguintes contam pelo dia da consulta ({diaMes(janela.inicio)} a {diaMes(janela.fimPara)}). Clique no nome para abrir o extrato.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    {COLUNAS.map((c) => (
                      <TableHead key={c.k} className="h-auto py-2 text-right align-bottom leading-tight whitespace-normal">
                        <span className="inline-flex items-end justify-end gap-1">
                          {c.t} <Dica id={c.dica} />
                        </span>
                      </TableHead>
                    ))}
                    {comp && <TableHead>Nível do mês</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordem.map((m) => {
                    const p = r.porPessoa.get(m.colaborador_id);
                    const ap = nivelDe.get(m.colaborador_id);
                    return (
                      <TableRow key={m.colaborador_id}>
                        <TableCell>
                          <Link
                            href={`/extrato?c=${m.colaborador_id}${comp ? `&comp=${comp}` : ""}`}
                            className="font-medium whitespace-nowrap hover:underline"
                            title={m.nome}
                          >
                            {nomeCurto(m.nome)}
                          </Link>
                        </TableCell>
                        {COLUNAS.map((c) => (
                          <TableCell
                            key={c.k}
                            className={cn(
                              "text-right tabular-nums",
                              c.k === "agendouValidos" && "font-semibold",
                              c.k === "agendouRemarcadas" && !!p?.agendouRemarcadas && "text-warn",
                            )}
                          >
                            {p ? celula(p, c.k) : "—"}
                          </TableCell>
                        ))}
                        {comp && (
                          <TableCell>
                            <NivelBadge nivel={ap?.resultado.faixa?.nivel} cor={ap?.resultado.faixa?.cor} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Equipe</TableCell>
                    {COLUNAS.map((c) => (
                      <TableCell key={c.k} className="text-right font-semibold tabular-nums">
                        {celula(r.total, c.k)}
                      </TableCell>
                    ))}
                    {comp && <TableCell />}
                  </TableRow>
                </TableFooter>
              </Table>
              {lider && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Líder: <b className="text-foreground">{lider.resultado.nome}</b> · nível{" "}
                  <NivelBadge nivel={lider.resultado.faixa?.nivel} cor={lider.resultado.faixa?.cor} /> · nota {fmtPct(lider.nota)} (avaliado pelo
                  resultado da equipe) ·{" "}
                  <Link href={`/extrato?c=${lider.colaborador_id}&comp=${comp}`} className="text-primary hover:underline">
                    extrato
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-tour="grafico-remarques">
              <CardHeader>
                <CardTitle>Agendou × válidos, por pessoa</CardTitle>
                <CardDescription>A diferença entre as barras são remarcações, bloqueios e erros: o mesmo paciente contado de novo.</CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoComparativo
                  dados={ordem.map((m) => {
                    const p = r.porPessoa.get(m.colaborador_id);
                    return { rotulo: primeiroNome(m.nome), a: p?.agendou ?? 0, b: p?.agendouValidos ?? 0, futuro: false };
                  })}
                  rotuloA="Agendou"
                  unidadeA="un"
                  rotuloB="Válidos"
                  unidadeB="un"
                  altura={240}
                />
              </CardContent>
            </Card>
            <Card data-tour="grafico-pessoas">
              <CardHeader>
                <CardTitle>Consultas marcadas para o período × compareceram</CardTitle>
                <CardDescription>
                  Por pessoa, pelo dia da consulta ({diaMes(janela.inicio)} a {diaMes(janela.fimPara)}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoComparativo
                  dados={ordem.map((m) => {
                    const p = r.porPessoa.get(m.colaborador_id);
                    return { rotulo: primeiroNome(m.nome), a: p?.marcadasPara ?? 0, b: p?.compareceram ?? 0, futuro: false };
                  })}
                  rotuloA="Marcadas para o período"
                  unidadeA="un"
                  rotuloB="Compareceram"
                  unidadeB="un"
                  altura={240}
                />
              </CardContent>
            </Card>
          </div>

          <Card data-tour="destino">
            <CardHeader>
              <CardTitle>O que aconteceu com as consultas que a equipe marcou para o período</CardTitle>
              <CardDescription>
                {fmtValor(r.total.marcadasPara)} consultas com data de {diaMes(janela.inicio)} a {diaMes(janela.fimPara)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarraDestino p={r.total} />
            </CardContent>
          </Card>

          <GraficosDia r={r} quem="equipe" />
        </>
      )}
    </section>
  );
}
