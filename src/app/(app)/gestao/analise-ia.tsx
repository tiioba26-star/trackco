import Link from "next/link";
import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataBR } from "@/engine/datas";
import {
  COMPARACOES_IA,
  NOME_RECORTE,
  PERIODOS_IA,
  RECORTES_IA,
  SECAO_DA_ABA,
  type ComparacaoIA,
  type PeriodoIA,
  type RecorteIA,
} from "@/lib/analises/arquivos";
import { NOME_ESFORCO, analiseDaSecao, nomeDoModelo, type Analise } from "@/lib/dados/analises-ia";
import { filtrosParaUrl, type FiltrosGestao } from "@/lib/dados/gestao";
import { fmtDataHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { TextoIA } from "./markdown";

const AJUDA =
  "Escrita todo dia às 5h pela IA (Claude) a partir dos mesmos números desta tela, já calculados pelo Trackco: variações, meses seguidos em alta ou queda, quartis e projeções. Ela não inventa número; se um dado faltar, diz que falta. Há uma análise para cada período pronto, comparação e recorte (Particular ou clínica toda).";

function Aviso({ icone: Icone = Info, children }: { icone?: typeof Info; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Icone className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Rodapé com quando foi feita, com quais dados e por qual modelo. */
export function OrigemAnalise({ a }: { a: Analise }) {
  const esforco = NOME_ESFORCO[a.meta.esforco] ?? a.meta.esforco;
  return (
    <span>
      Feita em {fmtDataHora(a.meta.gerado_em)} com dados até {formatarDataBR(a.meta.dados_ate)} · {nomeDoModelo(a.meta.modelo)}
      {esforco ? ` (esforço ${esforco})` : ""}
    </span>
  );
}

/** Cartão "Análise comentada pela IA" no fim de cada aba da Gestão. */
export async function AnaliseIA({ f, aba, ia }: { f: FiltrosGestao; aba: string; ia?: string }) {
  const secao = SECAO_DA_ABA[aba];
  if (!secao) return null;
  const periodo = f.janela.periodo as PeriodoIA;
  const comparacao = f.comparar as ComparacaoIA;
  const recorte: RecorteIA = (RECORTES_IA as readonly string[]).includes(ia ?? "")
    ? (ia as RecorteIA)
    : f.operadora === "Particular"
      ? "particular"
      : "todas";
  const temPeriodo = (PERIODOS_IA as readonly string[]).includes(periodo);
  const temComparacao = (COMPARACOES_IA as readonly string[]).includes(comparacao);
  const a = temPeriodo && temComparacao ? await analiseDaSecao(secao, periodo, comparacao, recorte) : null;

  const outrosFiltros = [
    f.equipe && "equipe",
    f.pessoa && "pessoa",
    f.categoria && "categoria",
    f.medico && "médico",
    f.procedimento && "procedimento",
    f.cortesia !== "incluir" && "cortesias",
    f.agenda !== "todas" && "tipo de agenda",
  ].filter(Boolean);
  // a análise de "este mês" é de ontem para trás: no dia 1 ainda não existe a do mês novo
  const deOutroPeriodo =
    a && (periodo === "mes" || periodo === "ano" ? a.meta.janela_inicio !== f.janela.inicio : a.meta.janela_inicio !== f.janela.inicio || a.meta.janela_fim !== f.janela.fim);

  return (
    <Card className="border-primary/30" data-tour="gestao-ia">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" /> Análise comentada pela IA <Dica texto={AJUDA} />
          </CardTitle>
          <CardDescription>
            {a ? <OrigemAnalise a={a} /> : "Análise automática dos números desta aba."}
          </CardDescription>
        </div>
        {temPeriodo && temComparacao && (
          <div className="inline-flex rounded-lg border bg-card p-1">
            {RECORTES_IA.map((r) => (
              <Link
                key={r}
                href={`/gestao?${filtrosParaUrl(f, { aba, ia: r })}`}
                scroll={false}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  recorte === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {r === "particular" ? "Particular" : "Clínica toda"}
              </Link>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!temPeriodo ? (
          <Aviso>A análise da IA é feita para os períodos prontos: este mês, mês passado, últimos 3 meses, este ano e últimos 12 meses.</Aviso>
        ) : !temComparacao ? (
          <Aviso>A análise da IA sempre compara com outro período. Escolha &quot;Período anterior&quot; ou &quot;Mesmo período do ano anterior&quot;.</Aviso>
        ) : !a || (periodo === "mes" && deOutroPeriodo) ? (
          <Aviso>
            {periodo === "mes" && a
              ? "O mês começou hoje: a primeira análise dele sai amanhã às 5h, com os dados de hoje."
              : "Esta análise ainda não foi escrita. Ela sai na próxima rodada (todo dia às 5h)."}
          </Aviso>
        ) : (
          <>
            {deOutroPeriodo && (
              <Aviso icone={AlertTriangle}>
                Esta análise é de {a.meta.janela_datas || `${a.meta.janela_inicio} a ${a.meta.janela_fim}`}; a tela mostra {f.janela.datas}.
              </Aviso>
            )}
            {(outrosFiltros.length > 0 || (f.operadora !== "Particular" && f.operadora !== "todas" && !ia)) && (
              <Aviso>
                A análise é sempre da clínica toda ({NOME_RECORTE[recorte].toLowerCase()}), sem os filtros de{" "}
                {[...outrosFiltros, f.operadora !== "Particular" && f.operadora !== "todas" ? "operadora" : null].filter(Boolean).join(", ")} que você
                aplicou.
              </Aviso>
            )}
            <TextoIA texto={a.corpo} />
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Os números da análise são de quando ela foi feita. Os quadros acima mostram os de agora.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
