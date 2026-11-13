import { MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina, Vazio } from "@/components/app/blocos";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hojeNoFuso } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { evolucaoSus, obterFormulario, resultadosFormulario } from "@/lib/dados/formularios";
import { faixaSus, nomeRodada, type Pergunta, pontuacaoSus, ROTULOS_ESCALA5, textoAgenda } from "@/lib/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Resultados do formulário" };

const COR_FAIXA = { ruim: "text-red-600", ok: "text-amber-600", bom: "text-sky-600", otimo: "text-emerald-600" } as const;
const um = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Barras de distribuição (quantas pessoas marcaram cada nota). */
function Distribuicao({ p, valores }: { p: Pergunta; valores: (number | string)[] }) {
  const opcoes: (number | string)[] = p.tipo === "escala5" ? [1, 2, 3, 4, 5] : p.tipo === "escala10" ? Array.from({ length: 11 }, (_, i) => i) : (p.opcoes ?? []);
  const max = Math.max(1, ...opcoes.map((o) => valores.filter((v) => v === o).length));
  return (
    <div className="space-y-1">
      {opcoes.map((o) => {
        const n = valores.filter((v) => v === o).length;
        const rotulo = p.tipo === "escala5" ? `${o} · ${ROTULOS_ESCALA5[Number(o) - 1]}` : String(o);
        return (
          <div key={String(o)} className="grid grid-cols-[minmax(0,11rem)_1fr_2rem] items-center gap-2 text-xs">
            <span className="truncate text-muted-foreground">{rotulo}</span>
            <div className="h-3 rounded-full bg-muted">
              <div className="h-3 rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-right tabular-nums">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function PaginaResultados(props: PageProps<"/formularios/[id]">) {
  await exigirAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const db = await criarClienteServidor();
  const f = await obterFormulario(db, id);
  if (!f) notFound();
  const [r, evolucao] = await Promise.all([
    resultadosFormulario(db, f, typeof sp.rodada === "string" ? sp.rodada : null, hojeNoFuso()),
    evolucaoSus(db, f, (resp) => pontuacaoSus(f.perguntas, resp)),
  ]);

  const notas = f.modelo === "sus" ? r.respostas.map((x) => pontuacaoSus(f.perguntas, x.respostas)).filter((n): n is number => n !== null) : [];
  const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
  const faixa = media !== null ? faixaSus(media) : null;
  const total = r.responderam.length + r.faltam.length;
  const susIds = new Set(f.modelo === "sus" ? f.perguntas.filter((p) => p.tipo === "escala5").slice(0, 10).map((p) => p.id) : []);

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo={f.titulo}
        descricao={`${textoAgenda(f)} · ${f.anonimo ? "anônimo: você vê quem respondeu, não o que cada um respondeu" : "identificado"}`}
        acoes={
          <Link href={`/formularios/${f.id}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Editar perguntas
          </Link>
        }
      />

      {r.rodadas.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Rodada">
          {r.rodadas.map((x) => (
            <Link
              key={x}
              role="tab"
              aria-selected={x === r.rodada}
              href={`/formularios/${f.id}?rodada=${x}`}
              className={cn("rounded-full border px-3 py-1 text-sm", x === r.rodada ? "border-primary bg-primary-soft font-medium" : "hover:bg-muted")}
            >
              {nomeRodada(x)}
            </Link>
          ))}
        </div>
      )}

      {!r.rodada ? (
        <Vazio icone={MessageSquareQuote} titulo="Ainda sem respostas" texto="Quando a rodada abrir e as pessoas responderem, os resultados aparecem aqui." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Rodada {nomeRodada(r.rodada)}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {r.responderam.length}
                  <span className="text-base font-normal text-muted-foreground"> de {total} responderam</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                {r.faltam.length ? (
                  <p>
                    <b className="text-foreground">Ainda não entraram no site:</b> {r.faltam.join(", ")}
                  </p>
                ) : (
                  <p>Todos responderam.</p>
                )}
              </CardContent>
            </Card>

            {media !== null && faixa && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardDescription>Nota de facilidade de uso (SUS, 0 a 100 · média de mercado 68)</CardDescription>
                  <CardTitle className={cn("text-3xl tabular-nums", COR_FAIXA[faixa.tom])}>
                    {um(media)} <span className="text-base font-medium">· {faixa.rotulo}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{faixa.texto}</p>
                  <div className="relative h-3 rounded-full bg-gradient-to-r from-red-400 via-amber-300 via-55% to-emerald-400">
                    <span className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-foreground" style={{ left: `calc(${media}% - 2px)` }} title={`Nota ${um(media)}`} />
                    <span className="absolute -bottom-4 text-[10px] text-muted-foreground" style={{ left: "66%" }}>
                      68
                    </span>
                  </div>
                  {evolucao.length > 1 && (
                    <div className="space-y-1 pt-3 text-xs">
                      <div className="font-medium">Evolução</div>
                      {evolucao.map((e) => (
                        <div key={e.rodada} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
                          <span className="text-muted-foreground">{nomeRodada(e.rodada)}</span>
                          <div className="h-2.5 rounded-full bg-muted">
                            <div className="h-2.5 rounded-full bg-primary" style={{ width: `${e.nota}%` }} />
                          </div>
                          <span className="text-right tabular-nums">{um(e.nota)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {f.perguntas.map((p, i) => {
              const valores = r.respostas.map((x) => x.respostas[p.id]).filter((v) => v !== undefined && v !== "");
              const numeros = valores.filter((v): v is number => typeof v === "number");
              const negativa = susIds.has(p.id) && i % 2 === 1;
              return (
                <Card key={p.id} className={p.tipo === "texto" ? "lg:col-span-2" : undefined}>
                  <CardHeader>
                    <CardTitle className="text-sm leading-snug font-medium">
                      <span className="text-muted-foreground">{i + 1}.</span> {p.texto}
                    </CardTitle>
                    <CardDescription>
                      {valores.length} respostas
                      {numeros.length > 0 && (
                        <>
                          {" "}
                          · média <b className="text-foreground tabular-nums">{um(numeros.reduce((s, n) => s + n, 0) / numeros.length)}</b>
                          {p.tipo === "escala5" ? " de 5" : " de 10"}
                        </>
                      )}
                      {negativa && " · frase negativa: quanto MENOR, melhor"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {p.tipo === "texto" ? (
                      valores.length ? (
                        <ul className="space-y-2">
                          {r.respostas
                            .filter((x) => typeof x.respostas[p.id] === "string" && x.respostas[p.id] !== "")
                            .map((x, k) => (
                              <li key={k} className="rounded-lg border-l-2 border-primary/50 bg-muted/40 px-3 py-2 text-sm">
                                “{String(x.respostas[p.id])}”
                                {x.colaborador && <span className="mt-1 block text-xs text-muted-foreground">{x.colaborador}</span>}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Ninguém escreveu nada ainda.</p>
                      )
                    ) : (
                      <Distribuicao p={p} valores={valores} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
