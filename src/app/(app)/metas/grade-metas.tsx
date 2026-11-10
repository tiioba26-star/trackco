"use client";

import { Copy, Save, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metasDoMesAnterior, salvarMetas, type LinhaMeta } from "./actions";

interface Props {
  equipeId: string;
  competencia: string;
  metricas: { id: string; nome: string; unidade: string }[];
  pessoas: { id: string; nome: string; funcao: string }[];
  iniciais: LinhaMeta[];
}

const chave = (metrica: string, colab: string | null) => `${metrica}|${colab ?? "equipe"}`;

export function GradeMetas({ equipeId, competencia, metricas, pessoas, iniciais }: Props) {
  const router = useRouter();
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
                      placeholder="—"
                      onChange={(e) => set(chave(m.id, p.id), e.target.value)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell>
                <div className="font-medium">Meta da equipe</div>
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
