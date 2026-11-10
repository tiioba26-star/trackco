import { MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, StatusPill, Vazio } from "@/components/app/blocos";
import { Card, CardContent } from "@/components/ui/card";
import { formatarDataBR, nomeCompetencia } from "@/engine/datas";
import { exigirSessao } from "@/lib/auth";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Responder } from "./responder";

export const metadata = { title: "Contestações" };

interface Contestacao {
  id: string;
  colaborador_id: string;
  competencia: string;
  metrica_id: string | null;
  origem_chave: string | null;
  descricao: string;
  status: string;
  resposta: string | null;
  respondido_em: string | null;
  criado_em: string;
  colaboradores: { nome: string } | null;
  metricas: { nome: string } | null;
}

export default async function PaginaContestacoes(props: PageProps<"/contestacoes">) {
  const s = await exigirSessao();
  const sp = await props.searchParams;
  const filtro = sp.f === "todas" ? "todas" : "abertas";
  const db = await criarClienteServidor();
  let q = db
    .from("contestacoes")
    .select("id, colaborador_id, competencia, metrica_id, origem_chave, descricao, status, resposta, respondido_em, criado_em, colaboradores!contestacoes_colaborador_id_fkey(nome), metricas(nome)")
    .order("criado_em", { ascending: false })
    .limit(200);
  if (filtro === "abertas") q = q.in("status", ["aberta", "em_analise"]);
  const [{ data }, { data: mets }] = await Promise.all([q, db.from("metricas").select("id, nome").eq("ativo", true).order("nome")]);
  const lista = (data ?? []) as unknown as Contestacao[];

  const chaves = lista.map((c) => c.origem_chave).filter((x): x is string => !!x);
  const linhas = new Map<string, { paciente_nome: string | null; data_agendado_em: string; procedimento: string | null }>();
  if (chaves.length) {
    const { data: ls } = await db
      .from("klingo_agendamentos")
      .select("chave, paciente_nome, data_agendado_em, procedimento")
      .in("chave", chaves.slice(0, 150));
    for (const l of ls ?? []) linhas.set(l.chave, l);
  }
  const gestor = s.vêTudo || s.lidera.length > 0;

  return (
    <div>
      <CabecalhoPagina
        titulo="Contestações"
        descricao={
          gestor
            ? "Divergências apontadas pela equipe. Responda todas antes de aprovar o fechamento do mês."
            : "Suas contestações e as respostas. Para abrir uma nova, vá ao Extrato e use Contestar."
        }
        acoes={
          <div className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
            {(["abertas", "todas"] as const).map((f) => (
              <Link
                key={f}
                href={`/contestacoes?f=${f}`}
                className={cn("rounded-md px-3 py-1 capitalize", filtro === f ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {f}
              </Link>
            ))}
          </div>
        }
      />
      {lista.length === 0 ? (
        <Vazio
          icone={MessageSquareWarning}
          titulo={filtro === "abertas" ? "Nenhuma contestação em aberto" : "Nenhuma contestação"}
          texto="Quando alguém apontar uma divergência no extrato, ela aparece aqui."
        />
      ) : (
        <div className="space-y-3" data-tour="contest-lista">
          {lista.map((c) => {
            const l = c.origem_chave ? linhas.get(c.origem_chave) : undefined;
            const podeResponder = gestor && c.colaborador_id !== s.colaborador.id && ["aberta", "em_analise"].includes(c.status);
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.colaboradores?.nome}</span>
                      <StatusPill status={c.status} />
                      <span className="text-xs text-muted-foreground capitalize">
                        {nomeCompetencia(c.competencia)} {c.metricas ? `· ${c.metricas.nome}` : ""}
                      </span>
                    </div>
                    {l && (
                      <div className="text-xs text-muted-foreground">
                        Linha: {l.paciente_nome ?? "—"} · agendado em {formatarDataBR(l.data_agendado_em)} · {l.procedimento}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{c.descricao}</p>
                    {c.resposta && (
                      <div className="rounded-lg border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm">
                        <div className="text-xs text-muted-foreground">Resposta · {fmtDataHora(c.respondido_em)}</div>
                        {c.resposta}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Aberta em {fmtDataHora(c.criado_em)} ·{" "}
                      <Link className="text-primary hover:underline" href={`/extrato?c=${c.colaborador_id}&comp=${c.competencia.slice(0, 7)}`}>
                        ver extrato
                      </Link>
                    </div>
                  </div>
                  {podeResponder && (
                    <div data-tour="contest-acoes">
                      <Responder id={c.id} metricaId={c.metrica_id} metricas={mets ?? []} ehAdmin={s.ehAdmin} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
