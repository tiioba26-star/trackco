import { ArrowRight, Crown, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { BarraAtingimento, NivelBadge, Rotulo } from "@/components/app/blocos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResultadoApuracao, ResultadoIndicador } from "@/engine/tipos";
import type { PosicaoRanking } from "@/lib/dados/painel";
import { carinhaEmoji, fmtPct, fmtValor, tempoRelativo } from "@/lib/formato";
import { cn } from "@/lib/utils";

export function CartaoIndicador({ ind, mesCorrente }: { ind: ResultadoIndicador; mesCorrente: boolean }) {
  const taxa = ind.unidade === "%";
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{ind.nome}</CardTitle>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
            {ind.escopo === "equipe" ? (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> equipe
              </span>
            ) : ind.peso > 0 ? (
              `peso ${ind.peso}`
            ) : (
              "informativo"
            )}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-3xl font-semibold tabular-nums">{fmtValor(ind.realizado, ind.unidade)}</span>
          {ind.meta_ajustada !== null && (
            <span className="text-sm text-muted-foreground">de {fmtValor(ind.meta_ajustada, ind.unidade)}</span>
          )}
        </div>
        {taxa && ind.denominador !== undefined && (
          <div className="text-xs text-muted-foreground">
            {fmtValor(ind.numerador ?? 0)} de {fmtValor(ind.denominador)} consultas marcadas
          </div>
        )}
        <BarraAtingimento pct={ind.atingimento_pct} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span className={cn("font-medium", (ind.atingimento_pct ?? 0) >= 100 ? "text-up" : "text-foreground")}>
            {ind.sem_meta ? "Sem meta definida" : `${fmtPct(ind.atingimento_pct)} da meta`}
          </span>
          {mesCorrente && ind.ritmo_necessario_dia !== null && (
            <span className="text-muted-foreground">
              {ind.ritmo_necessario_dia > 0 ? `faltam ${fmtValor(ind.ritmo_necessario_dia)}/dia útil` : "meta alcançada 🎉"}
            </span>
          )}
          {mesCorrente && ind.projecao !== null && !taxa && (
            <span className="text-muted-foreground">projeção {fmtValor(ind.projecao)}</span>
          )}
        </div>
        {ind.ajuste_total !== 0 && (
          <div className="text-[11px] text-muted-foreground">
            inclui ajuste manual de {ind.ajuste_total > 0 ? "+" : ""}
            {fmtValor(ind.ajuste_total)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CartaoNivel({
  resultado,
  href,
  titulo = "Seu nível no mês",
}: {
  resultado: Omit<ResultadoApuracao, "itens">;
  href: string;
  titulo?: string;
}) {
  const cor = resultado.faixa?.cor ?? "var(--primary)";
  return (
    <Card className="relative overflow-hidden" data-tour="nivel">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{ background: `radial-gradient(80% 120% at 100% 0%, ${cor}, transparent 70%)` }}
      />
      <CardContent className="relative flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Rotulo>{titulo}</Rotulo>
            <div className="font-heading text-2xl font-semibold" style={{ color: cor }}>
              {resultado.faixa?.nivel ?? "Sem nível"}
            </div>
            <div className="text-sm text-muted-foreground">
              Nota geral <span className="font-semibold text-foreground">{fmtPct(resultado.nota_pct)}</span>
            </div>
          </div>
          <div className="text-5xl leading-none" aria-hidden>
            {carinhaEmoji(resultado.nota_pct)}
          </div>
        </div>
        {resultado.recompensa?.descricao && (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">🏅 {resultado.recompensa.descricao}</div>
        )}
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Ver extrato e memorial <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function ListaRanking({ ranking, comp }: { ranking: PosicaoRanking[]; comp: string }) {
  if (!ranking.length) return <p className="text-sm text-muted-foreground">Sem dados de ranking neste mês.</p>;
  return (
    <ol className="space-y-1.5">
      {ranking.map((r, i) => (
        <li
          key={r.colaborador_id ?? `p${i}`}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
            r.eu ? "bg-primary-soft ring-1 ring-primary/30" : "hover:bg-muted/60",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              r.posicao === 1 ? "bg-[#f5b72e] text-black" : "bg-muted text-muted-foreground",
            )}
          >
            {r.posicao === 1 ? <Crown className="size-3.5" /> : r.posicao}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {r.colaborador_id && r.nome ? (
              <Link href={`/extrato?c=${r.colaborador_id}&comp=${comp}`} className="hover:underline">
                {r.nome}
              </Link>
            ) : (
              (r.nome ?? "—")
            )}
            {r.eu && <span className="ml-1.5 text-xs text-primary">(você)</span>}
          </span>
          <NivelBadge nivel={r.nivel} />
          <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">{r.nota !== null ? fmtPct(r.nota) : ""}</span>
        </li>
      ))}
    </ol>
  );
}

export function StatusSync({
  sync,
}: {
  sync: { iniciado_em: string; finalizado_em: string | null; status: string } | null;
}) {
  const quando = sync?.finalizado_em ?? sync?.iniciado_em ?? null;
  const ruim = sync?.status === "erro";
  return (
    <div
      data-tour="sync"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs",
        ruim ? "border-destructive/40 text-destructive" : "text-muted-foreground",
      )}
      title={sync ? `Status: ${sync.status}` : "O robô ainda não rodou"}
    >
      <RefreshCw className="size-3.5" />
      {sync ? `Klingo ${ruim ? "com erro" : "atualizado"} ${tempoRelativo(quando)}` : "Aguardando 1ª sincronização"}
    </div>
  );
}

/** Bloco de métricas só de análise (ex.: SUS). Deixa claro que não conta para metas nem prêmios. */
export function CartaoAnalise({
  valores,
  nomes,
}: {
  valores: { codigo: string; nome: string; unidade: string; total: number; porPessoa: { id: string; valor: number }[] }[];
  nomes?: Map<string, string>;
}) {
  if (!valores.length) return null;
  return (
    <Card data-tour="analise">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>SUS · só acompanhamento</CardTitle>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            não conta para metas, nota ou prêmios
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-8">
          {valores.map((v) => (
            <div key={v.codigo}>
              <Rotulo>{v.nome}</Rotulo>
              <div className="font-heading text-3xl font-semibold tabular-nums">{fmtValor(v.total, v.unidade)}</div>
            </div>
          ))}
        </div>
        {nomes && valores[0].porPessoa.length > 1 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Pessoa</th>
                  {valores.map((v) => (
                    <th key={v.codigo} className="py-1 text-right font-medium">
                      {v.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {valores[0].porPessoa
                  .map((p) => p.id)
                  .sort((a, b) => (valores[0].porPessoa.find((x) => x.id === b)?.valor ?? 0) - (valores[0].porPessoa.find((x) => x.id === a)?.valor ?? 0))
                  .map((id) => (
                    <tr key={id} className="border-t">
                      <td className="py-1.5">{nomes.get(id) ?? "—"}</td>
                      {valores.map((v) => (
                        <td key={v.codigo} className="py-1.5 text-right tabular-nums">
                          {fmtValor(v.porPessoa.find((x) => x.id === id)?.valor ?? 0, v.unidade)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
