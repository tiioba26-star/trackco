import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { abaEquipes, filtrosParaUrl, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtNum, fmtPct } from "@/lib/formato";
import { Baixar, Barrinha, Delta, ErroGestao, real } from "./blocos";
import { GraficoAcumulado, GraficoLinhas } from "./graficos";

export async function AbaEquipes({ f }: { f: FiltrosGestao }) {
  const d = await abaEquipes(f).catch((e: Error) => e);
  if (d instanceof Error) return <ErroGestao erro={d} />;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-1.5">
              Todas as equipes <Dica texto="Marcações feitas no período por quem é de cada equipe (cadastro do Trackco; quem não está no Trackco usa a equipe do cadastro antigo). 'Viraram consulta' = marcações que já apareceram no faturamento." />
            </CardTitle>
            <CardDescription>
              {fmtNum(d.totalAtual)} marcações em {f.janela.datas}
              {f.operadora === "todas" ? "" : ` (${f.operadora})`}
              {d.totalBase !== null && f.base ? ` · ${fmtNum(d.totalBase)} em ${f.base.nome}` : ""}.
            </CardDescription>
          </div>
          <Baixar href={`/api/gestao/csv?${filtrosParaUrl(f, { quadro: "equipes" })}`} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead className="text-right">Pessoas</TableHead>
                <TableHead className="text-right">Marcações</TableHead>
                <TableHead className="w-40">Participação</TableHead>
                <TableHead className="text-right">Viraram consulta</TableHead>
                <TableHead className="text-right">R$ gerado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.equipes.map((e) => (
                <TableRow key={e.equipe}>
                  <TableCell className="font-medium">{e.equipe}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(e.pessoas)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum(e.marcacoes)}
                    <div>
                      <Delta atual={e.marcacoes} base={e.marcacoesBase} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="mb-1 text-xs tabular-nums">{fmtPct(e.participacao)}</div>
                    <Barrinha pct={e.participacao} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(e.marcacoes ? (e.atendidas / e.marcacoes) * 100 : null)}</TableCell>
                  <TableCell className="text-right tabular-nums">{real(e.valor)}</TableCell>
                </TableRow>
              ))}
              {!d.equipes.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma marcação no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Comparação dia a dia <Dica texto="Total acumulado de marcações, dia 1, dia 2, dia 3… do período e da comparação, lado a lado. Assim um mês ainda em andamento é comparado com os mesmos dias do outro." />
          </CardTitle>
          <CardDescription>
            Clínica toda{f.operadora === "todas" ? "" : `, ${f.operadora}`}: {f.janela.datas}
            {f.base ? ` × ${f.base.nome}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoAcumulado dados={d.acumulado} rotuloAtual={f.janela.nome} rotuloBase={f.base ? "Comparação" : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipes ao longo do tempo</CardTitle>
          <CardDescription>
            Marcações por {d.porEquipe.grao === "dia" ? "dia" : d.porEquipe.grao === "semana" ? "semana" : "mês"}, as 6 equipes que mais marcaram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoLinhas series={d.porEquipe.series} pontos={d.porEquipe.pontos} />
        </CardContent>
      </Card>
    </div>
  );
}
