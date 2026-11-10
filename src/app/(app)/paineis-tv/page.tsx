import { Monitor } from "lucide-react";
import { CabecalhoPagina, NivelBadge, Vazio } from "@/components/app/blocos";
import { BotaoAcao } from "@/components/app/form-acao";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAdmin } from "@/lib/auth";
import type { ConfigTv } from "@/lib/dados/tv";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { alternarPainel } from "./actions";
import { NovoPainel, RegenerarLink } from "./cliente";

export const metadata = { title: "Painéis de TV" };

export default async function PaginaPaineis() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const [{ data: paineis }, { data: equipes }] = await Promise.all([
    db.from("paineis_tv").select("id, nome, equipes, config, ativo, criado_em, ultimo_acesso").order("criado_em", { ascending: false }),
    db.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const nomeEquipe = new Map((equipes ?? []).map((e) => [e.id, e.nome]));

  return (
    <div>
      <CabecalhoPagina
        titulo="Painéis de TV"
        descricao="Links públicos (sem login) para deixar numa TV. Mostram o desempenho de forma anônima, com carinhas que nunca ficam tristes."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {!paineis?.length && <Vazio icone={Monitor} titulo="Nenhum painel criado" texto="Crie o primeiro ao lado." />}
          {(paineis ?? []).map((p) => {
            const cfg = p.config as ConfigTv;
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.nome}</span>
                      <NivelBadge nivel={p.ativo ? "Ativo" : "Desativado"} cor={p.ativo ? "var(--up)" : "var(--muted-foreground)"} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(p.equipes as string[]).map((id) => nomeEquipe.get(id) ?? "?").join(", ")} · {cfg.modos?.length ?? 0} modo(s) ·
                      troca a cada {cfg.intervalo}s
                    </div>
                    <div className="text-xs text-muted-foreground">Último acesso: {fmtDataHora(p.ultimo_acesso)}</div>
                  </div>
                  <div className="flex gap-2">
                    <RegenerarLink id={p.id} />
                    <BotaoAcao size="sm" variant="ghost" acao={alternarPainel.bind(null, p.id, !p.ativo)}>
                      {p.ativo ? "Desativar" : "Ativar"}
                    </BotaoAcao>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="h-fit" data-tour="tv-novo">
          <CardHeader>
            <CardTitle>Novo painel</CardTitle>
            <CardDescription>O link é gerado uma vez. Guarde-o ou gere outro depois.</CardDescription>
          </CardHeader>
          <CardContent>
            <NovoPainel equipes={equipes ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
