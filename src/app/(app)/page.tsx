import { AlertTriangle, BarChart3, MessageSquareWarning, UserX } from "lucide-react";
import Link from "next/link";
import { NivelBadge, Vazio } from "@/components/app/blocos";
import { SeletorCompetencia } from "@/components/app/seletor-competencia";
import { GraficoEvolucao } from "@/components/graficos/evolucao";
import { GraficoMensal } from "@/components/graficos/mensal";
import { GraficoComparativo } from "@/components/graficos/comparativo";
import { metricaMarcadasPara, type ResultadoAnalise, serieAnalise } from "@/lib/dados/analise";
import { linhasRelatorio, mesesEntre } from "@/lib/dados/relatorios";
import { CartaoAnalise, CartaoIndicador, CartaoNivel, ListaRanking, StatusSync } from "@/components/painel/cartoes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competenciaDe, hojeNoFuso, nomeCompetencia } from "@/engine/datas";
import type { Metrica, ResultadoIndicador } from "@/engine/tipos";
import { exigirSessao } from "@/lib/auth";
import {
  alertasGestao,
  type ApuracaoRow,
  apuracoesDaEquipe,
  minhasApuracoes,
  rankingEquipe,
  serieDiaria,
  ultimaSync,
  valoresAnalise,
} from "@/lib/dados/painel";
import { competenciaValida, fmtPct, fmtValor } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Painel" };

/** Soma os indicadores individuais dos membros para formar o retrato da equipe. */
function agregarEquipe(membros: ApuracaoRow[]): ResultadoIndicador[] {
  const mapa = new Map<string, ResultadoIndicador & { _num: number; _den: number; _metaTem: boolean }>();
  for (const a of membros) {
    for (const i of a.resultado.indicadores) {
      if (i.escopo !== "individual") continue;
      const cur =
        mapa.get(i.metrica_id) ??
        ({
          ...i,
          indicador_id: `eq-${i.metrica_id}`,
          escopo: "equipe" as const,
          realizado: 0,
          meta: 0,
          meta_ajustada: 0,
          projecao: 0,
          ritmo_necessario_dia: 0,
          ajuste_total: 0,
          _num: 0,
          _den: 0,
          _metaTem: false,
        } as ResultadoIndicador & { _num: number; _den: number; _metaTem: boolean });
      cur.realizado += i.realizado;
      cur._num += i.numerador ?? 0;
      cur._den += i.denominador ?? 0;
      cur.ajuste_total += i.ajuste_total;
      if (i.meta_ajustada !== null) {
        cur.meta_ajustada = (cur.meta_ajustada ?? 0) + i.meta_ajustada;
        cur._metaTem = true;
      }
      cur.projecao = (cur.projecao ?? 0) + (i.projecao ?? 0);
      cur.ritmo_necessario_dia = (cur.ritmo_necessario_dia ?? 0) + (i.ritmo_necessario_dia ?? 0);
      mapa.set(i.metrica_id, cur);
    }
  }
  return Array.from(mapa.values()).map(({ _num, _den, _metaTem, ...i }) => {
    if (i.unidade === "%") {
      const v = _den > 0 ? Math.round((_num / _den) * 1000) / 10 : 0;
      return { ...i, realizado: v, numerador: _num, denominador: _den, meta_ajustada: null, atingimento_pct: null, sem_meta: true, projecao: null, ritmo_necessario_dia: null };
    }
    const meta = _metaTem ? i.meta_ajustada : null;
    return {
      ...i,
      meta_ajustada: meta,
      sem_meta: !meta,
      atingimento_pct: meta ? Math.round((i.realizado / meta) * 1000) / 10 : null,
      ritmo_necessario_dia: _metaTem ? Math.round((i.ritmo_necessario_dia ?? 0) * 10) / 10 : null,
    };
  });
}

export default async function PaginaPainel(props: PageProps<"/">) {
  const s = await exigirSessao();
  const sp = await props.searchParams;
  const hoje = hojeNoFuso();
  const atual = competenciaDe(hoje);
  const comp = competenciaValida(sp.comp) ?? atual;
  const mesCorrente = comp === atual;
  const db = await criarClienteServidor();

  const [sync, minhas, metricasRes] = await Promise.all([
    ultimaSync(db),
    minhasApuracoes(db, s.colaborador.id, comp),
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo"),
  ]);
  const metricas = new Map(((metricasRes.data ?? []) as Metrica[]).map((m) => [m.id, m]));
  const metricasAnalise = Array.from(metricas.values()).filter((m) => m.definicao.somente_analise);
  const metMarcadas = metricaMarcadasPara(Array.from(metricas.values()));
  const metRealizadas = Array.from(metricas.values()).find((m) => m.codigo === "realizadas") ?? null;
  const coorte = (colaboradores: { id: string; login_klingo: string | null }[]) =>
    metMarcadas && metRealizadas && colaboradores.length
      ? serieAnalise(db, {
          a: metMarcadas,
          b: metRealizadas,
          colaboradores,
          granularidade: "dia",
          de: comp,
          ate: comp,
          acumulado: false,
          hoje,
        })
      : Promise.resolve(null);
  const cartaoCoorte = (r: ResultadoAnalise | null, link: string) =>
    r && metMarcadas && metRealizadas ? (
      <Card data-tour="coorte">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Consultas do mês: marcadas × realizadas</CardTitle>
              <CardDescription>
                Pela data da consulta: quantas estavam marcadas para cada dia e quantas aconteceram. Dias claros ainda vão acontecer.
              </CardDescription>
            </div>
            <Link href={link} className="text-sm text-primary hover:underline">
              Personalizar na Análise →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Marcadas para o mês </span>
              <b className="tabular-nums">{fmtValor(r.totalA)}</b>
            </div>
            <div>
              <span className="text-muted-foreground">Realizadas </span>
              <b className="tabular-nums">{fmtValor(r.totalB)}</b>
            </div>
            <div>
              <span className="text-muted-foreground">Realizadas ÷ marcadas </span>
              <b className="tabular-nums">{r.totalA ? fmtPct((r.totalB / r.totalA) * 100) : "—"}</b>
            </div>
          </div>
          <GraficoComparativo dados={r.pontos} rotuloA={metMarcadas.nome} unidadeA="un" rotuloB={metRealizadas.nome} unidadeB="un" altura={240} />
        </CardContent>
      </Card>
    ) : null;
  const minha = minhas.find((a) => a.funcao === "membro");

  // equipes que a pessoa gerencia (admin/gestor: todas)
  let equipesGestao: { id: string; nome: string }[] = [];
  if (s.vêTudo) {
    const { data } = await db.from("equipes").select("id, nome").eq("ativo", true).order("nome");
    equipesGestao = data ?? [];
  } else {
    equipesGestao = s.equipes.filter((e) => e.funcao === "lider").map((e) => ({ id: e.equipe_id, nome: e.nome }));
  }
  const equipeSel = equipesGestao.find((e) => e.id === sp.equipe) ?? equipesGestao[0];

  // ---- meu desempenho ----
  let meuBloco: React.ReactNode = null;
  if (minha) {
    const metricasSerie = minha.resultado.indicadores
      .filter((i) => i.unidade !== "%" && i.escopo === "individual")
      .map((i) => metricas.get(i.metrica_id))
      .filter((m): m is Metrica => !!m && m.tipo === "quantitativa")
      .slice(0, 3);
    const metasSerie = Object.fromEntries(
      minha.resultado.indicadores.map((i) => [metricas.get(i.metrica_id)?.codigo ?? i.metrica_id, i.meta_ajustada]),
    );
    const [serie, ranking, analise, historico, coorteMinha] = await Promise.all([
      serieDiaria(db, {
        competencia: comp,
        hoje,
        metricas: metricasSerie,
        colaboradores: [{ id: s.colaborador.id, login_klingo: s.colaborador.login_klingo }],
        metas: metasSerie,
      }),
      rankingEquipe(db, minha.equipe_id, comp),
      valoresAnalise(db, {
        competencia: comp,
        hoje,
        metricas: metricasAnalise,
        colaboradores: [{ id: s.colaborador.id, login_klingo: s.colaborador.login_klingo }],
      }),
      linhasRelatorio(db, { de: "2025-01", ate: comp, colaboradorId: s.colaborador.id }),
      coorte([{ id: s.colaborador.id, login_klingo: s.colaborador.login_klingo }]),
    ]);
    // histórico mês a mês (resultado oficial do fechamento quando existir)
    const histMembro = historico.filter((l) => l.funcao === "membro");
    const indHist = Array.from(
      new Map(
        histMembro
          .flatMap((l) => l.resultado.indicadores)
          .filter((i) => i.escopo === "individual" && i.unidade !== "%")
          .map((i) => [i.metrica_id, i.nome]),
      ),
    );
    const mesesHist = histMembro.length ? mesesEntre(histMembro[0].competencia, comp) : [];
    const serieHist = mesesHist.map((m) => {
      const l = histMembro.find((x) => x.competencia === m);
      const ponto: Record<string, string | number> = { mes: nomeCompetencia(m, true) };
      for (const [id] of indHist) ponto[id] = l?.resultado.indicadores.find((i) => i.metrica_id === id)?.realizado ?? 0;
      return ponto;
    });
    meuBloco = (
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="kpis">
          <CartaoNivel resultado={minha.resultado} href={`/extrato?c=${s.colaborador.id}&comp=${comp}`} />
          {minha.resultado.indicadores.map((i) => (
            <CartaoIndicador key={i.indicador_id} ind={i} mesCorrente={mesCorrente} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" data-tour="evolucao">
            <CardHeader>
              <CardTitle>Agendamentos feitos no mês</CardTitle>
              <CardDescription>
                Seu esforço: agendamentos acumulados pelo dia em que você marcou. A linha tracejada é o ritmo para bater a meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serie.length ? (
                <GraficoEvolucao dados={serie} series={metricasSerie.map((m) => ({ chave: m.codigo, rotulo: m.nome }))} />
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados para este mês.</p>
              )}
            </CardContent>
          </Card>
          <Card data-tour="ranking">
            <CardHeader>
              <CardTitle>Equipe</CardTitle>
              <CardDescription>Posição pela nota geral do mês</CardDescription>
            </CardHeader>
            <CardContent>
              <ListaRanking ranking={ranking} comp={comp} />
            </CardContent>
          </Card>
        </div>
        {cartaoCoorte(coorteMinha, `/analise?a=marcadas_para&b=realizadas&g=dia&mes=${comp}`)}
        <CartaoAnalise valores={analise} />
        {serieHist.length > 1 && (
          <Card data-tour="historico">
            <CardHeader>
              <CardTitle>Meu histórico</CardTitle>
              <CardDescription>Realizado mês a mês desde que os dados começaram a ser acompanhados.</CardDescription>
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

  // ---- visão de gestão (líder / admin / gestor) ----
  let gestaoBloco: React.ReactNode = null;
  if (equipeSel) {
    const aps = await apuracoesDaEquipe(db, equipeSel.id, comp);
    const membros = aps.filter((a) => a.funcao === "membro");
    const lider = aps.find((a) => a.funcao === "lider");
    const agregados = agregarEquipe(membros);
    const indicadoresTabela = Array.from(
      new Map(membros.flatMap((a) => a.resultado.indicadores).map((i) => [i.indicador_id, i])).values(),
    );
    const { data: logins } = await db
      .from("colaboradores")
      .select("id, login_klingo")
      .in("id", membros.map((m) => m.colaborador_id));
    const metricasSerie = agregados
      .filter((i) => i.unidade !== "%")
      .map((i) => metricas.get(i.metrica_id))
      .filter((m): m is Metrica => !!m && m.tipo === "quantitativa")
      .slice(0, 3);
    const colabsComLogin = (logins ?? []) as { id: string; login_klingo: string | null }[];
    const [serie, alertas, analiseEquipe, coorteEquipe] = await Promise.all([
      membros.length
        ? serieDiaria(db, {
            competencia: comp,
            hoje,
            metricas: metricasSerie,
            colaboradores: (logins ?? []) as { id: string; login_klingo: string | null }[],
            metas: Object.fromEntries(agregados.map((i) => [metricas.get(i.metrica_id)?.codigo ?? "", i.meta_ajustada])),
          })
        : Promise.resolve([]),
      s.vêTudo ? alertasGestao(db, comp) : Promise.resolve(null),
      valoresAnalise(db, { competencia: comp, hoje, metricas: metricasAnalise, colaboradores: colabsComLogin }),
      coorte(colabsComLogin),
    ]);
    const nomesMembros = new Map(membros.map((m) => [m.colaborador_id, m.resultado.nome]));

    gestaoBloco = (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Visão da equipe</h3>
          {equipesGestao.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
              {equipesGestao.map((e) => (
                <Link
                  key={e.id}
                  href={`/?equipe=${e.id}&comp=${comp}`}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm",
                    e.id === equipeSel.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {e.nome}
                </Link>
              ))}
            </div>
          )}
        </div>

        {alertas && (alertas.contestacoesAbertas > 0 || alertas.semLoginKlingo > 0 || alertas.sync?.status === "erro") && (
          <div className="grid gap-3 md:grid-cols-3">
            {alertas.contestacoesAbertas > 0 && (
              <Alert>
                <MessageSquareWarning />
                <AlertTitle>{alertas.contestacoesAbertas} contestação(ões) aguardando resposta</AlertTitle>
                <AlertDescription>
                  <Link href="/contestacoes" className="text-primary underline">Responder agora</Link>
                </AlertDescription>
              </Alert>
            )}
            {alertas.semLoginKlingo > 0 && (
              <Alert>
                <UserX />
                <AlertTitle>{alertas.semLoginKlingo} colaborador(es) sem login do Klingo</AlertTitle>
                <AlertDescription>
                  Sem o vínculo, os agendamentos não são atribuídos.{" "}
                  <Link href="/colaboradores" className="text-primary underline">Vincular</Link>
                </AlertDescription>
              </Alert>
            )}
            {alertas.sync?.status === "erro" && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Última sincronização com erro</AlertTitle>
                <AlertDescription>
                  <Link href="/dados" className="underline">Ver detalhes</Link>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!aps.length ? (
          <Vazio
            icone={BarChart3}
            titulo="Ainda não há apuração para este mês"
            texto={
              s.ehAdmin
                ? "Confira se a equipe tem plano ativo e membros com login do Klingo, depois use 'Recalcular agora' em Dados e lançamentos."
                : "Os números aparecem após a próxima atualização dos dados."
            }
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {lider && (
                <CartaoNivel
                  resultado={lider.resultado}
                  titulo={`Líder · ${lider.resultado.nome}`}
                  href={`/extrato?c=${lider.colaborador_id}&comp=${comp}`}
                />
              )}
              {agregados.map((i) => (
                <CartaoIndicador key={i.indicador_id} ind={i} mesCorrente={mesCorrente} />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Agendamentos feitos pela equipe</CardTitle>
                  <CardDescription>Esforço do mês: soma dos membros, pelo dia em que marcaram (acumulado).</CardDescription>
                </CardHeader>
                <CardContent>
                  {serie.length ? (
                    <GraficoEvolucao dados={serie} series={metricasSerie.map((m) => ({ chave: m.codigo, rotulo: m.nome }))} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Distribuição por nível</CardTitle>
                  <CardDescription>{membros.length} membro(s) apurado(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from(
                    membros.reduce((m, a) => {
                      const k = a.resultado.faixa?.nivel ?? "Sem nível";
                      const cur = m.get(k) ?? { n: 0, cor: a.resultado.faixa?.cor };
                      cur.n++;
                      m.set(k, cur);
                      return m;
                    }, new Map<string, { n: number; cor?: string }>()),
                  ).map(([nivel, { n, cor }]) => (
                    <div key={nivel} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <NivelBadge nivel={nivel} cor={cor} />
                        <span className="tabular-nums text-muted-foreground">{n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(n / membros.length) * 100}%`, background: cor ?? "var(--muted-foreground)" }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            {cartaoCoorte(coorteEquipe, `/analise?a=marcadas_para&b=realizadas&g=dia&mes=${comp}&equipe=${equipeSel.id}`)}
            <CartaoAnalise valores={analiseEquipe} nomes={nomesMembros} />
            <Card>
              <CardHeader>
                <CardTitle>Membros</CardTitle>
                <CardDescription>Clique no nome para abrir o extrato com o memorial de cálculo.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead className="text-right">Nota</TableHead>
                      {indicadoresTabela.map((i) => (
                        <TableHead key={i.indicador_id} className="text-right">
                          {i.nome}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membros.map((a, idx) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <Link href={`/extrato?c=${a.colaborador_id}&comp=${comp}`} className="font-medium hover:underline">
                            {a.resultado.nome}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <NivelBadge nivel={a.resultado.faixa?.nivel} cor={a.resultado.faixa?.cor} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPct(a.nota)}</TableCell>
                        {indicadoresTabela.map((col) => {
                          const i = a.resultado.indicadores.find((x) => x.indicador_id === col.indicador_id);
                          return (
                            <TableCell key={col.indicador_id} className="text-right tabular-nums">
                              {i ? (
                                <>
                                  {fmtValor(i.realizado, i.unidade)}
                                  {i.meta_ajustada !== null && (
                                    <span className="text-muted-foreground"> / {fmtValor(i.meta_ajustada, i.unidade)}</span>
                                  )}
                                </>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    );
  }

  const primeiroNome = s.colaborador.nome.split(" ")[0];
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Olá, {primeiroNome}!</h2>
          <p className="text-sm text-muted-foreground">
            {mesCorrente ? "Mês em andamento: números parciais até hoje." : "Mês encerrado."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSync sync={sync} />
          <SeletorCompetencia competencia={comp} maxima={atual} />
        </div>
      </div>
      {sp.erro === "restrito" && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Área restrita</AlertTitle>
          <AlertDescription>Essa seção é só para administradores ou líderes.</AlertDescription>
        </Alert>
      )}
      {meuBloco}
      {gestaoBloco}
      {!meuBloco && !gestaoBloco && (
        <Vazio
          icone={BarChart3}
          titulo="Nada para mostrar ainda"
          texto="Você ainda não faz parte de nenhuma equipe com plano ativo neste mês. Fale com o administrador."
        />
      )}
    </div>
  );
}
