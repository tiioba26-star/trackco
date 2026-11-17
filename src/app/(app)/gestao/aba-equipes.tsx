import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { abaEquipes, filtrosParaUrl, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtNum, fmtPct } from "@/lib/formato";
import { Baixar, Barrinha, Delta, ErroGestao, real, textoBase } from "./blocos";
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
              Todas as equipes <Dica texto="Agendamentos feitos no período por quem é de cada equipe (cadastro do Trackco; quem não está no Trackco usa a equipe do cadastro antigo). Comparecimento = das que já dá para conferir, quantas o paciente veio." />
            </CardTitle>
            <CardDescription>
              {fmtNum(d.totalAtual)} agendamentos em {f.janela.datas}
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
                <TableHead className="text-right">
                  Agendamentos
                  {f.base && <span className="block text-[11px] font-normal text-muted-foreground">variação vs {textoBase(f.base)}</span>}
                </TableHead>
                <TableHead className="w-40">Participação</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Comparecimento <Dica texto="Dos agendamentos que já dá para conferir (data passada, sem remarcações, bloqueios e erros de cadastro), em quantos o paciente veio. É a mesma conta da aba Agendamento → R$." />
                  </span>
                </TableHead>
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
                  <TableCell className="text-right tabular-nums">{fmtPct(e.comparecimento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{real(e.valor)}</TableCell>
                </TableRow>
              ))}
              {!d.equipes.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum agendamento no período.
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
            Comparação dia a dia <Dica texto="Total acumulado de agendamentos, dia 1, dia 2, dia 3… do período e da comparação, lado a lado. Assim um mês ainda em andamento é comparado com os mesmos dias do outro." />
          </CardTitle>
          <CardDescription>
            Clínica toda{f.operadora === "todas" ? "" : `, ${f.operadora}`}: {f.janela.datas}
            {f.base ? ` × ${textoBase(f.base)}` : ""}.
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
            Agendamentos por {d.porEquipe.grao === "dia" ? "dia" : d.porEquipe.grao === "semana" ? "semana" : "mês"} em {f.janela.datas}, das 6 equipes que mais
            agendaram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GraficoLinhas series={d.porEquipe.series} pontos={d.porEquipe.pontos} />
        </CardContent>
      </Card>
    </div>
  );
}
