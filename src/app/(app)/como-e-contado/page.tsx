import { CalendarCheck, CalendarPlus, Check, Minus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, Rotulo } from "@/components/app/blocos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { descreverRecompensa, encontrarFaixa } from "@/engine/apuracao";
import { competenciaDe, hojeNoFuso, nomeCompetencia } from "@/engine/datas";
import type { Contagem, Indicador, Metrica } from "@/engine/tipos";
import { exigirSessao } from "@/lib/auth";
import { planoVigente } from "@/lib/calculo/carregar";
import { fmtDataHora, fmtPct } from "@/lib/formato";
import { metricaPorPapel } from "@/lib/metricas-papel";
import { ultimaSync } from "@/lib/dados/painel";
import { ROTULO_SITUACAO } from "@/lib/situacao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Como é contado" };

// Sem os filtros cadastrados (ex.: métrica nova), usa a regra combinada com a IOBA.
const FORA_PADRAO = ["remarcada", "falta_remarcada", "bloqueio_clinica", "erro"];

/** Situações que um filtro "situação não é …" tira da conta. */
function situacoesFora(c: Contagem | undefined): string[] | null {
  const f = c?.filtros.find((x) => x.campo === "situacao" && (x.op === "nao_em" || x.op === "diferente"));
  if (!f) return null;
  return Array.isArray(f.valor) ? f.valor : f.valor ? [f.valor] : [];
}

const SITUACOES: { chave: string; texto: string }[] = [
  { chave: "realizada", texto: "O paciente veio e foi atendido (aparece no faturamento do Klingo)." },
  { chave: "nao_realizada", texto: "O dia passou e o paciente não veio, sem cancelar nem remarcar." },
  { chave: "cancelada", texto: "Cancelada sem remarcar (ex.: o paciente desistiu)." },
  { chave: "remarcada", texto: "Trocada por outra data. A marcação antiga sai; a nova conta no dia em que foi feita." },
  { chave: "falta_remarcada", texto: "O paciente faltou e depois a consulta foi remarcada." },
  { chave: "bloqueio_clinica", texto: "A clínica bloqueou a agenda (ex.: médico ausente, aparelho parado). Não é culpa de quem marcou." },
  { chave: "erro", texto: "Erro de cadastro, marcação duplicada ou unificada." },
  { chave: "futura", texto: "A consulta ainda vai acontecer." },
];

function Marca({ sim, nota }: { sim: boolean; nota?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", sim ? "text-up" : "text-muted-foreground")}>
      {sim ? <Check className="size-4" aria-label="conta" /> : <Minus className="size-4" aria-label="não conta" />}
      {nota ? <span className="text-xs">{nota}</span> : null}
    </span>
  );
}

export default async function PaginaComoEContado() {
  const s = await exigirSessao();
  const hoje = hojeNoFuso();
  const comp = competenciaDe(hoje);
  const db = await criarClienteServidor();

  let equipeId = s.equipes.find((e) => e.funcao === "membro")?.equipe_id ?? s.equipes[0]?.equipe_id;
  if (!equipeId && s.vêTudo) {
    const { data } = await db.from("equipes").select("id").eq("ativo", true).order("nome").limit(1).maybeSingle();
    equipeId = data?.id;
  }
  const [{ data: metRows }, sync, plano] = await Promise.all([
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo").eq("ativo", true),
    ultimaSync(db),
    equipeId ? planoVigente(db, equipeId, comp) : Promise.resolve(null),
  ]);
  const metricas = (metRows ?? []) as Metrica[];
  const validos = metricaPorPapel(metricas, "agendamentos_validos");
  const conversao = metricaPorPapel(metricas, "conversao");
  const foraValidos = new Set((validos?.definicao.tipo_calculo === "simples" ? situacoesFora(validos.definicao) : null) ?? FORA_PADRAO);
  const foraBase = new Set((conversao?.definicao.tipo_calculo === "taxa" ? situacoesFora(conversao.definicao.denominador) : null) ?? FORA_PADRAO);
  const nomeMetrica = (id: string) => metricas.find((m) => m.id === id)?.nome ?? "Indicador";

  const def = plano?.definicao;
  const deMembro = (def?.indicadores ?? []).filter((i) => i.aplica_a !== "lider" && i.peso > 0);
  const deLider = (def?.indicadores ?? []).filter((i) => i.aplica_a !== "membros" && i.peso > 0);
  const faixas = [...(def?.faixas ?? [])].sort((a, b) => a.de_pct - b.de_pct);
  // exemplo de nota com os pesos do plano de verdade
  const exemplo = deMembro.map((ind, k) => ({ ind, pct: [90, 110, 100, 95, 105][k % 5] }));
  const somaPesos = exemplo.reduce((t, x) => t + x.ind.peso, 0);
  const notaExemplo = somaPesos ? exemplo.reduce((t, x) => t + x.ind.peso * Math.min(x.pct, x.ind.teto_pct), 0) / somaPesos : null;
  const faixaExemplo = encontrarFaixa(faixas, notaExemplo);

  const linhaIndicador = (ind: Indicador) => (
    <li key={ind.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b py-2 last:border-0">
      <span className="font-medium">{ind.nome ?? nomeMetrica(ind.metrica_id)}</span>
      <span className="text-sm text-muted-foreground">
        peso <b className="text-foreground">{ind.peso}</b> · conta até {ind.teto_pct}%{ind.meta_proporcional ? " · meta proporcional aos dias trabalhados" : ""}
      </span>
    </li>
  );

  return (
    <div className="space-y-8">
      <CabecalhoPagina
        titulo="Como é contado"
        descricao={
          <>
            Cada número do Trackco, de onde vem e o que entra nele. Tudo vem do Klingo, por quem aparece como responsável pela marcação, e
            atualiza sozinho de hora em hora{sync?.finalizado_em ? ` (última vez: ${fmtDataHora(sync.finalizado_em)})` : ""}.
          </>
        }
      />

      {/* 1. as duas datas */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">1. Toda marcação tem duas datas</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex gap-3">
              <CalendarPlus className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1">
                <div className="font-semibold">O dia em que você marcou</div>
                <p className="text-sm text-muted-foreground">
                  Conta em <b className="text-foreground">Agendamentos</b>. Mede o seu esforço: quanto você marcou no dia, na semana, no mês.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex gap-3">
              <Stethoscope className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1">
                <div className="font-semibold">O dia da consulta</div>
                <p className="text-sm text-muted-foreground">
                  Conta em <b className="text-foreground">Consultas marcadas para o período</b>, <b className="text-foreground">Realizadas</b> e{" "}
                  <b className="text-foreground">Comparecimento</b>. Mede o resultado: o paciente veio?
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
          <b>Exemplo:</b> você marcou em <b>28/10</b> uma consulta para <b>05/11</b>. Ela é um agendamento de <b>outubro</b> (dia 28) e uma consulta de{" "}
          <b>novembro</b> (dia 05). Se o paciente vier, vira uma realizada de novembro.
        </p>
      </section>

      {/* 2. cada número em uma frase */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">2. Cada número, em uma frase</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              t: "Agendamentos (total)",
              d: "Todas as marcações que você fez no período, pelo dia em que marcou. Inclui remarcações, bloqueios e erros. Aparece sempre ao lado dos válidos, para comparar.",
            },
            {
              t: "Agendamentos válidos",
              d: "O total sem as marcações que não valem (veja a tabela abaixo). É o número principal: vale para ranking, meta e nota. Cada marcação conta uma vez: dois procedimentos diferentes contam 2.",
            },
            {
              t: "Consultas marcadas para o período",
              d: "Consultas suas cuja data da consulta cai no período, marcadas em qualquer dia. No mês em curso inclui as que ainda vão acontecer.",
            },
            {
              t: "Realizadas (compareceram)",
              d: "Das consultas marcadas para o período, as que o paciente veio e foram atendidas, confirmadas pelo faturamento do Klingo.",
            },
            {
              t: "Taxa de comparecimento",
              d: "Realizadas ÷ consultas marcadas, só nos dias que já passaram (até ontem). Ex.: 72% = de cada 100 consultas, 72 aconteceram.",
            },
            {
              t: "SUS",
              d: "Mostrado só para acompanhar. Nunca entra em meta, nota, prêmio, comissão ou pontos.",
            },
          ].map((x) => (
            <Card key={x.t}>
              <CardContent className="space-y-1">
                <div className="font-semibold">{x.t}</div>
                <p className="text-sm text-muted-foreground">{x.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. o que acontece com cada marcação */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">3. O que conta para quê</h3>
          <p className="text-sm text-muted-foreground">
            Cada marcação termina numa destas situações. A tabela mostra em quais números ela entra (Particular; o SUS segue a mesma lógica, só
            para acompanhar).
          </p>
        </div>
        <Card>
          <CardContent>
            <Table containerClassName="rounded-lg border">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-56">Situação</TableHead>
                  <TableHead className="text-center">Agendamentos (total)</TableHead>
                  <TableHead className="text-center">Agendamentos válidos</TableHead>
                  <TableHead className="text-center">Base do comparecimento</TableHead>
                  <TableHead className="text-center">Realizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SITUACOES.map(({ chave, texto }) => {
                  const r = ROTULO_SITUACAO[chave];
                  const futura = chave === "futura";
                  return (
                    <TableRow key={chave}>
                      <TableCell className="whitespace-normal">
                        <div className={cn("font-medium", r?.c)}>{futura ? "Ainda vai acontecer" : (r?.t ?? chave)}</div>
                        <div className="text-xs text-muted-foreground">{texto}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Marca sim />
                      </TableCell>
                      <TableCell className="text-center">
                        <Marca sim={!foraValidos.has(chave)} />
                      </TableCell>
                      <TableCell className="text-center">
                        {futura ? <Marca sim nota="quando o dia passar" /> : <Marca sim={!foraBase.has(chave)} />}
                      </TableCell>
                      <TableCell className="text-center">{futura ? <Marca sim={false} nota="ainda não" /> : <Marca sim={chave === "realizada"} />}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* 4. nota e nível (do plano de verdade) */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">4. Como os números viram nota e nível</h3>
          <p className="text-sm text-muted-foreground">
            {plano
              ? `Regras do plano "${plano.nome}" (versão ${plano.versao_numero}), valendo em ${nomeCompetencia(comp)}.`
              : "Sua equipe ainda não tem um plano ativo."}
          </p>
        </div>
        {plano && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>O que entra na nota</CardTitle>
                <CardDescription>Cada indicador tem uma meta no mês. Atingimento = o que você fez ÷ a meta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deMembro.length > 0 && (
                  <div>
                    <Rotulo>Atendentes</Rotulo>
                    <ul>{deMembro.map(linhaIndicador)}</ul>
                  </div>
                )}
                {deLider.length > 0 && (
                  <div>
                    <Rotulo>Líder (pela equipe toda)</Rotulo>
                    <ul>{deLider.map(linhaIndicador)}</ul>
                  </div>
                )}
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    <b className="text-foreground">Nota</b> = média dos atingimentos, com os pesos acima.
                  </li>
                  <li>
                    <b className="text-foreground">Limite:</b> passar muito da meta num indicador ajuda só até o limite (ex.: 150%); assim ninguém
                    compensa um indicador fraco com outro exagerado.
                  </li>
                  <li>
                    <b className="text-foreground">Férias, folgas e feriados:</b> a meta diminui na proporção dos dias em que você não trabalhou.
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Níveis</CardTitle>
                <CardDescription>A nota do mês define o nível e o reconhecimento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {faixas.map((f) => (
                    <li key={f.id} className="flex items-center gap-3">
                      <span className="size-3 shrink-0 rounded-full" style={{ background: f.cor ?? "var(--muted-foreground)" }} />
                      <span className="w-40 font-medium">{f.nivel}</span>
                      <span className="text-sm text-muted-foreground">
                        {f.ate_pct === null ? `${f.de_pct}% ou mais` : f.de_pct === 0 ? `abaixo de ${f.ate_pct}%` : `de ${f.de_pct}% a ${f.ate_pct - 0.1}%`}
                        {f.recompensa ? ` · ${descreverRecompensa(f.recompensa)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {notaExemplo !== null && (
                  <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                    <b>Exemplo:</b>{" "}
                    {exemplo.map((x, k) => (
                      <span key={x.ind.id}>
                        {k > 0 ? ", " : ""}
                        {(x.ind.nome ?? nomeMetrica(x.ind.metrica_id)).toLowerCase()} {x.pct}% (peso {x.ind.peso})
                      </span>
                    ))}{" "}
                    → nota <b>{fmtPct(notaExemplo)}</b>
                    {faixaExemplo ? (
                      <>
                        {" "}
                        → <b>{faixaExemplo.nivel}</b>
                      </>
                    ) : null}
                    .
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  No meio do mês a nota compara com a meta do mês inteiro, por isso começa baixa e sobe com os dias. O Painel mostra o ritmo
                  necessário por dia e a projeção de fechamento.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* 5. casos especiais */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">5. Casos especiais</h3>
        <Card>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {[
                ["Mesmo paciente, dois procedimentos diferentes", "Conta 2: são duas marcações."],
                ["Paciente que volta em outro mês (retorno)", "Conta de novo: é uma nova marcação."],
                [
                  "Duas marcações do mesmo paciente para o mesmo dia e só uma aconteceu",
                  "A realizada fica com quem fez a marcação que não foi cancelada (o Klingo registra de quem era a cancelada).",
                ],
                ["Marcação Particular, mas o paciente foi atendido pelo SUS", "Não conta como realizada Particular."],
                ["Consulta de hoje", "Só entra no comparecimento amanhã: o dia ainda não terminou."],
                [
                  "Remarcação depois que o mês acabou",
                  "Se uma marcação de outubro for remarcada em novembro, os válidos de outubro diminuem. O fechamento do mês congela os números.",
                ],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <b>{t}:</b> <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border bg-primary-soft px-5 py-4 text-sm">
        <b>Achou algum número errado?</b> No{" "}
        <Link href="/extrato" className="font-medium text-primary underline-offset-4 hover:underline">
          Extrato
        </Link>{" "}
        você vê cada marcação que entrou na conta e pode abrir uma{" "}
        <Link href="/contestacoes" className="font-medium text-primary underline-offset-4 hover:underline">
          contestação
        </Link>
        . Ela fica registrada e é respondida pelo líder ou pelo administrador.
      </section>
    </div>
  );
}
