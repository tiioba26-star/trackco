import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROTULO_FAIXA, quartis } from "@/engine/faturamento";
import { abaConversao, filtrosParaUrl, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtNum, fmtPct } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Baixar, Barrinha, Delta, ErroGestao, real } from "./blocos";
import { GraficoDispersao } from "./graficos";

const COR_FAIXA = { acima: "text-up", media_alta: "text-foreground", media_baixa: "text-muted-foreground", abaixo: "text-down" } as const;

export async function AbaConversao({ f }: { f: FiltrosGestao }) {
  const d = await abaConversao(f).catch((e: Error) => e);
  if (d instanceof Error) return <ErroGestao erro={d} />;
  const fu = d.funil;
  const etapas = [
    { t: "Marcadas", v: fu.marcadas, ajuda: "Marcações feitas no período, pela data em que foram marcadas (qualquer data de consulta)." },
    {
      t: "Já dá para conferir",
      v: fu.verificaveis,
      ajuda: "Das marcadas, as que a data da consulta já passou, sem remarcações, bloqueios e erros de cadastro, e fora dos procedimentos que nunca entram no faturamento.",
    },
    { t: "Aconteceram", v: fu.atendidas, ajuda: "O paciente veio: a marcação apareceu no faturamento do Klingo." },
  ];
  const comp = fu.verificaveis ? (fu.atendidas / fu.verificaveis) * 100 : null;
  const compBase = d.funilBase?.verificaveis ? (d.funilBase.atendidas / d.funilBase.verificaveis) * 100 : null;
  const qComp = quartis(d.pessoas.filter((p) => p.marcacoes >= 10 && p.comparecimento !== null).map((p) => p.comparecimento!));
  const pontos = d.pessoas
    .filter((p) => p.marcacoes >= 10 && p.comparecimento !== null)
    .map((p) => ({ nome: p.nome, x: p.marcacoes, y: Math.round(p.comparecimento! * 10) / 10, valor: p.valor }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Marcação vira faturamento? <Dica texto="O caminho de cada marcação feita no período: marcou → já dá para conferir → aconteceu → quanto gerou em R$ (valor da visita no faturamento do Klingo)." />
          </CardTitle>
          <CardDescription>
            Marcações feitas em {f.janela.datas}
            {f.equipe ? ` · equipe ${f.equipe}` : " · clínica toda"}
            {f.operadora === "todas" ? "" : ` · ${f.operadora}`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <ul className="space-y-3">
            {etapas.map((e, i) => (
              <li key={e.t} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    {e.t} <Dica texto={e.ajuda} />
                  </span>
                  <span className="tabular-nums">
                    <b>{fmtNum(e.v)}</b>
                    {i > 0 && etapas[i - 1].v > 0 && <span className="ml-2 text-xs text-muted-foreground">{fmtPct((e.v / etapas[i - 1].v) * 100)} da etapa anterior</span>}
                  </span>
                </div>
                <Barrinha pct={fu.marcadas ? (e.v / fu.marcadas) * 100 : 0} />
              </li>
            ))}
          </ul>
          <div className="grid content-start gap-4 rounded-xl border p-4">
            <div>
              <div className="text-xs text-muted-foreground">R$ gerado pelas marcações</div>
              <div className="font-heading text-2xl font-semibold tabular-nums">{real(fu.valor)}</div>
              <Delta atual={fu.valor} base={d.funilBase?.valor} nome="comparação" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Comparecimento</div>
              <div className="font-heading text-2xl font-semibold tabular-nums">{fmtPct(comp)}</div>
              <Delta atual={comp} base={compBase} nome="comparação" pp />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">R$ por consulta que aconteceu</div>
              <div className="font-heading text-2xl font-semibold tabular-nums">{real(fu.atendidas ? fu.valor / fu.atendidas : null)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-1.5">
              Colaboradores: volume, comparecimento e R$ <Dica texto="Posição = em que quarto a pessoa está pelo número de marcações, entre quem marcou pelo menos 10 no período (25% maiores, acima da mediana, abaixo da mediana, 25% menores)." />
            </CardTitle>
            <CardDescription>
              {fmtNum(d.pessoas.length)} pessoas marcaram em {f.janela.datas}
              {d.quartis ? ` · mediana de ${fmtNum(d.quartis.mediana)} marcações (metade marcou mais, metade menos)` : ""}.
            </CardDescription>
          </div>
          <Baixar href={`/api/gestao/csv?${filtrosParaUrl(f, { quadro: "colaboradores" })}`} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead className="text-right">Marcações</TableHead>
                <TableHead className="text-right">Comparecimento</TableHead>
                <TableHead className="text-right">R$ gerado</TableHead>
                <TableHead className="text-right">R$ por consulta</TableHead>
                <TableHead>Posição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.pessoas.map((p) => (
                <TableRow key={p.login}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.equipe}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum(p.marcacoes)}
                    <div>
                      <Delta atual={p.marcacoes} base={p.marcacoesBase} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(p.comparecimento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{real(p.valor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{real(p.valorMedio)}</TableCell>
                  <TableCell className={cn("text-sm whitespace-nowrap", p.faixa && COR_FAIXA[p.faixa])}>{p.faixa ? ROTULO_FAIXA[p.faixa] : "—"}</TableCell>
                </TableRow>
              ))}
              {!d.pessoas.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma marcação com estes filtros.
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
            Volume × comparecimento <Dica texto="Cada bolinha é uma pessoa (quem marcou pelo menos 10). Para a direita = marca mais; para cima = mais pacientes vêm. As linhas tracejadas são as medianas: o quadrante de cima à direita é quem marca muito e bem. Bolinha maior = mais R$ gerado." />
          </CardTitle>
          <CardDescription>Marcações feitas em {f.janela.datas}.</CardDescription>
        </CardHeader>
        <CardContent>
          {pontos.length ? (
            <GraficoDispersao pontos={pontos} medianaX={d.quartis?.mediana ?? null} medianaY={qComp?.mediana ?? null} />
          ) : (
            <p className="text-sm text-muted-foreground">Ninguém com pelo menos 10 marcações neste filtro.</p>
          )}
        </CardContent>
      </Card>

      {d.semProducao.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Fora da conta do comparecimento ({d.semProducao.length}): procedimentos que quase nunca aparecem no faturamento (menos de 10% das marcações),
          como entregas e retornos. Ex.: {d.semProducao.slice(0, 4).join(", ")}
          {d.semProducao.length > 4 ? "…" : "."}
        </p>
      )}
    </div>
  );
}
