import { Monitor } from "lucide-react";
import { CabecalhoPagina, NivelBadge, Vazio } from "@/components/app/blocos";
import { BotaoAcao } from "@/components/app/form-acao";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirGestaoOuLider } from "@/lib/auth";
import { type ConfigTv, normalizarConfig } from "@/lib/tv-config";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { alternarPainel } from "./actions";
import { BotaoControle, EditarPainel, ExcluirPainel, NovoPainel, RegenerarLink } from "./cliente";

export const metadata = { title: "Painéis de TV" };

export default async function PaginaPaineis() {
  const s = await exigirGestaoOuLider();
  const db = await criarClienteServidor();

  const [{ data: paineis }, { data: equipes }] = await Promise.all([
    db.from("paineis_tv").select("id, nome, equipes, config, ativo, criado_em, ultimo_acesso").order("criado_em", { ascending: false }),
    db.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const nomeEquipe = new Map((equipes ?? []).map((e) => [e.id, e.nome]));

  // Líder que não vê tudo vê apenas as equipes que lidera
  const equipesDisponiveis = s.vêTudo ? (equipes ?? []) : (equipes ?? []).filter((e) => s.lidera.includes(e.id));

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
            const cfg = normalizarConfig(p.config as ConfigTv);
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">{p.nome}</span>
                      <NivelBadge nivel={p.ativo ? "Ativo" : "Desativado"} cor={p.ativo ? "var(--up)" : "var(--muted-foreground)"} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(p.equipes as string[]).map((id) => nomeEquipe.get(id) ?? "?").join(", ")} · {cfg.modos.length} tipo(s) de tela ×{" "}
                      {cfg.periodos?.length ?? 0} período(s)
                    </div>
                    <div className="text-xs text-muted-foreground">Último acesso: {fmtDataHora(p.ultimo_acesso)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.ativo && <BotaoControle id={p.id} />}
                    <EditarPainel
                      painel={{
                        id: p.id,
                        nome: p.nome,
                        equipes: p.equipes as string[],
                        config: cfg,
                      }}
                      equipes={equipesDisponiveis}
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
            <NovoPainel equipes={equipesDisponiveis} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
