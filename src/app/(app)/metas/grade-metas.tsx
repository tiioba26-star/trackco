"use client";

import { Lightbulb, Save, Wand2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConfirmar, usePedirValor, useSomenteLeitura } from "@/components/app/confirmacao";
import { avisarNavegacao } from "@/components/app/indicador-navegacao";
import { useState } from "react";
import { toast } from "sonner";
import { Dica } from "@/components/ajuda/dica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { HistoricoMeta, MapaHistorico } from "@/lib/dados/sugestoes";
import { distribuirMeta, incoerencia, participacoes, valeParaEquipe, type ModoMeta } from "@/lib/metas/distribuir";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metasDoMesAnterior, salvarMetas, type LinhaMeta } from "./actions";

interface Props {
  equipeId: string;
  competencia: string;
  metricas: { id: string; nome: string; unidade: string }[];
  pessoas: { id: string; nome: string; funcao: string }[];
  iniciais: LinhaMeta[];
  historico: MapaHistorico;
  /** parte do mês em que cada pessoa trabalha, com as ausências lançadas (1 = mês todo, 0 = ausente o mês todo) */
  fatores: Record<string, number>;
  nMeses: number;
}

function fmt(n: number | null, unidade: string) {
  if (n === null) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: unidade === "%" ? 1 : 0 }) + (unidade === "%" ? "%" : "");
}

/** Valor × (1 + crescimento). Contagens arredondam para cima; taxas ficam com 1 casa e no máximo 100%. */
function comCrescimento(valor: number, crescimento: number, unidade: string): number {
  const v = valor * (1 + crescimento / 100);
  return unidade === "%" ? Math.round(Math.min(100, v) * 10) / 10 : Math.ceil(v);
}

/** Sugestão = referência histórica × (1 + crescimento). */
function sugerir(h: HistoricoMeta | undefined, crescimento: number, unidade: string): number | null {
  if (!h || h.referencia === null) return null;
  return comCrescimento(h.referencia, crescimento, unidade);
}

function DicaHistorico({ h, unidade, nMeses }: { h: HistoricoMeta | undefined; unidade: string; nMeses: number }) {
  if (!h || h.base === "sem_dados") return <div className="mt-1 text-[11px] text-muted-foreground">sem histórico</div>;
  if (h.base === "media_equipe")
    return (
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        novo · média equipe {fmt(h.referencia, unidade)}
        <Dica texto="Sem atividade nos últimos meses: a sugestão usa a média por pessoa da equipe." />
      </div>
    );
  return (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
      média {fmt(h.media, unidade)} · último {fmt(h.ultimo, unidade)}
      <Dica texto={`Média de ${h.meses} mês(es) com atividade, dentre os últimos ${nMeses}. "Último" é o mês mais recente com atividade.`} />
    </div>
  );
}

/** Embaixo do campo: quanto da meta vale com as ausências lançadas no mês. */
function AvisoAusencia({
  fator,
  valor,
  unidade,
  derivado,
}: {
  fator: number;
  valor: number | null;
  unidade: string;
  derivado: boolean;
}) {
  if (fator >= 1) return null;
  if (fator === 0)
    return derivado ? null : (
      <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">ausente o mês todo: a meta não vale</div>
    );
  return (
    <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
      {valor !== null && unidade !== "%"
        ? `vale ${fmt(Math.round(valor * fator * 10) / 10, unidade)} (${Math.round(fator * 100)}% do mês, por ausências)`
        : `trabalha ${Math.round(fator * 100)}% do mês (ausências)`}
    </div>
  );
}

const chave = (metrica: string, colab: string | null) => `${metrica}|${colab ?? "equipe"}`;
const numero = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Como cada métrica começa: com meta da equipe salva → pela equipe; só com metas por pessoa → por pessoa. */
function modosIniciais(metricas: Props["metricas"], iniciais: LinhaMeta[], membros: Set<string>): Record<string, ModoMeta> {
  return Object.fromEntries(
    metricas.map((m) => {
      const temEquipe = iniciais.some((l) => l.metrica_id === m.id && l.colaborador_id === null && l.valor !== null);
      const temPessoa = iniciais.some((l) => l.metrica_id === m.id && l.colaborador_id && membros.has(l.colaborador_id));
      return [m.id, !temEquipe && temPessoa ? "pessoa" : "equipe"];
    }),
  );
}

export function GradeMetas({ equipeId, competencia, metricas, pessoas, iniciais, historico, fatores, nMeses }: Props) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const pedirValor = usePedirValor();
  const leitura = useSomenteLeitura();
  const pathname = usePathname();
  const params = useSearchParams();
  const [crescimento, setCrescimento] = useState(5);
  // base da sugestão: média de 3 ou 6 meses (vem da URL) ou as metas do mês anterior
  const [base, setBase] = useState<string>(String(nMeses));
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(iniciais.map((l) => [chave(l.metrica_id, l.colaborador_id), l.valor === null ? "" : String(l.valor)])),
  );
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setValores((s) => ({ ...s, [k]: v }));
  const membros = pessoas.filter((x) => x.funcao === "membro");
  const lideres = pessoas.filter((x) => x.funcao !== "membro");
  const fatorDe = (id: string) => fatores[id] ?? 1;
  const algumaAusencia = membros.some((p) => fatorDe(p.id) < 1);
  const [modo, setModo] = useState<Record<string, ModoMeta>>(() =>
    modosIniciais(metricas, iniciais, new Set(membros.map((x) => x.id))),
  );
  // o que já estava salvo e não batia (meta da equipe × soma das pessoas): avisa até salvar de novo
  const [conflitos] = useState(() =>
    metricas
      .map((m) => {
        const eq = iniciais.find((l) => l.metrica_id === m.id && l.colaborador_id === null)?.valor ?? null;
        const ps = iniciais
          .filter((l) => l.metrica_id === m.id && l.colaborador_id && membros.some((x) => x.id === l.colaborador_id))
          .map((l) => ({ valor: Number(l.valor), fator: fatorDe(l.colaborador_id!) }));
        const problema = incoerencia(eq, ps, m.unidade);
        return problema ? `${m.nome}: ${problema}` : null;
      })
      .filter((x): x is string => x !== null),
  );

  const pesos = (metricaId: string) =>
    membros.map((p) => ({ id: p.id, peso: historico[chave(metricaId, p.id)]?.referencia ?? null, fator: fatorDe(p.id) }));
  /** meta da equipe dividida entre quem trabalha no mês (modo "pela equipe") */
  const divisao = (m: Props["metricas"][number]) => {
    const total = numero(valores[chave(m.id, null)]);
    return total === null ? null : distribuirMeta(total, pesos(m.id), m.unidade);
  };
  /** o que vale para a equipe pelas metas de cada pessoa: soma (já descontadas as ausências) ou média, para % */
  const somaOuMedia = (m: Props["metricas"][number]) => {
    const vs = membros
      .map((p) => ({ valor: numero(valores[chave(m.id, p.id)]), fator: fatorDe(p.id) }))
      .filter((x): x is { valor: number; fator: number } => x.valor !== null);
    const v = valeParaEquipe(vs, m.unidade);
    return v === null || m.unidade === "%" ? v : Math.round(v);
  };

  function trocarModo(m: Props["metricas"][number], porPessoa: boolean) {
    if (porPessoa) {
      // parte da divisão atual, para só ajustar quem precisa
      const d = divisao(m);
      setValores((s) => {
        const n = { ...s };
        if (d) for (const p of membros) n[chave(m.id, p.id)] = d[p.id] === undefined ? "" : String(d[p.id]);
        delete n[chave(m.id, null)];
        return n;
      });
    } else {
      const total = somaOuMedia(m);
      setValores((s) => {
        const n = { ...s };
        if (total !== null) n[chave(m.id, null)] = String(total);
        for (const p of membros) delete n[chave(m.id, p.id)];
        return n;
      });
    }
    setModo((s) => ({ ...s, [m.id]: porPessoa ? "pessoa" : "equipe" }));
  }

  async function salvar() {
    setSalvando(true);
    const linhas: LinhaMeta[] = [];
    for (const m of metricas) {
      // líder: o que estiver digitado (os indicadores do líder usam a meta da equipe)
      for (const p of lideres) {
        const v = numero(valores[chave(m.id, p.id)]);
        if (v !== null) linhas.push({ metrica_id: m.id, colaborador_id: p.id, valor: v });
      }
      if (modo[m.id] === "pessoa") {
        for (const p of membros) {
          const v = numero(valores[chave(m.id, p.id)]);
          if (v !== null) linhas.push({ metrica_id: m.id, colaborador_id: p.id, valor: v });
        }
      } else {
        const total = numero(valores[chave(m.id, null)]);
        const d = divisao(m);
        if (total !== null && d) {
          linhas.push({ metrica_id: m.id, colaborador_id: null, valor: total });
          // quem está ausente o mês todo fica fora da divisão (sem meta)
          for (const p of membros)
            if (d[p.id] !== undefined) linhas.push({ metrica_id: m.id, colaborador_id: p.id, valor: d[p.id] });
        }
      }
    }
    const r = await salvarMetas(equipeId, competencia, metricas.map((m) => m.id), linhas);
    setSalvando(false);
    if (r.ok) {
      toast.success("Metas salvas e painel recalculado.");
      router.refresh();
    } else toast.error(r.erro);
  }

  async function preencherSugestoes() {
    const preenchidos = Object.values(valores).some((v) => v.trim() !== "");
    if (
      preenchidos &&
      !(await confirmar({
        titulo: "Substituir os valores da grade pelas sugestões?",
        texto: "Os números digitados são trocados pelas sugestões. Nada é salvo até você clicar em Salvar metas.",
        confirmar: "Substituir",
      }))
    )
      return;
    if (base === "anterior") return copiarMesAnterior();
    const novos: Record<string, string> = {};
    for (const m of metricas) {
      if (modo[m.id] === "pessoa") {
        for (const p of membros) {
          const v = sugerir(historico[chave(m.id, p.id)], crescimento, m.unidade);
          if (v !== null) novos[chave(m.id, p.id)] = String(v);
        }
      } else {
        const v = sugerir(historico[chave(m.id, null)], crescimento, m.unidade);
        if (v !== null) novos[chave(m.id, null)] = String(v);
      }
    }
    setValores((s) => ({ ...s, ...novos }));
    toast.success("Sugestões preenchidas. Revise e clique em Salvar metas.");
  }

  function trocarBase(v: string) {
    setBase(v);
    if (v === "anterior" || v === String(nMeses)) return; // o mês anterior não precisa recarregar o histórico
    const p = new URLSearchParams(params.toString());
    p.set("meses", v);
    avisarNavegacao();
    router.push(`${pathname}?${p.toString()}`);
  }

  /** Base "mês anterior": repete as metas do mês passado (com o crescimento escolhido, se houver). */
  async function copiarMesAnterior() {
    const r = await metasDoMesAnterior(equipeId, competencia, metricas.map((m) => m.id));
    if (!r.ok) return toast.error(r.erro);
    if (!r.linhas?.length) return toast.info("O mês anterior não tem metas para copiar.");
    const unidade = (id: string) => metricas.find((m) => m.id === id)?.unidade ?? "un";
    // métrica que tinha meta da equipe no mês anterior volta pela equipe (e é redividida); a que não tinha, por pessoa
    const comEquipe = new Set(r.linhas.filter((l) => l.colaborador_id === null).map((l) => l.metrica_id));
    setModo(Object.fromEntries(metricas.map((m) => [m.id, comEquipe.has(m.id) ? "equipe" : "pessoa"])));
    setValores(
      Object.fromEntries(
        r.linhas
          .filter((l) => !comEquipe.has(l.metrica_id) || !membros.some((p) => p.id === l.colaborador_id))
          .map((l) => [chave(l.metrica_id, l.colaborador_id), String(comCrescimento(Number(l.valor), crescimento, unidade(l.metrica_id)))]),
      ),
    );
    toast.success(crescimento ? `Metas do mês anterior +${crescimento}% preenchidas. Revise e salve.` : "Metas do mês anterior copiadas. Revise e salve.");
  }

  async function aplicarATodos(metricaId: string) {
    const v = await pedirValor({
      titulo: "Mesma meta para todos",
      texto: "O valor vai para todos os membros nesta métrica. Nada é salvo até você clicar em Salvar metas.",
      rotulo: "Meta de cada membro",
      tipo: "number",
      confirmar: "Aplicar",
    });
    if (v === null) return;
    setValores((s) => {
      const n = { ...s };
      for (const p of membros) n[chave(metricaId, p.id)] = v;
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-primary-soft/40 p-3" data-tour="metas-sugestao">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="size-4 text-primary" /> Sugestão pelo histórico
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">Base <Dica id="metas.base" /></div>
          <NativeSelect value={base} onChange={(e) => trocarBase(e.target.value)} className="w-48" data-tour="metas-copiar">
            <option value="3">média de 3 meses</option>
            <option value="6">média de 6 meses</option>
            <option value="anterior">metas do mês anterior</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">Crescimento <Dica id="metas.crescimento" /></div>
          <NativeSelect value={String(crescimento)} onChange={(e) => setCrescimento(Number(e.target.value))} className="w-32">
            {[0, 5, 10, 15, 20, 30].map((g) => (
              <option key={g} value={g}>
                {g === 0 ? (base === "anterior" ? "igual" : "manter média") : `+${g}%`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button onClick={preencherSugestoes}>
          <Wand2 /> {base === "anterior" ? "Preencher com o mês anterior" : "Preencher com sugestão"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={salvar} disabled={salvando || leitura}>
          <Save /> {salvando ? "Salvando…" : "Salvar metas"}
        </Button>
      </div>
      {conflitos.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="font-medium">As metas salvas deste mês não batem entre si</div>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {conflitos.map((c) => (
              <li key={c}>{c}.</li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            A grade agora mostra a meta da equipe dividida pela participação de cada pessoa. Ao salvar, é isso que fica. Para
            manter as metas por pessoa, ligue &quot;por pessoa&quot; na coluna.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card" data-tour="metas-grade">
        <Table fixarPrimeira={false}>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-28 sm:min-w-48">Pessoa</TableHead>
              {metricas.map((m) => (
                <TableHead key={m.id} className="min-w-32 align-top whitespace-normal sm:min-w-40">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {m.nome} <span className="text-xs font-normal text-muted-foreground">({m.unidade})</span>
                    </span>
                    {modo[m.id] === "pessoa" && (
                      <Button variant="ghost" size="icon-xs" aria-label={`Aplicar a todos: ${m.nome}`} onClick={() => aplicarATodos(m.id)}>
                        <Wand2 />
                      </Button>
                    )}
                  </div>
                  <label className="mt-1 flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
                    <Switch
                      size="sm"
                      checked={modo[m.id] === "pessoa"}
                      onCheckedChange={(v) => trocarModo(m, v)}
                      aria-label={`Definir ${m.nome} por pessoa`}
                    />
                    {modo[m.id] === "pessoa" ? "por pessoa" : "pela equipe"}
                    <Dica id="metas.modo" />
                  </label>
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
                {metricas.map((m) => {
                  const derivado = p.funcao === "membro" && modo[m.id] === "equipe";
                  const d = derivado ? divisao(m) : null;
                  return (
                    <TableCell key={m.id}>
                      <Input
                        inputMode="decimal"
                        className="w-24 tabular-nums read-only:bg-muted/50 read-only:text-muted-foreground sm:w-32"
                        readOnly={derivado}
                        tabIndex={derivado ? -1 : undefined}
                        value={derivado ? (d?.[p.id] === undefined ? "" : String(d[p.id])) : (valores[chave(m.id, p.id)] ?? "")}
                        placeholder={
                          derivado
                            ? "—"
                            : p.funcao === "membro"
                              ? String(sugerir(historico[chave(m.id, p.id)], crescimento, m.unidade) ?? "—")
                              : "—"
                        }
                        onChange={(e) => set(chave(m.id, p.id), e.target.value)}
                      />
                      {derivado ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {fatorDe(p.id) === 0
                            ? "ausente o mês todo"
                            : m.unidade === "%"
                              ? "igual à da equipe"
                              : `${Math.round((participacoes(pesos(m.id))[p.id] ?? 0) * 1000) / 10}% da equipe`}
                        </div>
                      ) : (
                        p.funcao === "membro" && <DicaHistorico h={historico[chave(m.id, p.id)]} unidade={m.unidade} nMeses={nMeses} />
                      )}
                      {p.funcao === "membro" && (
                        <AvisoAusencia
                          fator={fatorDe(p.id)}
                          valor={derivado ? (d?.[p.id] ?? null) : numero(valores[chave(m.id, p.id)])}
                          unidade={m.unidade}
                          derivado={derivado}
                        />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell>
                <div className="flex items-center gap-1 font-medium">Meta da equipe <Dica id="metas.equipe" /></div>
                <div className="text-xs text-muted-foreground">usada nos indicadores de escopo equipe (líder)</div>
              </TableCell>
              {metricas.map((m) => {
                const porPessoa = modo[m.id] === "pessoa";
                const total = porPessoa ? somaOuMedia(m) : null;
                return (
                  <TableCell key={m.id}>
                    <Input
                      inputMode="decimal"
                      className="w-24 tabular-nums read-only:bg-muted/50 read-only:text-muted-foreground sm:w-32"
                      readOnly={porPessoa}
                      tabIndex={porPessoa ? -1 : undefined}
                      value={porPessoa ? (total === null ? "" : String(total)) : (valores[chave(m.id, null)] ?? "")}
                      placeholder={porPessoa ? "—" : String(sugerir(historico[chave(m.id, null)], crescimento, m.unidade) ?? "—")}
                      onChange={(e) => set(chave(m.id, null), e.target.value)}
                    />
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {porPessoa
                        ? m.unidade === "%"
                          ? "média de quem trabalha no mês"
                          : algumaAusencia
                            ? "soma do que vale para as pessoas, descontadas as ausências"
                            : "soma das pessoas"
                        : `histórico da equipe ${fmt(historico[chave(m.id, null)]?.referencia ?? null, m.unidade)}`}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Pela equipe: você digita só a meta da equipe e ela é dividida entre quem trabalha no mês, pela participação de cada
        pessoa na média dos últimos meses e pelos dias disponíveis (taxas em % valem igual para todos). Quem tem ausência
        lançada fica com menos (ou sem meta, se ficar o mês todo fora) e a diferença vai para os outros. Por pessoa: você
        digita a de cada um e a da equipe vira a soma do que vale para cada pessoa (ou a média, para %). Ausência lançada
        depois de salvar reduz a meta da pessoa e a da equipe, quando o indicador estiver com &quot;meta proporcional&quot;
        ligada.
      </p>
    </div>
  );
}
