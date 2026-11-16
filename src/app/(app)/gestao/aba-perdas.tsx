import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { abaPerdas, filtrosParaUrl, type AbaPerdas as Dados, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtNum, fmtPct } from "@/lib/formato";
import { Baixar, Barrinha, Delta, Kpi, ErroGestao, real } from "./blocos";

function Quebra({ titulo, linhas }: { titulo: string; linhas: Dados["porPessoa"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>Os 15 com mais faltas + cancelamentos.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead className="text-right">Faltas</TableHead>
              <TableHead className="text-right">Cancel.</TableHead>
              <TableHead className="text-right">Remarc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.rotulo}>
                <TableCell className="max-w-48 truncate" title={l.rotulo}>
                  {l.rotulo}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(l.faltas)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(l.canceladas)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{fmtNum(l.remarcadas)}</TableCell>
              </TableRow>
            ))}
            {!linhas.length && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Nenhuma perda registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export async function AbaPerdas({ f }: { f: FiltrosGestao }) {
  const d = await abaPerdas(f).catch((e: Error) => e);
  if (d instanceof Error) return <ErroGestao erro={d} />;
  const maxMot = Math.max(1, ...d.porMotivo.map((m) => m.n));
  const totM = d.mixMarcacoes.reduce((s, x) => s + x.n, 0);
  const totF = d.mixFaturamento.reduce((s, x) => s + x.valor, 0);
  const nomeBase = f.base ? "comparação" : undefined;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          titulo="Faltas"
          valor={fmtNum(d.totais.faltas)}
          descricao={`Consultas marcadas para ${f.janela.datas} em que o paciente não veio e não remarcou.`}
          ajuda="Pela DATA DA CONSULTA. Faltou = o dia passou e o paciente não apareceu no faturamento (relatórios 8440 e 319 do Klingo)."
          delta={<Delta atual={d.totais.faltas} base={d.totaisBase?.faltas} nome={nomeBase} />}
        />
        <Kpi
          titulo="Cancelamentos"
          valor={fmtNum(d.totais.canceladas)}
          descricao={`Consultas marcadas para ${f.janela.datas} que foram desmarcadas e não remarcadas.`}
          ajuda="Pela DATA DA CONSULTA, com o motivo que a recepção registrou no Klingo (relatório 47)."
          delta={<Delta atual={d.totais.canceladas} base={d.totaisBase?.canceladas} nome={nomeBase} />}
        />
        <Kpi
          titulo="Remarcações"
          valor={fmtNum(d.totais.remarcadas)}
          descricao="Consultas que mudaram de data (o paciente continua: não é perda, mas dá retrabalho)."
          ajuda="Inclui quem faltou e remarcou. Não entram na taxa de comparecimento."
          delta={<Delta atual={d.totais.remarcadas} base={d.totaisBase?.remarcadas} nome={nomeBase} />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-1.5">
              Por que não aconteceu <Dica texto="Motivos registrados no Klingo para cancelamentos e faltas das consultas do período. 'Sem motivo registrado' mostra onde falta preencher na recepção." />
            </CardTitle>
            <CardDescription>Os 20 motivos mais comuns · consultas marcadas para {f.janela.datas}.</CardDescription>
          </div>
          <Baixar href={`/api/gestao/csv?${filtrosParaUrl(f, { quadro: "perdas" })}`} />
        </CardHeader>
        <CardContent className="space-y-2.5">
          {d.porMotivo.map((m) => (
            <div key={`${m.situacao}|${m.motivo}`} className="space-y-1">
              <div className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate" title={m.motivo}>
                  {m.motivo} <span className="text-xs text-muted-foreground">· {m.situacao === "cancelada" ? "cancelamento" : "falta"}</span>
                </span>
                <b className="shrink-0 tabular-nums">{fmtNum(m.n)}</b>
              </div>
              <Barrinha pct={(m.n / maxMot) * 100} cor={m.situacao === "cancelada" ? "var(--warn)" : "var(--down)"} />
            </div>
          ))}
          {!d.porMotivo.length && <p className="text-sm text-muted-foreground">Nenhuma perda registrada no período.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Quebra titulo="Por médico / agenda" linhas={d.porProfissional} />
        <Quebra titulo="Por procedimento" linhas={d.porProcedimento} />
        <Quebra titulo="Por quem marcou" linhas={d.porPessoa} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Mix de operadoras: marcações <Dica texto="Todas as operadoras (o filtro de operadora não vale aqui), pela data em que foram marcadas." />
            </CardTitle>
            <CardDescription>{fmtNum(totM)} marcações feitas em {f.janela.datas}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.mixMarcacoes.slice(0, 12).map((m) => (
              <div key={`${m.grupo}|${m.operadora}`} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">
                    {m.operadora} {m.grupo === "Convênios" && <span className="text-xs text-muted-foreground">· convênio</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {fmtNum(m.n)} <span className="text-xs text-muted-foreground">{fmtPct(totM ? (m.n / totM) * 100 : null)}</span>
                  </span>
                </div>
                <Barrinha pct={totM ? (m.n / totM) * 100 : 0} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Mix de operadoras: faturamento <Dica texto="Todas as operadoras, pela data do atendimento (relatório 319)." />
            </CardTitle>
            <CardDescription>{real(totF)} faturados em {f.janela.datas}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.mixFaturamento.slice(0, 12).map((m) => (
              <div key={`${m.grupo}|${m.operadora}`} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{m.operadora}</span>
                  <span className="shrink-0 tabular-nums">
                    {real(m.valor)} <span className="text-xs text-muted-foreground">{fmtPct(totF ? (m.valor / totF) * 100 : null)}</span>
                  </span>
                </div>
                <Barrinha pct={totF ? (m.valor / totF) * 100 : 0} cor="var(--chart-3)" />
              </div>
            ))}
            {!d.mixFaturamento.length && <p className="text-sm text-muted-foreground">Sem faturamento guardado no período.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
