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
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Análise" };

const PRESETS = [
  { rotulo: "Marcadas para × Realizadas (dia a dia)", a: "marcadas_para", b: "realizadas", g: "dia", acum: "0" },
  { rotulo: "Marcadas para × Realizadas (acumulado)", a: "marcadas_para", b: "realizadas", g: "dia", acum: "1" },
  { rotulo: "Agendamentos feitos × Realizadas (por mês)", a: "agendamentos", b: "realizadas", g: "mes", acum: "0" },
  { rotulo: "Particular × SUS (agendamentos, por mês)", a: "agendamentos", b: "agendamentos_sus", g: "mes", acum: "0" },
  { rotulo: "Taxa de conversão (por mês)", a: "conversao", b: "", g: "mes", acum: "0" },
];

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
  const metricas = marcadas && !todas.some((m) => m.codigo === "marcadas_para") ? [marcadas, ...todas] : todas;
  const porCodigo = new Map(metricas.map((m) => [m.codigo, m]));

  const gestao = s.vêTudo || s.lidera.length > 0;
  const pessoas = (pessoasRows ?? []) as { id: string; nome: string; login_klingo: string | null }[];
  type Eq = { id: string; nome: string; equipe_membros: { colaborador_id: string; fim: string | null }[] };
  const equipes = ((equipesRows ?? []) as unknown as Eq[]).filter((e) => s.vêTudo || s.lidera.includes(e.id));

  const g: Granularidade = sp.g === "mes" ? "mes" : "dia";
  const acumulado = sp.acum === "1";
  const mes = competenciaValida(sp.mes) ?? atual;
  const ate = competenciaValida(sp.ate) ?? atual;
  const de = competenciaValida(sp.de) ?? competenciaAnterior(ate, 11);
  const a = porCodigo.get(String(sp.a ?? "marcadas_para")) ?? metricas[0];
  const b = sp.b === "" ? null : (porCodigo.get(String(sp.b ?? "realizadas")) ?? null);
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
        descricao="Compare quaisquer duas métricas no tempo, por dia ou por mês. Para comparar quantidade com resultado, use 'Marcadas para' × 'Realizadas': as duas contam pela data da consulta."
      />

      <div className="flex flex-wrap gap-1.5" data-tour="analise-atalhos">
        {PRESETS.map((p) => {
          const ativo = a?.codigo === p.a && (b?.codigo ?? "") === p.b && g === p.g && (acumulado ? "1" : "0") === p.acum;
          return (
            <Link
              key={p.rotulo}
              href={`/analise?${qs({ a: p.a, b: p.b, g: p.g, acum: p.acum })}`}
              className={cn("rounded-full border px-3 py-1 text-sm", ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {p.rotulo}
            </Link>
          );
        })}
      </div>

      <Card data-tour="analise-parametros">
        <CardContent>
          <form action="/analise" className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                    {a.codigo === "marcadas_para" && b.codigo === "realizadas"
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
