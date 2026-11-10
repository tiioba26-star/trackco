import { CheckCircle2, Circle, CircleAlert, Calculator, RotateCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina, NivelBadge, StatusPill } from "@/components/app/blocos";
import { BotaoAcao } from "@/components/app/form-acao";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { descreverRecompensa } from "@/engine/apuracao";
import { formatarDataBR, nomeCompetencia } from "@/engine/datas";
import type { ResultadoApuracao } from "@/engine/tipos";
import { exigirGestaoOuLider } from "@/lib/auth";
import { quemAvanca, proximo, ROTULO_ACAO, ROTULO_STATUS, sequencia, type StatusFechamento } from "@/lib/fechamento";
import { fmtDataHora, fmtPct } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { avancar, calcular, reabrir } from "../actions";

export const metadata = { title: "Fechamento" };

export default async function PaginaFechamento(props: PageProps<"/fechamentos/[id]">) {
  const s = await exigirGestaoOuLider();
  const { id } = await props.params;
  const db = await criarClienteServidor();
  const { data: f } = await db
    .from("fechamentos")
    .select("id, equipe_id, competencia, status, prazo_contestacao, calculado_em, log, equipes(nome, etapas_aprovacao)")
    .eq("id", id)
    .maybeSingle();
  if (!f) notFound();
  const equipe = f.equipes as unknown as { nome: string; etapas_aprovacao: string[] };
  const status = f.status as StatusFechamento;
  const seq = sequencia(equipe.etapas_aprovacao);
  const prox = proximo(status, equipe.etapas_aprovacao);
  const quem = quemAvanca(status);
  const podeAvancar = !!prox && !!quem && (s.ehAdmin || (quem === "lider_ou_admin" && s.lidera.includes(f.equipe_id)));
  const congelado = status === "aprovado" || status === "entregue";

  const [{ data: aps }, { data: membros }, { data: sync }] = await Promise.all([
    db
      .from("apuracoes")
      .select("id, colaborador_id, funcao, nota, resultado")
      .eq("fechamento_id", id)
      .eq("tipo", "final")
      .order("nota", { ascending: false, nullsFirst: false }),
    db.from("equipe_membros").select("colaborador_id, colaboradores(nome, login_klingo)").eq("equipe_id", f.equipe_id).is("fim", null),
    db.from("sync_execucoes").select("status, iniciado_em").order("iniciado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ids = (membros ?? []).map((m) => m.colaborador_id as string);
  const [{ data: contest }, { data: ajustes }] = await Promise.all([
    db
      .from("contestacoes")
      .select("id, status, colaboradores!contestacoes_colaborador_id_fkey(nome)")
      .eq("competencia", f.competencia)
      .in("colaborador_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db
      .from("ajustes")
      .select("id, delta, justificativa, colaboradores!ajustes_colaborador_id_fkey(nome), metricas(nome)")
      .eq("competencia", f.competencia)
      .in("colaborador_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  type Ap = { id: string; colaborador_id: string; funcao: string; nota: number | null; resultado: ResultadoApuracao };
  const resultados = (aps ?? []) as unknown as Ap[];
  const abertas = (contest ?? []).filter((c) => ["aberta", "em_analise"].includes(c.status as string));
  const semMeta = resultados.filter((a) => a.resultado.indicadores.some((i) => i.peso > 0 && i.sem_meta));
  const semLogin = (membros ?? []).filter((m) => !(m.colaboradores as unknown as { login_klingo: string | null })?.login_klingo);
  const comp = String(f.competencia).slice(0, 7);

  const checklist = [
    { ok: !!f.calculado_em, t: f.calculado_em ? `Cálculo feito em ${fmtDataHora(f.calculado_em)}` : "Fechamento ainda não calculado" },
    { ok: abertas.length === 0, t: abertas.length ? `${abertas.length} contestação(ões) em aberto` : "Nenhuma contestação em aberto" },
    { ok: semMeta.length === 0, t: semMeta.length ? `${semMeta.length} pessoa(s) com indicador sem meta` : "Todos os indicadores têm meta" },
    { ok: semLogin.length === 0, t: semLogin.length ? `${semLogin.length} membro(s) sem login do Klingo` : "Todos os membros com login do Klingo" },
    { ok: sync?.status !== "erro", t: sync?.status === "erro" ? "Última sincronização com erro" : "Sincronização do Klingo em dia" },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`Fechamento · ${equipe.nome}`}
        descricao={<span className="capitalize">{nomeCompetencia(comp)}</span>}
        acoes={
          <>
            {s.ehAdmin && !congelado && (
              <BotaoAcao variant="outline" acao={calcular.bind(null, id)} sucesso="Calculado.">
                <Calculator /> {f.calculado_em ? "Recalcular" : "Calcular"}
              </BotaoAcao>
            )}
            {s.ehAdmin && status === "aprovado" && (
              <BotaoAcao variant="ghost" confirmar="Reabrir o fechamento para revisão?" acao={reabrir.bind(null, id)}>
                <RotateCcw /> Reabrir
              </BotaoAcao>
            )}
            {podeAvancar && prox && (
              <BotaoAcao
                acao={avancar.bind(null, id)}
                confirmar={prox === "aprovado" ? "Aprovar congela o resultado do mês. Confirmar?" : undefined}
              >
                {ROTULO_ACAO[status] ?? `Avançar para ${ROTULO_STATUS[prox]}`}
              </BotaoAcao>
            )}
          </>
        }
      />

      <Card>
        <CardContent>
          <ol className="flex flex-wrap items-center gap-2">
            {seq.map((st, i) => {
              const feito = seq.indexOf(status) > i;
              const atual = st === status;
              return (
                <li key={st} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                      atual && "border-primary bg-primary-soft font-medium text-primary",
                      feito && "border-transparent text-up",
                      !atual && !feito && "text-muted-foreground",
                    )}
                  >
                    {feito ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                    {ROTULO_STATUS[st]}
                  </span>
                  {i < seq.length - 1 && <span className="text-muted-foreground">→</span>}
                </li>
              );
            })}
          </ol>
          {status === "em_contestacao" && f.prazo_contestacao && (
            <p className="mt-3 text-sm text-muted-foreground">Contestações até {formatarDataBR(f.prazo_contestacao)}.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>O que revisar</CardTitle>
            <CardDescription>Itens que costumam gerar divergência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((c) => (
              <div key={c.t} className="flex items-start gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="mt-0.5 size-4 text-up" /> : <CircleAlert className="mt-0.5 size-4 text-warn" />}
                <span>{c.t}</span>
              </div>
            ))}
            {abertas.length > 0 && (
              <Link href="/contestacoes" className="block pt-1 text-sm text-primary underline">
                Responder contestações
              </Link>
            )}
            {(ajustes ?? []).length > 0 && (
              <div className="space-y-1 pt-3">
                <div className="text-xs font-medium text-muted-foreground uppercase">Ajustes manuais no mês</div>
                {(ajustes ?? []).map((a) => {
                  const x = a as unknown as { id: string; delta: number; justificativa: string; colaboradores: { nome: string } | null; metricas: { nome: string } | null };
                  return (
                    <div key={x.id} className="text-sm">
                      <b>{x.colaboradores?.nome}</b> · {x.metricas?.nome}: {x.delta > 0 ? "+" : ""}
                      {x.delta} — <span className="text-muted-foreground">{x.justificativa}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              {congelado ? "Resultado oficial congelado." : "Prévia do resultado; pode ser recalculada até a aprovação."}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {resultados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Clique em Calcular para gerar o resultado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead className="text-right">Nota</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/extrato?c=${a.colaborador_id}&comp=${comp}`} className="font-medium hover:underline">
                          {a.resultado.nome}
                        </Link>
                        <div className="text-xs text-muted-foreground">{a.funcao === "lider" ? "líder" : "membro"}</div>
                      </TableCell>
                      <TableCell>
                        <NivelBadge nivel={a.resultado.faixa?.nivel} cor={a.resultado.faixa?.cor} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(a.nota)}</TableCell>
                      <TableCell className="text-sm">{descreverRecompensa(a.resultado.recompensa)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {((f.log as { em: string; por: string; acao: string }[]) ?? [])
            .slice()
            .reverse()
            .map((l, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="tabular-nums text-muted-foreground">{fmtDataHora(l.em)}</span>
                <span className="font-medium">{l.por}</span>
                <span>{l.acao}</span>
              </div>
            ))}
          <div className="pt-2">
            <StatusPill status={status} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
