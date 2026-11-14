import { Download } from "lucide-react";
import Form from "next/form";
import { CabecalhoPagina, NivelBadge } from "@/components/app/blocos";
import { GraficoMensal } from "@/components/graficos/mensal";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competenciaAnterior, competenciaDe, hojeNoFuso, nomeCompetencia } from "@/engine/datas";
import { exigirGestaoOuLider } from "@/lib/auth";
import { linhasRelatorio, mesesEntre, quebraKlingo, type Quebra } from "@/lib/dados/relatorios";
import { competenciaValida, fmtNum, fmtPct, fmtValor } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ROTULO_SITUACAO } from "@/lib/situacao";

export const metadata = { title: "Relatórios" };

function ListaQuebra({ titulo, dados }: { titulo: string; dados: Quebra[] }) {
  const max = Math.max(1, ...dados.map((d) => d.agendados));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>Agendados no período · % que virou consulta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {dados.slice(0, 10).map((d) => (
          <div key={d.rotulo} className="space-y-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="truncate">{d.rotulo}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {fmtNum(d.agendados)} · {fmtPct(d.agendados ? (d.realizados / d.agendados) * 100 : null)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(d.agendados / max) * 100}%` }} />
            </div>
          </div>
        ))}
        {!dados.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );
}

export default async function PaginaRelatorios(props: PageProps<"/relatorios">) {
  const s = await exigirGestaoOuLider();
  const sp = await props.searchParams;
  const atual = competenciaDe(hojeNoFuso());
  const ate = competenciaValida(sp.ate) ?? atual;
  const de = competenciaValida(sp.de) ?? competenciaAnterior(ate, 5);
  const db = await criarClienteServidor();

  const { data: eqs } = await db.from("equipes").select("id, nome").eq("ativo", true).order("nome");
  const equipes = (eqs ?? []).filter((e) => s.vêTudo || s.lidera.includes(e.id));
  const equipeId = equipes.find((e) => e.id === sp.equipe)?.id ?? equipes[0]?.id;
  const { data: pessoasEq } = equipeId
    ? await db.from("equipe_membros").select("colaborador_id, colaboradores(nome, login_klingo)").eq("equipe_id", equipeId)
    : { data: [] };
  const pessoas = Array.from(
    new Map(
      ((pessoasEq ?? []) as unknown as { colaborador_id: string; colaboradores: { nome: string; login_klingo: string | null } | null }[])
        .filter((p) => p.colaboradores)
        .map((p) => [p.colaborador_id, { id: p.colaborador_id, ...p.colaboradores! }]),
    ).values(),
  ).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const colaboradorId = pessoas.find((p) => p.id === sp.pessoa)?.id;

  const filtros = { de, ate, equipeId, colaboradorId };
  const logins = (colaboradorId ? pessoas.filter((p) => p.id === colaboradorId) : pessoas)
    .map((p) => p.login_klingo?.toLowerCase())
    .filter((x): x is string => !!x);
  const [linhas, porOperadora, porProcedimento, porProfissional, porSituacao] = await Promise.all([
    linhasRelatorio(db, filtros),
    quebraKlingo(db, { ...filtros, logins }, "operadora"),
    quebraKlingo(db, { ...filtros, logins }, "procedimento"),
    quebraKlingo(db, { ...filtros, logins }, "profissional"),
    quebraKlingo(db, { ...filtros, logins }, "situacao"),
  ]);

  const meses = mesesEntre(de, ate);
  const membros = linhas.filter((l) => l.funcao === "membro");
  const indicadores = Array.from(
    new Map(membros.flatMap((l) => l.resultado.indicadores).filter((i) => i.unidade !== "%").map((i) => [i.metrica_id, i.nome])),
  );
  const serieMensal = meses.map((m) => {
    const ponto: Record<string, string | number> = { mes: nomeCompetencia(m, true) };
    for (const [metrica] of indicadores) {
      ponto[metrica] = membros
        .filter((l) => l.competencia === m)
        .reduce((s, l) => s + (l.resultado.indicadores.find((i) => i.metrica_id === metrica && i.escopo === "individual")?.realizado ?? 0), 0);
    }
    return ponto;
  });
  const colunas = Array.from(new Map(membros.flatMap((l) => l.resultado.indicadores).map((i) => [i.indicador_id, i])).values());
  const qs = new URLSearchParams({ de, ate, ...(equipeId ? { equipe: equipeId } : {}), ...(colaboradorId ? { pessoa: colaboradorId } : {}) });

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Relatórios"
        descricao="A operação mês a mês sem remontar o cálculo em planilha. Meses com fechamento aprovado usam o resultado oficial."
        acoes={
          <a href={`/api/relatorios/csv?${qs}`} className={buttonVariants({ variant: "outline" })}>
            <Download /> Exportar CSV
          </a>
        }
      />
      <Card data-tour="rel-filtros">
        <CardContent>
          <Form className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1.3fr_1.3fr_auto]" action="/relatorios">
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="month" name="de" defaultValue={de} />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="month" name="ate" defaultValue={ate} max={atual} />
            </div>
            <div className="space-y-1.5">
              <Label>Equipe</Label>
              <NativeSelect name="equipe" defaultValue={equipeId}>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Pessoa</Label>
              <NativeSelect name="pessoa" defaultValue={colaboradorId ?? ""}>
                <option value="">Todas</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <button type="submit" className={buttonVariants()}>
              Aplicar
            </button>
          </Form>
        </CardContent>
      </Card>

      <Card data-tour="rel-evolucao">
        <CardHeader>
          <CardTitle>Realizado por mês</CardTitle>
          <CardDescription>Soma dos membros {colaboradorId ? "(pessoa selecionada)" : "da equipe"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoMensal dados={serieMensal} series={indicadores.map(([chave, rotulo]) => ({ chave, rotulo }))} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <ListaQuebra titulo="Por operadora" dados={porOperadora} />
        <ListaQuebra titulo="Por procedimento" dados={porProcedimento} />
        <ListaQuebra titulo="Por profissional" dados={porProfissional} />
      </div>
      <ListaQuebra
        titulo="Por situação (por que não aconteceu)"
        dados={porSituacao.map((q) => ({ ...q, rotulo: ROTULO_SITUACAO[q.rotulo]?.t ?? (q.rotulo === "—" ? "Ainda sem desfecho" : q.rotulo) }))}
      />

      <Card data-tour="rel-tabela">
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
          <CardDescription>Uma linha por pessoa e mês (● = resultado oficial do fechamento).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead className="text-right">Nota</TableHead>
                {colunas.map((c) => (
                  <TableHead key={c.indicador_id} className="text-right">
                    {c.nome}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={`${l.competencia}-${l.colaborador_id}-${l.equipe_id}`}>
                  <TableCell className="whitespace-nowrap capitalize">
                    {nomeCompetencia(l.competencia, true)} {l.oficial ? <span className="text-up">●</span> : null}
                  </TableCell>
                  <TableCell>
                    {l.nome}
                    {l.funcao === "lider" && <span className="ml-1 text-xs text-muted-foreground">(líder)</span>}
                  </TableCell>
                  <TableCell>
                    <NivelBadge nivel={l.nivel} cor={l.resultado.faixa?.cor} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(l.nota)}</TableCell>
                  {colunas.map((c) => {
                    const i = l.resultado.indicadores.find((x) => x.indicador_id === c.indicador_id);
                    return (
                      <TableCell key={c.indicador_id} className="text-right tabular-nums">
                        {i ? fmtValor(i.realizado, i.unidade) : "—"}
                        {i?.meta_ajustada != null && <span className="text-muted-foreground"> / {fmtValor(i.meta_ajustada, i.unidade)}</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {!linhas.length && (
                <TableRow>
                  <TableCell colSpan={4 + colunas.length} className="py-8 text-center text-muted-foreground">
                    Sem apurações no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
