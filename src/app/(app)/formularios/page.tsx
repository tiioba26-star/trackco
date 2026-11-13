import { AlertTriangle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, Vazio } from "@/components/app/blocos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hojeNoFuso } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { listarFormularios } from "@/lib/dados/formularios";
import { nomeRodada, proximaAbertura, rodadaAtual, textoAgenda } from "@/lib/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ExcluirFormulario, LigarFormulario, NovoFormulario } from "./cliente";

export const metadata = { title: "Formulários" };

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default async function PaginaFormularios() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const hoje = hojeNoFuso();
  const [{ formularios, erro }, { data: envios }, { data: equipes }] = await Promise.all([
    listarFormularios(db),
    db.from("formulario_envios").select("formulario_id, rodada"),
    db.from("equipes").select("id, nome"),
  ]);
  const nomeEquipe = new Map((equipes ?? []).map((e) => [String(e.id), String(e.nome)]));

  return (
    <div>
      <CabecalhoPagina
        titulo="Formulários"
        descricao="Pesquisas curtas e obrigatórias: no dia marcado, o site fica desfocado até a pessoa responder. Use para medir se o Trackco está claro, justo e útil."
        acoes={!erro && <NovoFormulario />}
      />

      {erro ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Falta uma atualização do banco</AlertTitle>
          <AlertDescription>
            Cole a migration <code>20261113000011_trackco_confirmacoes_formularios.sql</code> no SQL Editor do Supabase e clique em Run. Depois recarregue esta página.
          </AlertDescription>
        </Alert>
      ) : !formularios.length ? (
        <Vazio icone={ClipboardList} titulo="Nenhum formulário" texto="Crie um a partir de um modelo pronto." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {formularios.map((f) => {
            const rodada = rodadaAtual(f, hoje);
            const proxima = proximaAbertura(f, hoje);
            const doForm = (envios ?? []).filter((e) => e.formulario_id === f.id);
            const nestaRodada = rodada ? doForm.filter((e) => e.rodada === rodada).length : 0;
            const publico = [
              f.publico.funcoes.length === 2 ? "Atendentes e líderes" : f.publico.funcoes[0] === "lider" ? "Só líderes" : "Só atendentes",
              f.publico.equipes.length ? f.publico.equipes.map((id) => nomeEquipe.get(id) ?? "?").join(", ") : "todas as equipes",
            ].join(" · ");
            return (
              <Card key={f.id} data-tour="form-cartao">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{f.titulo}</CardTitle>
                      <CardDescription>
                        {f.perguntas.length} perguntas · {textoAgenda(f)} · {publico}
                      </CardDescription>
                    </div>
                    <LigarFormulario id={f.id} ativo={f.ativo} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {f.anonimo && <Badge variant="secondary">Anônimo</Badge>}
                    {f.modelo === "sus" && <Badge variant="secondary">Nota SUS</Badge>}
                    {f.ativo && rodada && (
                      <Badge>
                        Aberto · rodada {nomeRodada(rodada)} · {nestaRodada} responderam
                      </Badge>
                    )}
                    {f.ativo && !rodada && proxima && <Badge variant="outline">Próxima vez: {dataBR(proxima)}</Badge>}
                    {!f.ativo && <Badge variant="outline">Desligado</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/formularios/${f.id}`} className={buttonVariants({ size: "sm" })}>
                      Resultados
                    </Link>
                    <Link href={`/formularios/${f.id}/editar`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                      Editar
                    </Link>
                    <ExcluirFormulario id={f.id} titulo={f.titulo} respostas={doForm.length} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
