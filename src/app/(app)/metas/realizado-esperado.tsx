import Form from "next/form";
import Link from "next/link";
import { Rotulo } from "@/components/app/blocos";
import { GraficoRealEsperado } from "@/components/graficos/real-esperado";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competenciaAnterior, competenciaDe, nomeCompetencia } from "@/engine/datas";
import type { Metrica } from "@/engine/tipos";
import { membrosDaEquipe, planoVigente } from "@/lib/calculo/carregar";
import { realEsperado, type VisaoRealEsperado } from "@/lib/dados/real-esperado";
import { competenciaValida } from "@/lib/formato";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

type Params = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Lê os filtros da seção (nomes próprios, para não misturar com o mês da grade de metas). */
export function filtrosRealEsperado(sp: Params, hoje: string) {
  const atual = competenciaDe(hoje);
  const ver: VisaoRealEsperado = um(sp.ver) === "dia" ? "dia" : "mes";
  let ate = competenciaValida(um(sp.ate)) ?? atual;
  let de = competenciaValida(um(sp.de)) ?? competenciaAnterior(ate, 5);
  if (de > ate) [de, ate] = [ate, de];
  if (competenciaAnterior(ate, 23) > de) de = competenciaAnterior(ate, 23); // no máximo 24 meses
  const mes = competenciaValida(um(sp.mes)) ?? atual;
  return { ver, de, ate, mes, pessoa: um(sp.pessoa) ?? null };
}

export function CarregandoRealEsperado() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}

const fmt = (v: number | null, unidade: string) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unidade === "%" ? "%" : ""}`;

/** Seção de baixo da tela de Metas: realizado × esperado de uma pessoa, mês a mês ou dia a dia. */
export async function RealizadoEsperado({
  equipe,
  sp,
  hoje,
  manter,
}: {
  equipe: { id: string; nome: string };
  sp: Params;
  hoje: string;
  /** parâmetros da grade de cima (equipe, mês, histórico) que continuam na URL */
  manter: Record<string, string>;
}) {
  const f = filtrosRealEsperado(sp, hoje);
  const refMes = f.ver === "dia" ? f.mes : f.ate;
  // página só de admin (exigirAdmin na página): leitura direta, sem o custo das regras por linha
  const db = criarClienteAdmin();
  const [{ data: eqRow }, membros, plano, { data: metRows }] = await Promise.all([
    db.from("equipes").select("id, nome, dias_trabalho").eq("id", equipe.id).maybeSingle(),
    membrosDaEquipe(db, equipe.id, refMes),
    planoVigente(db, equipe.id, refMes),
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo"),
  ]);
  const pessoa = membros.find((m) => m.colaborador_id === f.pessoa) ?? membros.find((m) => m.funcao === "membro") ?? membros[0];
  const qs = (extra: Record<string, string>) =>
    `/metas?${new URLSearchParams({ ...manter, ...(pessoa ? { pessoa: pessoa.colaborador_id } : {}), de: f.de, ate: f.ate, mes: f.mes, ver: f.ver, ...extra }).toString()}#realizado-esperado`;

  const indicadores =
    pessoa && plano && eqRow
      ? await realEsperado(db, {
          equipe: { id: eqRow.id as string, nome: eqRow.nome as string, dias_trabalho: (eqRow.dias_trabalho as number[]) ?? [1, 2, 3, 4, 5] },
          pessoa,
          membros,
          indicadores: plano.definicao.indicadores,
          metricas: (metRows ?? []) as Metrica[],
          visao: f.ver,
          de: f.ver === "dia" ? f.mes : f.de,
          ate: f.ver === "dia" ? f.mes : f.ate,
          hoje,
        })
      : [];
  const linhas = indicadores[0]?.pontos ?? [];
  const periodo = f.ver === "dia" ? nomeCompetencia(f.mes) : `${nomeCompetencia(f.de, true)} a ${nomeCompetencia(f.ate, true)}`;

  return (
    <section id="realizado-esperado" className="mt-10 scroll-mt-6 space-y-4" data-tour="metas-pessoa">
      <div>
        <h3 className="text-lg font-semibold">Realizado × esperado por pessoa</h3>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Escolha uma pessoa e compare o que ela fez com o que a meta esperava. Cada ponto é só daquele mês ou daquele dia: nada é somado no
          período.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-muted/40 p-4 md:p-5">
        <div className="inline-flex rounded-xl border bg-muted p-1" role="tablist" aria-label="Ver por">
          {(
            [
              ["mes", "Mês a mês"],
              ["dia", "Dia a dia"],
            ] as const
          ).map(([v, t]) => (
            <Link
              key={v}
              role="tab"
              aria-selected={f.ver === v}
              scroll={false}
              href={qs({ ver: v })}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                f.ver === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </Link>
          ))}
        </div>
        <Form action="/metas" scroll={false} className="flex flex-wrap items-end gap-3">
          {Object.entries(manter).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="ver" value={f.ver} />
          <div className="min-w-56 space-y-1.5">
            <Label htmlFor="re-pessoa">Pessoa</Label>
            <NativeSelect id="re-pessoa" name="pessoa" defaultValue={pessoa?.colaborador_id}>
              {membros.map((m) => (
                <option key={m.colaborador_id} value={m.colaborador_id}>
                  {m.nome}
                  {m.funcao === "lider" ? " (líder)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          {f.ver === "mes" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="re-de">De</Label>
                <Input id="re-de" type="month" name="de" defaultValue={f.de} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-ate">Até</Label>
                <Input id="re-ate" type="month" name="ate" defaultValue={f.ate} className="bg-background" />
              </div>
              <input type="hidden" name="mes" value={f.mes} />
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="re-mes">Mês</Label>
                <Input id="re-mes" type="month" name="mes" defaultValue={f.mes} className="bg-background" />
              </div>
              <input type="hidden" name="de" value={f.de} />
              <input type="hidden" name="ate" value={f.ate} />
            </>
          )}
          <button type="submit" className={buttonVariants()}>
            Ver
          </button>
        </Form>
      </div>

      {!pessoa || !plano ? (
        <p className="text-sm text-muted-foreground">Sem plano ativo ou sem pessoas na equipe neste período.</p>
      ) : !indicadores.length ? (
        <p className="text-sm text-muted-foreground">O plano não tem indicadores para {pessoa.funcao === "lider" ? "a liderança" : "esta pessoa"}.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Rotulo>
              {pessoa.nome} · {periodo}
            </Rotulo>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-1)]" /> realizado abaixo do esperado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-[var(--up)]" /> chegou no esperado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-5 border-t-2 border-dashed border-muted-foreground" /> esperado pela meta
              </span>
            </span>
          </div>
          <div className={cn("grid gap-4", f.ver === "mes" && "lg:grid-cols-3")}>
            {indicadores.map((ind) => (
              <Card key={ind.id}>
                <CardHeader>
                  <CardTitle className="text-base">{ind.nome}</CardTitle>
                  <CardDescription>
                    peso {ind.peso}
                    {ind.escopo === "equipe" ? " · soma da equipe" : ""}
                    {!ind.temMeta ? " · sem meta cadastrada no período" : ""}
                    {ind.trocas.length > 0 && (
                      <span className="mt-1 block text-xs">
                        A regra mudou no período:{" "}
                        {ind.trocas.map((t, i) => `${i === 0 ? "até" : "desde"} ${nomeCompetencia(i === 0 ? competenciaAnterior(ind.trocas[1].desde) : t.desde, true)} contava ${t.metrica}`).join("; ")}
                        .
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GraficoRealEsperado dados={ind.pontos} unidade={ind.unidade} altura={f.ver === "dia" ? 220 : 240} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tabela</CardTitle>
              <CardDescription>
                {f.ver === "mes"
                  ? "No mês em andamento, o esperado é o que a meta pedia até hoje (a meta do mês inteiro aparece embaixo)."
                  : "Esperado por dia = meta do mês dividida pelos dias em que a pessoa trabalhou (sem fins de semana, feriados e ausências)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table containerClassName="max-h-[460px] overflow-y-auto rounded-lg border">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
                  <TableRow className="hover:bg-transparent">
                    <TableHead rowSpan={2} className="sticky left-0 z-20 bg-card align-bottom">
                      {f.ver === "mes" ? "Mês" : "Dia"}
                    </TableHead>
                    {indicadores.map((ind) => (
                      <TableHead key={ind.id} colSpan={2} className="border-l text-center">
                        {ind.nome}
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    {indicadores.map((ind) => (
                      <TableHeadPar key={ind.id} />
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, k) => (
                    <TableRow key={l.chave} className={l.futuro ? "text-muted-foreground" : ""}>
                      <TableCell className="sticky left-0 z-[1] bg-card first-letter:uppercase">
                        {f.ver === "dia" ? l.rotulo : nomeCompetencia(l.chave)}
                        {l.parcial ? (f.ver === "dia" ? " · hoje" : " · em andamento") : l.futuro ? " · a acontecer" : ""}
                      </TableCell>
                      {indicadores.map((ind) => {
                        const p = ind.pontos[k];
                        const comparar = p && p.real !== null && p.esperado !== null && !p.futuro;
                        return [
                          <TableCell
                            key={`${ind.id}-r`}
                            className={cn(
                              "border-l text-right font-medium tabular-nums",
                              comparar && (p.real! >= p.esperado! ? "text-up" : "text-down"),
                            )}
                          >
                            {fmt(p?.real ?? null, ind.unidade)}
                          </TableCell>,
                          <TableCell key={`${ind.id}-e`} className="text-right text-muted-foreground tabular-nums">
                            {fmt(p?.esperado ?? null, ind.unidade)}
                            {p?.parcial && f.ver === "mes" && p.metaMes !== null && ind.unidade !== "%" ? (
                              <span className="block text-xs">meta do mês {fmt(p.metaMes, ind.unidade)}</span>
                            ) : null}
                          </TableCell>,
                        ];
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

function TableHeadPar() {
  return (
    <>
      <TableHead className="border-l text-right">Realizado</TableHead>
      <TableHead className="text-right">Esperado</TableHead>
    </>
  );
}
