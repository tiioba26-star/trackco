import { Monitor } from "lucide-react";
import { CabecalhoPagina, NivelBadge, Vazio } from "@/components/app/blocos";
import { BotaoAcao } from "@/components/app/form-acao";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirGestaoOuLider } from "@/lib/auth";
import type { Metrica } from "@/engine/tipos";
import { usaSoKlingo } from "@/lib/dados/analise";
import type { ConfigTv } from "@/lib/dados/tv";
import { metricaPorPapel, resolverMetrica } from "@/lib/metricas-papel";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { alternarPainel } from "./actions";
import { EditarPainel, ExcluirPainel, NovoPainel, type OpcaoModo, RegenerarLink } from "./cliente";

export const metadata = { title: "Painéis de TV" };

export default async function PaginaPaineis() {
  const s = await exigirGestaoOuLider();
  const db = await criarClienteServidor();

  const [{ data: paineis }, { data: equipes }, { data: metRows }] = await Promise.all([
    db.from("paineis_tv").select("id, nome, equipes, config, ativo, criado_em, ultimo_acesso").order("criado_em", { ascending: false }),
    db.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo").eq("ativo", true).order("nome"),
  ]);
  // Métricas que podem virar barras na TV: contagens do Klingo (nunca R$, pontos ou taxas)
  const metricas = (metRows ?? []) as Metrica[];
  const padrao = new Set(
    (["agendamentos", "realizadas", "agendamentos_sus"] as const).map((p) => metricaPorPapel(metricas, p)?.id),
  );
  const opcoesModo: OpcaoModo[] = [
    ...metricas
      .filter((m) => m.unidade === "un" && usaSoKlingo(m.definicao))
      .sort((a, b) => Number(padrao.has(b.id)) - Number(padrao.has(a.id)))
      .map((m) => ({ valor: m.id, rotulo: `Barras · ${m.nome}`, padrao: padrao.has(m.id) })),
    { valor: "geral", rotulo: "Dashboard geral da equipe", padrao: true },
  ];
  /** Painéis antigos guardam o código da métrica: troca pelo id para a edição marcar certo. */
  const normalizar = (cfg: ConfigTv): ConfigTv => ({
    ...cfg,
    modos: (cfg.modos ?? []).map((m) =>
      m.tipo === "barras" ? { ...m, metrica: resolverMetrica(metricas, m.metrica)?.id ?? m.metrica } : m,
    ),
  });
  const nomeEquipe = new Map((equipes ?? []).map((e) => [e.id, e.nome]));

  // Líder que não vê tudo vê apenas as equipes que lidera
  const equipesDisponiveis = s.vêTudo
    ? (equipes ?? [])
    : (equipes ?? []).filter((e) => s.lidera.includes(e.id));

  return (
    <div>
      <CabecalhoPagina
        titulo="Painéis de TV"
        descricao="Links públicos (sem login) para TV. Acompanhamento em tempo real com visual premium, frases motivacionais e celebrações."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {!paineis?.length && <Vazio icone={Monitor} titulo="Nenhum painel criado" texto="Crie o primeiro ao lado." />}
          {(paineis ?? []).map((p) => {
            const cfg = normalizar(p.config as ConfigTv);
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">{p.nome}</span>
                      <NivelBadge nivel={p.ativo ? "Ativo" : "Desativado"} cor={p.ativo ? "var(--up)" : "var(--muted-foreground)"} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(p.equipes as string[]).map((id) => nomeEquipe.get(id) ?? "?").join(", ")} · {cfg.modos?.length ?? 0} modo(s) ·
                      troca a cada {cfg.intervalo}s
                    </div>
                    <div className="text-xs text-muted-foreground">Último acesso: {fmtDataHora(p.ultimo_acesso)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <EditarPainel
                      painel={{
                        id: p.id,
                        nome: p.nome,
                        equipes: p.equipes as string[],
                        config: cfg,
                      }}
                      equipes={equipesDisponiveis}
                      modos={opcoesModo}
                    />
                    <RegenerarLink id={p.id} />
                    <BotaoAcao size="sm" variant="ghost" acao={alternarPainel.bind(null, p.id, !p.ativo)}>
                      {p.ativo ? "Desativar" : "Ativar"}
                    </BotaoAcao>
                    <ExcluirPainel id={p.id} nome={p.nome} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="h-fit" data-tour="tv-novo">
          <CardHeader>
            <CardTitle>Novo painel</CardTitle>
            <CardDescription>Configure os modos, equipes e personalize as frases da TV.</CardDescription>
          </CardHeader>
          <CardContent>
            <NovoPainel equipes={equipesDisponiveis} modos={opcoesModo} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
