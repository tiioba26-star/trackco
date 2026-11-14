import { AlertTriangle, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Vazio } from "@/components/app/blocos";
import { CarregandoPagina } from "@/components/app/carregando-pagina";
import { StatusSync } from "@/components/painel/cartoes";
import { BlocoEquipe, BlocoMeu } from "@/components/painel/blocos-painel";
import { SeletorPeriodo } from "@/components/painel/periodo";
import { ConviteRetrospectiva } from "@/components/retrospectiva/retrospectiva";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { competenciaAnterior, competenciaDe, hojeNoFuso } from "@/engine/datas";
import { janelaDoMes, nomeMes, janelaPersonalizada, type JanelaPeriodo, janelaRapida, PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";
import type { Categoria } from "@/engine/producao";
import type { Metrica } from "@/engine/tipos";
import { exigirSessao } from "@/lib/auth";
import { ultimaSync } from "@/lib/dados/painel";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Painel" };

/** Fronteira própria: ao voltar para o Painel, o esqueleto aparece na hora em vez de travar na página anterior. */
export default function PaginaPainel(props: PageProps<"/">) {
  return (
    <Suspense fallback={<CarregandoPagina variante="painel" />}>
      <ConteudoPainel {...props} />
    </Suspense>
  );
}

const ehData = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Lê o período da URL: ?p=hoje|semana|mes|mes_passado, ?comp=AAAA-MM ou ?de=…&ate=… (gestão). */
function lerPeriodo(sp: Record<string, string | string[] | undefined>, hoje: string, podePersonalizar: boolean): JanelaPeriodo {
  const p = String(sp.p ?? "");
  if ((PERIODOS_RAPIDOS as string[]).includes(p)) return janelaRapida(p as PeriodoRapido, hoje);
  const comp = typeof sp.comp === "string" && /^\d{4}-\d{2}$/.test(sp.comp) ? sp.comp : null;
  if (comp && comp <= competenciaDe(hoje)) return janelaDoMes(comp, hoje);
  if (podePersonalizar && ehData(sp.de) && ehData(sp.ate) && sp.de <= sp.ate && sp.de <= hoje) {
    // no máximo 1 ano por vez
    const limite = `${Number(sp.de.slice(0, 4)) + 1}${sp.de.slice(4)}`;
    return janelaPersonalizada(sp.de, sp.ate < limite ? sp.ate : limite, hoje);
  }
  return janelaRapida("mes", hoje);
}

async function ConteudoPainel(props: PageProps<"/">) {
  const s = await exigirSessao();
  const sp = await props.searchParams;
  const hoje = hojeNoFuso();
  const gestao = s.vêTudo || s.lidera.length > 0;
  const janela = lerPeriodo(sp, hoje, gestao);
  const db = await criarClienteServidor();

  const [sync, metricasRes] = await Promise.all([
    ultimaSync(db),
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo").eq("ativo", true),
  ]);
  const metricas = (metricasRes.data ?? []) as Metrica[];
  const minhaEquipe = s.equipes.find((e) => e.funcao === "membro");

  let equipesGestao: { id: string; nome: string }[] = [];
  if (s.vêTudo) {
    const { data } = await db.from("equipes").select("id, nome").eq("ativo", true).order("nome");
    equipesGestao = data ?? [];
  } else {
    equipesGestao = s.equipes.filter((e) => e.funcao === "lider").map((e) => ({ id: e.equipe_id, nome: e.nome }));
  }
  const equipeSel = equipesGestao.find((e) => e.id === sp.equipe) ?? equipesGestao[0];
  const categoria: Categoria = sp.cat === "sus" ? "sus" : "particular";
  const manter = { equipe: typeof sp.equipe === "string" ? sp.equipe : undefined, cat: categoria === "sus" ? "sus" : undefined };
  // ao trocar período/equipe/categoria os blocos mostram o esqueleto na hora (sem a chave, a tela antiga ficaria parada)
  const chaveVisao = `${janela.inicio}|${janela.fim}|${categoria}|${equipeSel?.id ?? ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Olá, {s.colaborador.nome.split(" ")[0]}!</h2>
          <p className="text-sm text-muted-foreground">
            Números do Klingo, por quem marcou cada consulta. Toque no <span className="font-medium">?</span> de qualquer número ou veja{" "}
            <Link href="/como-e-contado" className="font-medium text-primary underline-offset-4 hover:underline">
              como cada número é contado
            </Link>
            .
          </p>
        </div>
        <StatusSync sync={sync} />
      </div>

      {(minhaEquipe || equipeSel) && (
        <ConviteRetrospectiva
          mes={nomeMes(competenciaAnterior(competenciaDe(hoje)))}
          mesAtual={nomeMes(competenciaDe(hoje))}
          chave={`trackco:retro:${competenciaAnterior(competenciaDe(hoje))}:${s.colaborador.id}`}
          equipe={!minhaEquipe}
          abrir={sp.retro === "1"}
        />
      )}

      <SeletorPeriodo janela={janela} manter={manter} mesAtual={competenciaDe(hoje)} personalizado={gestao} />

      {sp.erro === "restrito" && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Área restrita</AlertTitle>
          <AlertDescription>Essa seção é só para administradores ou líderes.</AlertDescription>
        </Alert>
      )}

      {minhaEquipe && (
        <Suspense key={`meu|${chaveVisao}`} fallback={<CarregandoPagina variante="painel" titulo="Seu desempenho" />}>
          <BlocoMeu db={db} s={s} equipeId={minhaEquipe.equipe_id} janela={janela} hoje={hoje} metricas={metricas} />
        </Suspense>
      )}

      {equipeSel && (
        <Suspense key={`equipe|${chaveVisao}`} fallback={<CarregandoPagina variante="tabela" titulo="Equipe" />}>
          <BlocoEquipe
            db={db}
            s={s}
            equipes={equipesGestao}
            equipe={equipeSel}
            janela={janela}
            hoje={hoje}
            metricas={metricas}
            categoria={categoria}
          />
        </Suspense>
      )}

      {!minhaEquipe && !equipeSel && (
        <Vazio icone={BarChart3} titulo="Nada para mostrar ainda" texto="Você ainda não faz parte de nenhuma equipe. Fale com o administrador." />
      )}
    </div>
  );
}

