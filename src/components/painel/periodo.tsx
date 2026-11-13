import { CalendarDays, Medal, TrendingDown, TrendingUp } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Dica } from "@/components/ajuda/dica";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ChaveDica } from "@/components/ajuda/dicas";
import { competenciaAnterior, nomeCompetencia } from "@/engine/datas";
import type { JanelaPeriodo, PeriodoRapido } from "@/engine/periodos";
import type { Producao } from "@/engine/producao";
import { fmtPct, fmtValor } from "@/lib/formato";
import { cn } from "@/lib/utils";

const ABAS: { p: PeriodoRapido; rotulo: string }[] = [
  { p: "hoje", rotulo: "Hoje" },
  { p: "semana", rotulo: "Últimos 7 dias" },
  { p: "mes", rotulo: "Mês" },
  { p: "mes_passado", rotulo: "Mês passado" },
];

function qs(base: Record<string, string | undefined>, extra: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) p.set(k, v);
  return `/?${p.toString()}`;
}

/**
 * Escolha do período + a frase "Mostrando: ...". Sempre deixa explícito de quando são os números.
 * `manter` = parâmetros que continuam na troca (equipe, categoria).
 */
export function SeletorPeriodo({
  janela,
  manter,
  mesAtual,
  personalizado,
}: {
  janela: JanelaPeriodo;
  manter: Record<string, string | undefined>;
  mesAtual: string;
  personalizado: boolean;
}) {
  const meses = Array.from({ length: 24 }, (_, i) => competenciaAnterior(mesAtual, i + 2));
  return (
    <div className="space-y-3" data-tour="periodo">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-card p-1" role="tablist" aria-label="Período">
          {ABAS.map((a) => (
            <Link
              key={a.p}
              href={qs(manter, { p: a.p })}
              role="tab"
              aria-selected={janela.periodo === a.p}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                janela.periodo === a.p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {a.rotulo}
            </Link>
          ))}
        </div>
        <Form action="" className="flex items-center gap-1.5">
          {Object.entries(manter).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <NativeSelect name="comp" defaultValue="" aria-label="Outro mês" className="h-9 w-40">
            <option value="" disabled>
              Outro mês…
            </option>
            {meses.map((m) => (
              <option key={m} value={m} className="capitalize">
                {nomeCompetencia(m)}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" variant="outline">
            Ver
          </Button>
        </Form>
        {personalizado && (
          <Form action="" className="flex flex-wrap items-center gap-1.5">
            {Object.entries(manter).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <Input type="date" name="de" aria-label="De" className="h-9 w-36" defaultValue={janela.periodo === "personalizado" ? janela.inicio : ""} required />
            <span className="text-sm text-muted-foreground">a</span>
            <Input type="date" name="ate" aria-label="Até" className="h-9 w-36" defaultValue={janela.periodo === "personalizado" ? janela.fim : ""} required />
            <Button type="submit" size="sm" variant="outline">
              Aplicar
            </Button>
          </Form>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <CalendarDays className="size-4 text-primary" />
        <span className="text-muted-foreground">Mostrando:</span>
        <b>{janela.nome}</b>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium tabular-nums">{janela.datas}</span>
        {janela.emAndamento && <span className="text-muted-foreground">· parcial, ainda vai mudar</span>}
        <Dica id="pn.periodo" />
      </div>
    </div>
  );
}

/** Variação contra o mesmo ponto do período anterior. */
export function Variacao({ atual, anterior, nome, unidade = "un" }: { atual: number | null; anterior: number | null; nome: string; unidade?: string }) {
  if (atual === null || anterior === null) return null;
  if (anterior === 0 && atual === 0) return <span className="text-xs text-muted-foreground">igual a {nome}</span>;
  const diff = unidade === "%" ? atual - anterior : anterior ? ((atual - anterior) / anterior) * 100 : 100;
  const sobe = diff >= 0;
  const Icone = sobe ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", sobe ? "text-up" : "text-down")} title={`Comparado com ${nome}: ${fmtValor(anterior, unidade)}`}>
      <Icone className="size-3.5" />
      {sobe ? "+" : "−"}
      {unidade === "%" ? `${fmtValor(Math.abs(diff), "un")} p.p.` : `${fmtValor(Math.abs(Math.round(diff)), "un")}%`}
      <span className="text-muted-foreground">vs {nome}</span>
    </span>
  );
}

/** Cartão de número: título claro, o número, o que ele conta (com datas) e a comparação. */
export function CartaoKpi({
  titulo,
  valor,
  unidade = "un",
  descricao,
  dica,
  variacao,
  rodape,
  tour,
  destaque,
}: {
  titulo: string;
  valor: number | null;
  unidade?: string;
  descricao: React.ReactNode;
  dica: ChaveDica;
  variacao?: React.ReactNode;
  rodape?: React.ReactNode;
  tour?: string;
  destaque?: boolean;
}) {
  return (
    <Card className={cn("gap-2", destaque && "ring-1 ring-primary/30")} data-tour={tour}>
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {titulo} <Dica id={dica} />
        </div>
        <div className="font-heading text-3xl font-semibold tabular-nums">{valor === null ? "—" : fmtValor(valor, unidade)}</div>
        <div className="text-xs leading-snug text-muted-foreground">{descricao}</div>
        {variacao && <div className="mt-auto pt-1">{variacao}</div>}
        {rodape && <div className="border-t pt-2 text-xs text-muted-foreground">{rodape}</div>}
      </CardContent>
    </Card>
  );
}

const DESTINOS = [
  { k: "compareceram", rotulo: "Compareceram", cor: "var(--up)", dica: "pn.compareceram" },
  { k: "faltaram", rotulo: "Faltaram", cor: "var(--down)", dica: "pn.faltaram" },
  { k: "desmarcaram", rotulo: "Desmarcaram e não remarcaram", cor: "var(--warn)", dica: "pn.desmarcaram" },
  { k: "aguardando", rotulo: "Ainda vão acontecer", cor: "var(--chart-1)", dica: "pn.aguardando" },
] as const;

/** "Para onde foram as consultas": uma barra empilhada com o desfecho de cada consulta marcada para o período. */
export function BarraDestino({ p }: { p: Producao }) {
  const total = p.marcadasPara;
  if (!total) return <p className="text-sm text-muted-foreground">Nenhuma consulta marcada para este período.</p>;
  return (
    <div className="space-y-3">
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Desfecho das consultas marcadas">
        {DESTINOS.map((d) => {
          const v = p[d.k];
          return v ? (
            <div
              key={d.k}
              className="h-full border-r-2 border-card last:border-r-0"
              style={{ width: `${(v / total) * 100}%`, background: d.cor, opacity: d.k === "aguardando" ? 0.45 : 1 }}
              title={`${d.rotulo}: ${v}`}
            />
          ) : null;
        })}
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {DESTINOS.map((d) => (
          <li key={d.k} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.cor, opacity: d.k === "aguardando" ? 0.45 : 1 }} />
            <span className="flex-1">{d.rotulo}</span>
            <b className="tabular-nums">{fmtValor(p[d.k])}</b>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{fmtPct((p[d.k] / total) * 100)}</span>
          </li>
        ))}
      </ul>
      {p.remarcadasPara > 0 && (
        <p className="text-xs text-muted-foreground">
          Fora da conta: {fmtValor(p.remarcadasPara)} consulta(s) deste período foram remarcadas para outra data.
        </p>
      )}
    </div>
  );
}

/**
 * Posição bem discreta: pódio (1º ouro com brilho, 2º prata, 3º bronze) ou medalha de menção honrosa.
 * Fica no cantinho do cabeçalho; o detalhe aparece só ao passar o mouse / tocar.
 */
export function IconePosicao({ posicao, de, periodo }: { posicao: number; de: number; periodo: string }) {
  const podio = posicao <= 3;
  const cor = posicao === 1 ? "#e0a800" : posicao === 2 ? "#9aa5b1" : posicao === 3 ? "#b8732f" : "var(--muted-foreground)";
  const texto = podio
    ? `${posicao}º lugar em agendamentos (${periodo}) entre ${de} pessoas${posicao === 1 ? " — você está liderando! 🎉" : ""}`
    : `Menção honrosa: ${posicao}º de ${de} em agendamentos (${periodo}). Cada marcação te aproxima do pódio!`;
  return (
    <span className="group relative inline-flex" title={texto} aria-label={texto} data-tour="posicao">
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full border bg-card text-[11px] font-bold tabular-nums",
          posicao === 1 && "animate-[pulse_2.4s_ease-in-out_infinite] shadow-[0_0_10px_rgba(224,168,0,0.45)] motion-reduce:animate-none",
        )}
        style={{ borderColor: cor, color: cor }}
      >
        {podio ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M9 9h6v12H9zM2 14h6v7H2zM16 12h6v9h-6z" opacity={0.9} />
          </svg>
        ) : (
          <Medal className="size-3.5" />
        )}
      </span>
      {podio && (
        <span className="absolute -top-1 -right-1 rounded-full bg-card px-0.5 text-[9px] leading-none font-black" style={{ color: cor }}>
          {posicao}º
        </span>
      )}
    </span>
  );
}

/** Ritmo da meta do mês: onde está, onde deveria estar hoje, quanto falta por dia. */
export function CartaoRitmo({
  titulo,
  realizado,
  meta,
  esperadoHoje,
  porDia,
  diasRestantes,
  nivel,
  emAndamento,
}: {
  titulo: string;
  realizado: number;
  meta: number;
  esperadoHoje: number | null;
  porDia: number | null;
  diasRestantes: number;
  nivel?: React.ReactNode;
  emAndamento: boolean;
}) {
  const pct = (realizado / meta) * 100;
  const escala = Math.max(meta, realizado) * 1.05;
  const status =
    realizado >= meta
      ? { t: "Meta batida 🎉", c: "text-up" }
      : esperadoHoje === null || !emAndamento
        ? { t: `${fmtPct(pct)} da meta`, c: "text-foreground" }
        : realizado >= esperadoHoje
          ? { t: "No ritmo ou à frente ✅", c: "text-up" }
          : realizado >= esperadoHoje * 0.85
            ? { t: "Um pouco atrás do ritmo", c: "text-warn" }
            : { t: "Atrás do ritmo: dá para recuperar", c: "text-down" };
  return (
    <Card data-tour="ritmo">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">{titulo}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl font-semibold tabular-nums">{fmtValor(realizado)}</span>
              <span className="text-muted-foreground">de {fmtValor(meta)} na meta do mês</span>
            </div>
          </div>
          <div className={cn("text-base font-semibold", status.c)}>{status.t}</div>
        </div>
        <div className="relative pt-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${(realizado / escala) * 100}%` }} />
          </div>
          {esperadoHoje !== null && emAndamento && realizado < meta && (
            <div className="absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(esperadoHoje / escala) * 100}%` }}>
              <span className="text-[10px] whitespace-nowrap text-muted-foreground">hoje: ~{fmtValor(Math.round(esperadoHoje))}</span>
              <span className="mt-0.5 w-0.5 flex-1 bg-foreground/60" />
            </div>
          )}
          <div className="absolute top-5 bottom-0 w-px bg-foreground/30" style={{ left: `${(meta / escala) * 100}%` }} aria-hidden />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {realizado < meta ? (
            <>
              <span>
                Faltam <b className="text-foreground">{fmtValor(meta - realizado)}</b>
              </span>
              {emAndamento && porDia !== null && (
                <span>
                  ≈ <b className="text-foreground">{fmtValor(Math.ceil(porDia))}</b> por dia útil nos {diasRestantes} dia(s) que restam
                </span>
              )}
            </>
          ) : (
            <span>Passou da meta em {fmtValor(realizado - meta)}.</span>
          )}
          {nivel}
        </div>
      </CardContent>
    </Card>
  );
}
