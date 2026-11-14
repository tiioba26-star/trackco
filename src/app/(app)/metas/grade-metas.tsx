"use client";

import { Copy, Lightbulb, Save, Wand2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { avisarNavegacao } from "@/components/app/indicador-navegacao";
import { useState } from "react";
import { toast } from "sonner";
import { Dica } from "@/components/ajuda/dica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { HistoricoMeta, MapaHistorico } from "@/lib/dados/sugestoes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metasDoMesAnterior, salvarMetas, type LinhaMeta } from "./actions";

interface Props {
  equipeId: string;
  competencia: string;
  metricas: { id: string; nome: string; unidade: string }[];
  pessoas: { id: string; nome: string; funcao: string }[];
  iniciais: LinhaMeta[];
  historico: MapaHistorico;
  nMeses: number;
}

function fmt(n: number | null, unidade: string) {
  if (n === null) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 0 }) + (unidade === "%" ? "%" : "");
}

/** Sugestão = referência histórica × (1 + crescimento). Contagens arredondam para cima. */
function sugerir(h: HistoricoMeta | undefined, crescimento: number, unidade: string): number | null {
  if (!h || h.referencia === null) return null;
  const v = h.referencia * (1 + crescimento / 100);
  return unidade === "%" ? Math.round(Math.min(100, v) * 10) / 10 : Math.ceil(v);
}

function DicaHistorico({ h, unidade, nMeses }: { h: HistoricoMeta | undefined; unidade: string; nMeses: number }) {
  if (!h || h.base === "sem_dados") return <div className="mt-1 text-[11px] text-muted-foreground">sem histórico</div>;
  if (h.base === "media_equipe")
    return (
      <div className="mt-1 text-[11px] text-muted-foreground" title="Sem atividade nos últimos meses: usa a média por pessoa da equipe">
        novo · média equipe {fmt(h.referencia, unidade)}
      </div>
    );
  return (
    <div className="mt-1 text-[11px] text-muted-foreground" title={`Média de ${h.meses} mês(es) com atividade, dentre os últimos ${nMeses}`}>
      média {fmt(h.media, unidade)} · último {fmt(h.ultimo, unidade)}
    </div>
  );
}

const chave = (metrica: string, colab: string | null) => `${metrica}|${colab ?? "equipe"}`;

export function GradeMetas({ equipeId, competencia, metricas, pessoas, iniciais, historico, nMeses }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [crescimento, setCrescimento] = useState(5);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(iniciais.map((l) => [chave(l.metrica_id, l.colaborador_id), l.valor === null ? "" : String(l.valor)])),
  );
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setValores((s) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true);
    const linhas: LinhaMeta[] = [];
    for (const m of metricas) {
      for (const p of [...pessoas.map((x) => x.id), null]) {
        const v = valores[chave(m.id, p)];
        if (v !== undefined && v.trim() !== "") linhas.push({ metrica_id: m.id, colaborador_id: p, valor: Number(v.replace(",", ".")) });
      }
    }
    const r = await salvarMetas(equipeId, competencia, metricas.map((m) => m.id), linhas);
    setSalvando(false);
    if (r.ok) {
      toast.success("Metas salvas e painel recalculado.");
      router.refresh();
    } else toast.error(r.erro);
  }

  function preencherSugestoes() {
    const preenchidos = Object.values(valores).some((v) => v.trim() !== "");
    if (preenchidos && !confirm("Substituir os valores da grade pelas sugestões? (nada é salvo até clicar em Salvar)")) return;
    const novos: Record<string, string> = {};
    for (const m of metricas) {
      for (const p of pessoas.filter((x) => x.funcao === "membro")) {
        const v = sugerir(historico[chave(m.id, p.id)], crescimento, m.unidade);
        if (v !== null) novos[chave(m.id, p.id)] = String(v);
      }
      // meta da equipe: vazia = soma das individuais (o cálculo já faz isso), então não preenche
    }
    setValores((s) => ({ ...s, ...novos }));
    toast.success("Sugestões preenchidas. Revise e clique em Salvar metas.");
  }

  function trocarMeses(n: string) {
    const p = new URLSearchParams(params.toString());
    p.set("meses", n);
    avisarNavegacao();
    router.push(`${pathname}?${p.toString()}`);
  }

  async function copiar() {
    const r = await metasDoMesAnterior(equipeId, competencia, metricas.map((m) => m.id));
    if (!r.ok) return toast.error(r.erro);
    if (!r.linhas?.length) return toast.info("O mês anterior não tem metas para copiar.");
    setValores(Object.fromEntries(r.linhas.map((l) => [chave(l.metrica_id, l.colaborador_id), String(l.valor)])));
    toast.success("Metas do mês anterior copiadas. Revise e salve.");
  }

  function aplicarATodos(metricaId: string) {
    const v = prompt("Valor da meta para todos os membros:");
    if (v === null) return;
    setValores((s) => {
      const n = { ...s };
      for (const p of pessoas.filter((x) => x.funcao === "membro")) n[chave(metricaId, p.id)] = v;
      return n;
    });
  }

  const somaMembros = (metricaId: string) =>
    pessoas
      .filter((p) => p.funcao === "membro")
      .reduce((s, p) => s + (Number((valores[chave(metricaId, p.id)] ?? "").replace(",", ".")) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-primary-soft/40 p-3" data-tour="metas-sugestao">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="size-4 text-primary" /> Sugestão pelo histórico
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">Base <Dica id="metas.base" /></div>
          <NativeSelect value={String(nMeses)} onChange={(e) => trocarMeses(e.target.value)} className="w-40">
            <option value="3">média de 3 meses</option>
            <option value="6">média de 6 meses</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">Crescimento <Dica id="metas.crescimento" /></div>
          <NativeSelect value={String(crescimento)} onChange={(e) => setCrescimento(Number(e.target.value))} className="w-32">
            {[0, 5, 10, 15, 20, 30].map((g) => (
              <option key={g} value={g}>
                {g === 0 ? "manter média" : `+${g}%`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={preencherSugestoes}>
          <Wand2 /> Preencher com sugestão
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copiar} data-tour="metas-copiar">
          <Copy /> Copiar do mês anterior
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          <Save /> {salvando ? "Salvando…" : "Salvar metas"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card" data-tour="metas-grade">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Pessoa</TableHead>
              {metricas.map((m) => (
                <TableHead key={m.id} className="min-w-40">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {m.nome} <span className="text-xs font-normal text-muted-foreground">({m.unidade})</span>
                    </span>
                    <Button variant="ghost" size="icon-xs" aria-label={`Aplicar a todos: ${m.nome}`} onClick={() => aplicarATodos(m.id)}>
                      <Wand2 />
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pessoas.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.funcao === "lider" ? "líder" : "membro"}</div>
                </TableCell>
                {metricas.map((m) => (
                  <TableCell key={m.id}>
                    <Input
                      inputMode="decimal"
                      className="w-32 tabular-nums"
                      value={valores[chave(m.id, p.id)] ?? ""}
                      placeholder={p.funcao === "membro" ? String(sugerir(historico[chave(m.id, p.id)], crescimento, m.unidade) ?? "—") : "—"}
                      onChange={(e) => set(chave(m.id, p.id), e.target.value)}
                    />
                    {p.funcao === "membro" && <DicaHistorico h={historico[chave(m.id, p.id)]} unidade={m.unidade} nMeses={nMeses} />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell>
                <div className="flex items-center gap-1 font-medium">Meta da equipe <Dica id="metas.equipe" /></div>
                <div className="text-xs text-muted-foreground">usada nos indicadores de escopo equipe (líder)</div>
              </TableCell>
              {metricas.map((m) => (
                <TableCell key={m.id}>
                  <Input
                    inputMode="decimal"
                    className="w-32 tabular-nums"
                    value={valores[chave(m.id, null)] ?? ""}
                    placeholder={m.unidade === "%" ? "média" : `soma: ${somaMembros(m.id) || "—"}`}
                    onChange={(e) => set(chave(m.id, null), e.target.value)}
                  />
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    histórico da equipe {fmt(historico[chave(m.id, null)]?.referencia ?? null, m.unidade)}
                  </div>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Deixe a meta da equipe vazia para usar automaticamente a soma das metas individuais (ou a média, para %). Metas são
        reduzidas proporcionalmente às ausências lançadas quando o indicador estiver com &quot;meta proporcional&quot; ligada.
      </p>
    </div>
  );
}
