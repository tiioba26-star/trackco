import Link from "next/link";
import { Info } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Variacao } from "@/engine/faturamento";
import { abaFaturamento, filtrosParaUrl, type AgruparPor, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtNum } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Baixar, Delta, Kpi, calor, ErroGestao, real } from "./blocos";
import { GraficoEmpilhado } from "./graficos";

const AGRUPAR: { k: AgruparPor; t: string }[] = [
  { k: "categoria", t: "Categoria" },
  { k: "medico", t: "Médico / agenda" },
  { k: "operadora", t: "Operadora" },
  { k: "tabela", t: "Tabela de preço" },
];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function ListaVariacao({ titulo, v }: { titulo: string; v: { ganhos: Variacao[]; quedas: Variacao[] } | null }) {
  if (!v) return null;
  const linha = (x: Variacao) => (
    <li key={x.rotulo} className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 truncate" title={x.rotulo}>
        {x.rotulo}
      </span>
      <span className={cn("shrink-0 tabular-nums", x.diferenca > 0 ? "text-up" : "text-down")}>
        {x.diferenca > 0 ? "+" : "−"}
        {real(Math.abs(x.diferenca))}
      </span>
    </li>
  );
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{titulo}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground uppercase">Mais cresceram</div>
          <ul className="space-y-1">{v.ganhos.length ? v.ganhos.map(linha) : <li className="text-sm text-muted-foreground">Nenhum.</li>}</ul>
        </div>
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground uppercase">Mais caíram</div>
          <ul className="space-y-1">{v.quedas.length ? v.quedas.map(linha) : <li className="text-sm text-muted-foreground">Nenhum.</li>}</ul>
        </div>
      </div>
    </div>
  );
}

export async function AbaFaturamento({ f, por, saz }: { f: FiltrosGestao; por: AgruparPor; saz: "total" | "dia" }) {
  const d = await abaFaturamento(f, por).catch((e: Error) => e);
  if (d instanceof Error) return <ErroGestao erro={d} />;
  const nomeBase = f.base ? (f.comparar === "ano" || f.janela.periodo === "ano" ? "ano anterior" : "período anterior") : undefined;
  const qs = (extra: Record<string, string>) => `/gestao?${filtrosParaUrl(f, { aba: "faturamento", por, saz, ...extra })}`;

  if (d.semDados) {
    return (
      <Card>
        <CardContent className="space-y-2 py-8 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Ainda não há faturamento guardado.</p>
          <p>
            O robô passa a guardar o faturamento (relatório 319) na próxima sincronização. Para trazer o histórico desde 2024, rode a
            sincronização “Sincronizar Klingo” no GitHub com <b>desde = 2024-01</b> e <b>só faturamento</b> marcado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const dec = d.decomposicao;
  const maxDec = dec ? Math.max(1, Math.abs(dec.dias), Math.abs(dec.volume), Math.abs(dec.valorMedio)) : 1;
  const valoresSaz = Object.values(d.sazonal.meses).map((m) => (saz === "dia" ? (m.porDia ?? 0) : m.valor));
  const maxSaz = Math.max(1, ...valoresSaz);

  return (
    <div className="space-y-6">
      {(f.equipe || f.pessoa) && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          O faturamento é da clínica toda: o relatório de faturamento do Klingo não diz quem marcou. Por isso equipe e pessoa não mudam esta aba (veja
          o R$ de cada pessoa em “Marcação → R$”).
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Faturamento"
          valor={real(d.atual.valor)}
          descricao={`Tudo o que o Klingo faturou em ${f.janela.datas}${f.operadora === "todas" ? "" : ` (${f.operadora})`}.`}
          ajuda="Soma do valor dos atendimentos do relatório de faturamento (319) do Klingo, pela data do atendimento. Sem repasse médico."
          delta={<Delta atual={d.atual.valor} base={d.base?.valor} nome={nomeBase} />}
          antes={d.base ? real(d.base.valor) : null}
        />
        <Kpi
          titulo="Procedimentos realizados"
          valor={fmtNum(d.atual.qtd)}
          descricao="Quantidade de procedimentos faturados (consultas, exames e procedimentos)."
          ajuda="Soma da coluna quantidade do faturamento. Uma consulta com dois exames conta 3."
          delta={<Delta atual={d.atual.qtd} base={d.base?.qtd} nome={nomeBase} />}
          antes={d.base ? fmtNum(d.base.qtd) : null}
        />
        <Kpi
          titulo="Valor médio"
          valor={real(d.atual.valorMedio)}
          descricao="Faturamento ÷ procedimentos realizados (ticket médio de cada procedimento)."
          ajuda="Se o valor médio cai, a clínica está fazendo mais procedimentos baratos (ou dando mais desconto)."
          delta={<Delta atual={d.atual.valorMedio} base={d.base?.valorMedio} nome={nomeBase} />}
          antes={d.base ? real(d.base.valorMedio) : null}
        />
        <Kpi
          titulo="Dias de atendimento"
          valor={fmtNum(d.atual.dias)}
          descricao={`Dias com algum atendimento faturado · ${fmtNum(d.atual.porDia, 1)} procedimentos por dia.`}
          ajuda="Dias em que o Klingo faturou alguma coisa. Feriados e dias sem agenda não entram."
          delta={<Delta atual={d.atual.dias} base={d.base?.dias} nome={nomeBase} />}
          antes={d.base ? fmtNum(d.base.dias) : null}
        />
      </div>

      {dec && f.base && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Por que o faturamento mudou? <Dica texto="Faturamento = dias de atendimento × procedimentos por dia × valor médio. Trocamos um fator de cada vez; os três efeitos somam exatamente a diferença." />
            </CardTitle>
            <CardDescription>
              {f.janela.datas} comparado com {f.base.nome}: {dec.diferenca >= 0 ? "+" : "−"}
              {real(Math.abs(dec.diferenca))}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {[
                { t: "Dias de atendimento", v: dec.dias, x: `${fmtNum(d.base!.dias)} → ${fmtNum(d.atual.dias)} dias` },
                { t: "Procedimentos por dia", v: dec.volume, x: `${fmtNum(d.base!.porDia, 1)} → ${fmtNum(d.atual.porDia, 1)} por dia` },
                { t: "Valor médio", v: dec.valorMedio, x: `${real(d.base!.valorMedio)} → ${real(d.atual.valorMedio)}` },
              ].map((e) => (
                <li key={e.t} className="grid items-center gap-1 sm:grid-cols-[13rem_1fr_8rem]">
                  <div className="text-sm">
                    <div className="font-medium">{e.t}</div>
                    <div className="text-xs text-muted-foreground">{e.x}</div>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        background: e.v >= 0 ? "var(--up)" : "var(--down)",
                        width: `${(Math.abs(e.v) / maxDec) * 50}%`,
                        left: e.v >= 0 ? "50%" : `${50 - (Math.abs(e.v) / maxDec) * 50}%`,
                      }}
                    />
                  </div>
                  <div className={cn("text-right text-sm font-medium tabular-nums", e.v >= 0 ? "text-up" : "text-down")}>
                    {e.v >= 0 ? "+" : "−"}
                    {real(Math.abs(e.v))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid gap-6 border-t pt-4 lg:grid-cols-2">
              <ListaVariacao titulo="Por médico / agenda" v={d.porMedico} />
              <ListaVariacao titulo="Por procedimento" v={d.porProcedimento} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Faturamento ao longo do tempo</CardTitle>
            <CardDescription>
              Por {d.serie.grao === "dia" ? "dia" : d.serie.grao === "semana" ? "semana (começando na segunda)" : "mês"} · {f.janela.datas} · os 5 maiores e
              “Outros”.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-lg border bg-card p-1">
              {AGRUPAR.map((a) => (
                <Link
                  key={a.k}
                  href={qs({ por: a.k })}
                  scroll={false}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    por === a.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {a.t}
                </Link>
              ))}
            </div>
            <Baixar href={`/api/gestao/csv?${filtrosParaUrl(f, { quadro: "faturamento" })}`} />
          </div>
        </CardHeader>
        <CardContent>
          <GraficoEmpilhado series={d.serie.series} pontos={d.serie.pontos} dinheiro />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-1.5">
              É sazonal? <Dica texto="Cada quadradinho é um mês. Quanto mais escuro, maior o faturamento. 'Por dia útil' divide pelos dias úteis do mês (segunda a sábado, sem feriados), para comparar meses curtos e longos." />
            </CardTitle>
            <CardDescription>
              Todos os meses guardados{f.operadora === "todas" ? "" : `, ${f.operadora}`}
              {f.categoria ? `, ${f.categoria}` : ""}. O mês atual vai até hoje.
            </CardDescription>
          </div>
          <div className="inline-flex rounded-lg border bg-card p-1">
            {(["total", "dia"] as const).map((k) => (
              <Link
                key={k}
                href={qs({ saz: k })}
                scroll={false}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium", saz === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                {k === "total" ? "Total do mês" : "Por dia útil"}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-12" />
                {MESES.map((m) => (
                  <th key={m} className="font-medium text-muted-foreground">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.sazonal.anos.map((a) => (
                <tr key={a}>
                  <th className="pr-1 text-right font-medium text-muted-foreground">{a}</th>
                  {MESES.map((_, i) => {
                    const m = d.sazonal.meses[`${a}-${String(i + 1).padStart(2, "0")}`];
                    const v = m ? (saz === "dia" ? m.porDia : m.valor) : null;
                    return (
                      <td
                        key={i}
                        className="h-10 rounded-md text-center tabular-nums"
                        style={v ? calor(v / maxSaz) : undefined}
                        title={m ? `${MESES[i]}/${a}: ${real(m.valor)} · ${m.diasUteis} dias úteis · ${real(m.porDia)} por dia útil` : undefined}
                      >
                        {v ? (v >= 1_000_000 ? `${fmtNum(v / 1_000_000, 1)} mi` : v >= 1000 ? `${fmtNum(v / 1000)} mil` : fmtNum(v)) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
