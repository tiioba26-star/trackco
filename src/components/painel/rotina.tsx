import { CalendarCheck, PartyPopper, Trophy } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";
import { ListaConfirmar } from "@/components/painel/lista-confirmar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { competenciaDe, nomeCompetencia } from "@/engine/datas";
import { textoDatas } from "@/engine/periodos";
import type { Metrica } from "@/engine/tipos";
import type { Sessao } from "@/lib/auth";
import { consultasParaConfirmar, recordesDe } from "@/lib/dados/rotina";
import { fmtPct, fmtValor } from "@/lib/formato";
import type { Db } from "@/lib/supabase/tipos";

// Cartões do dia a dia da atendente. Não dependem do período escolhido no topo.

export async function CartaoConfirmar({ db, s, hoje }: { db: Db; s: Sessao; hoje: string }) {
  const lista = await consultasParaConfirmar(db, s, hoje);
  if (!lista) return null;
  const quando = textoDatas(lista.dia, lista.dia);
  return (
    <Card data-tour="confirmar">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <CalendarCheck className="size-4 text-primary" />
          {lista.ehAmanha ? `Confirmar as consultas de amanhã (${quando})` : `Confirmar as próximas consultas (${quando})`}
          <Dica id="pn.confirmar" />
        </CardTitle>
        <CardDescription>
          Pacientes que você marcou para esse dia. Ligar na véspera é o que mais evita falta: marque aqui quem confirmou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lista.pacientes.length ? (
          <ListaConfirmar pacientes={lista.pacientes} podeMarcar={lista.podeMarcar} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma consulta sua marcada para os próximos 7 dias.</p>
        )}
      </CardContent>
    </Card>
  );
}

export async function CartaoRecordes({ db, s, metricas, hoje }: { db: Db; s: Sessao; metricas: Metrica[]; hoje: string }) {
  const r = await recordesDe(db, s, metricas, hoje);
  if (!r || (!r.melhorDia && !r.melhorMes)) return null;
  const mesAtual = competenciaDe(hoje);
  const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

  // uma frase só, a mais motivadora: bateu o recorde > está perto do recorde do mês > do dia
  let frase: { texto: string; festa: boolean } | null = null;
  if (r.melhorMes && r.melhorMes.comp === mesAtual && r.mesAtual > 0) frase = { texto: "Este mês já é o seu melhor mês dos últimos 12!", festa: true };
  else if (r.melhorDia && r.melhorDia.dia === hoje && r.hoje > 0) frase = { texto: "Hoje é o seu melhor dia dos últimos 12 meses!", festa: true };
  else if (r.melhorMes && r.mesAtual >= r.melhorMes.valor * 0.7)
    frase = {
      texto: `Neste mês: ${fmtValor(r.mesAtual)}. Faltam ${fmtValor(r.melhorMes.valor - r.mesAtual + 1)} para passar o seu melhor mês.`,
      festa: false,
    };
  else if (r.melhorDia && r.hoje > 0 && r.hoje >= r.melhorDia.valor * 0.6)
    frase = { texto: `Hoje: ${fmtValor(r.hoje)}. Faltam ${fmtValor(r.melhorDia.valor - r.hoje + 1)} para o seu novo recorde do dia.`, festa: false };

  const itens = [
    r.melhorDia && { t: "Melhor dia", v: fmtValor(r.melhorDia.valor), q: maiuscula(textoDatas(r.melhorDia.dia, r.melhorDia.dia, hoje.slice(0, 4))), sub: "agendamentos válidos" },
    r.melhorMes && { t: "Melhor mês", v: fmtValor(r.melhorMes.valor), q: maiuscula(nomeCompetencia(r.melhorMes.comp)), sub: "agendamentos válidos" },
    r.melhorTaxa && { t: "Melhor comparecimento", v: fmtPct(r.melhorTaxa.valor), q: maiuscula(nomeCompetencia(r.melhorTaxa.comp)), sub: "das consultas marcadas" },
  ].filter(Boolean) as { t: string; v: string; q: string; sub: string }[];

  return (
    <Card data-tour="recordes">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Trophy className="size-4 text-amber-500" />
          Seus recordes
          <Dica id="pn.recordes" />
        </CardTitle>
        <CardDescription>Você contra você mesmo, nos últimos 12 meses. Só conta paciente válido (remarcação não bate recorde).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {frase && (
          <p
            className={
              frase.festa
                ? "flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
                : "rounded-lg bg-primary-soft px-3 py-2 text-sm"
            }
          >
            {frase.festa && <PartyPopper className="size-4 shrink-0 motion-safe:animate-bounce" />}
            {frase.texto}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {itens.map((i) => (
            <div key={i.t} className="rounded-lg border px-2 py-2 text-center">
              <div className="text-[11px] text-muted-foreground">{i.t}</div>
              <div className="text-xl font-semibold tabular-nums">{i.v}</div>
              <div className="text-[11px] text-muted-foreground">{i.q}</div>
              <div className="hidden text-[10px] text-muted-foreground sm:block">{i.sub}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
