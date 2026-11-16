import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { abaQuem, filtrosParaUrl, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtNum, fmtPct } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Baixar, calor, ErroGestao } from "./blocos";

export async function AbaQuem({ f, mat }: { f: FiltrosGestao; mat: "n" | "pct" }) {
  const d = await abaQuem(f).catch((e: Error) => e);
  if (d instanceof Error) return <ErroGestao erro={d} />;
  const max = Math.max(1, ...d.linhas.flatMap((l) => l.celulas));
  const qs = (extra: Record<string, string>) => `/gestao?${filtrosParaUrl(f, { aba: "quem", mat, ...extra })}`;
  const comp = (a: number, v: number) => (v ? fmtPct((a / v) * 100) : "—");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-1.5">
              Quem marca para quem <Dica texto="Cada linha é quem marcou; cada coluna, o médico ou a agenda de exame. Mais escuro = mais marcações. Em '% da linha', cada linha soma 100%: mostra para quem cada pessoa mais marca." />
            </CardTitle>
            <CardDescription>
              Marcações feitas em {f.janela.datas} · os 11 profissionais que mais receberam e “Outros”.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-card p-1">
              {(["n", "pct"] as const).map((k) => (
                <Link
                  key={k}
                  href={qs({ mat: k })}
                  scroll={false}
                  className={cn("rounded-md px-2.5 py-1 text-xs font-medium", mat === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  {k === "n" ? "Quantidade" : "% da linha"}
                </Link>
              ))}
            </div>
            <Baixar href={`/api/gestao/csv?${filtrosParaUrl(f, { quadro: "matriz" })}`} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {d.linhas.length ? (
            <table className="w-full border-separate border-spacing-0.5 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-2 text-left font-medium text-muted-foreground">Quem marcou</th>
                  {d.profissionais.map((p) => (
                    <th key={p} className="h-28 min-w-14 align-bottom font-medium text-muted-foreground">
                      <span className="inline-block max-w-28 origin-bottom-left translate-x-1/2 -rotate-45 truncate text-left whitespace-nowrap" title={p}>
                        {p}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.linhas.map((l) => (
                  <tr key={l.login}>
                    <td className="sticky left-0 z-10 bg-card px-2 py-1 whitespace-nowrap">
                      {l.nome} <span className="text-muted-foreground">· {l.equipe}</span>
                    </td>
                    {l.celulas.map((c, i) => {
                      const pct = l.total ? (c / l.total) * 100 : 0;
                      return (
                        <td key={i} className="h-8 rounded text-center tabular-nums" style={c ? calor(mat === "pct" ? pct / 100 : c / max) : undefined}>
                          {c ? (mat === "pct" ? `${fmtNum(pct)}%` : fmtNum(c)) : ""}
                        </td>
                      );
                    })}
                    <td className="px-2 text-right font-medium tabular-nums">{fmtNum(l.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium">Total</td>
                  {d.totalPorProfissional.map((t, i) => (
                    <td key={i} className="text-center font-medium tabular-nums">
                      {fmtNum(t)}
                    </td>
                  ))}
                  <td className="px-2 text-right font-semibold tabular-nums">{fmtNum(d.linhas.reduce((s, l) => s + l.total, 0))}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma marcação com estes filtros.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-1.5">
              Detalhe: pessoa → procedimento → profissional <Dica texto="Abra uma pessoa para ver o que ela marcou e para quem. O % é o comparecimento: das marcações que já dá para conferir, quantas aconteceram." />
            </CardTitle>
            <CardDescription>Toque numa pessoa para abrir. Marcações feitas em {f.janela.datas}.</CardDescription>
          </div>
          <Baixar href={`/api/gestao/csv?${filtrosParaUrl(f, { quadro: "detalhe" })}`} />
        </CardHeader>
        <CardContent className="space-y-1">
          {d.arvore.map((p) => (
            <details key={p.login} className="group rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
                <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
                <span className="flex-1 font-medium">{p.nome}</span>
                <span className="tabular-nums">{fmtNum(p.total)}</span>
                <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{comp(p.atendidas, p.verificaveis)}</span>
              </summary>
              <div className="space-y-1 border-t px-3 py-2">
                {p.procedimentos.map((pr) => (
                  <details key={pr.procedimento} className="group/p">
                    <summary className="flex cursor-pointer list-none items-center gap-2 py-1 pl-4 text-sm">
                      <ChevronRight className="size-3.5 shrink-0 transition-transform group-open/p:rotate-90" />
                      <span className="flex-1 truncate" title={pr.procedimento}>
                        {pr.procedimento}
                      </span>
                      <span className="tabular-nums">{fmtNum(pr.total)}</span>
                      <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{comp(pr.atendidas, pr.verificaveis)}</span>
                    </summary>
                    <ul className="space-y-0.5 pb-1 pl-12 text-xs text-muted-foreground">
                      {pr.profissionais.map((pf) => (
                        <li key={pf.profissional} className="flex gap-2">
                          <span className="flex-1 truncate">{pf.profissional}</span>
                          <span className="tabular-nums">{fmtNum(pf.total)}</span>
                          <span className="w-16 text-right tabular-nums">{fmtNum(pf.atendidas)} vieram</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </details>
          ))}
          {!d.arvore.length && <p className="text-sm text-muted-foreground">Nenhuma marcação com estes filtros.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
