import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataBR } from "@/engine/datas";
import { analiseGeral, nomeDoModelo, statusDasAnalises } from "@/lib/dados/analises-ia";
import { fmtDataHora, fmtNum } from "@/lib/formato";
import { OrigemAnalise } from "./analise-ia";
import { TextoIA } from "./markdown";

/** Aba "Análise geral (IA)": a leitura completa da clínica + como foi a última rodada. */
export async function AbaAnaliseGeral() {
  const [a, st] = await Promise.all([analiseGeral(), statusDasAnalises()]);
  const tokens = st ? st.tokens.entrada + st.tokens.cache + st.tokens.saida : 0;
  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" /> Análise geral da clínica{" "}
            <Dica texto="Escrita todo dia às 5h a partir de todos os relatórios do Trackco: Gestão (faturamento, marcações, equipes, quem marca para quem, perdas e operadoras), desempenho de cada pessoa (notas, níveis e metas), contestações, fechamentos e qualidade dos dados. Cada conclusão traz os números que a sustentam." />
          </CardTitle>
          <CardDescription>{a ? <OrigemAnalise a={a} /> : "A primeira análise geral sai na próxima rodada (todo dia às 5h)."}</CardDescription>
        </CardHeader>
        {a && (
          <CardContent>
            <TextoIA texto={a.corpo} />
          </CardContent>
        )}
      </Card>

      {st && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              Última rodada <Dica texto="O que a rotina das 5h fez: quantas análises escreveu, quantas não mudaram (números iguais aos da véspera), o que falhou e quanto gastou. O custo é o equivalente pelo preço de tabela da API do Claude, só como régua: na assinatura não é cobrado assim. O que sai pelo Gemini usa a cota do Google AI Pro e entra só nos tokens." />
            </CardTitle>
            <CardDescription>
              {fmtDataHora(st.gerado_em)} · dados até {formatarDataBR(st.dados_ate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="grid gap-2 sm:grid-cols-3">
              <li className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Escritas</div>
                <div className="text-xl font-semibold tabular-nums">{fmtNum(st.feitas)}</div>
              </li>
              <li className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Sem mudança (mantidas)</div>
                <div className="text-xl font-semibold tabular-nums">{fmtNum(st.sem_mudanca)}</div>
              </li>
              <li className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tokens · equivalente API</div>
                <div className="text-xl font-semibold tabular-nums">
                  {fmtNum(tokens / 1000)} mil · US$ {st.custo_equivalente_usd.toFixed(2)}
                </div>
              </li>
            </ul>
            {Object.entries(st.por_modelo).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {Object.entries(st.por_modelo)
                  .map(
                    ([m, v]) =>
                      `${nomeDoModelo(m)}: ${v.analises} análise(s), ${m.startsWith("gemini") ? "cota do Google AI Pro" : `US$ ${v.custo_equivalente_usd.toFixed(2)}`}`,
                  )
                  .join(" · ")}
              </p>
            )}
            {st.falhas.length === 0 && st.pendentes.length === 0 ? (
              <p className="flex items-center gap-1.5 text-up">
                <CheckCircle2 className="size-4" /> Tudo certo na última rodada.
              </p>
            ) : (
              <div className="space-y-1.5">
                {st.limite_atingido && (
                  <p className="flex items-center gap-1.5 text-down">
                    <TriangleAlert className="size-4" /> O limite de uso da IA acabou no meio: o que faltou sai na repescagem das 13h ou amanhã.
                  </p>
                )}
                {st.falhas.length > 0 && (
                  <p className="text-muted-foreground">
                    Não saíram ({st.falhas.length}): {st.falhas.map((f) => f.arquivo.replace(/\.md$/, "")).join(", ")}. A versão anterior continua na tela.
                  </p>
                )}
                {st.pendentes.length > 0 && <p className="text-muted-foreground">Pendentes ({st.pendentes.length}): ficam para a próxima rodada.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
