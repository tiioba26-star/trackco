"use client";

import { FlaskConical, Plus, Rocket, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NivelBadge } from "@/components/app/blocos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Condicao, DefinicaoPlano, Faixa, Indicador, TipoRecompensa } from "@/engine/tipos";
import { fmtPct } from "@/lib/formato";
import { alterarStatusPlano, publicarVersao, salvarRascunho, simularPlano, type LinhaSimulacao } from "../actions";
import { Dica } from "@/components/ajuda/dica";

const novoId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

const RECOMPENSAS: { v: TipoRecompensa | ""; t: string }[] = [
  { v: "", t: "Nenhuma" },
  { v: "reconhecimento", t: "Reconhecimento (selo)" },
  { v: "premio", t: "Prêmio (bombom, caneca…)" },
  { v: "valor_fixo", t: "Valor fixo (R$)" },
  { v: "percentual", t: "Percentual (%)" },
  { v: "pontos", t: "Pontos" },
];

interface Props {
  plano: { id: string; nome: string; descricao: string; modalidade: string; status: string; equipe_id: string };
  rascunho: DefinicaoPlano;
  metricas: { id: string; nome: string; unidade: string }[];
  competencia: string;
  competenciaAnterior: string;
}

export function EditorPlano({ plano, rascunho, metricas, competencia, competenciaAnterior }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(plano.nome);
  const [descricao, setDescricao] = useState(plano.descricao);
  const [modalidade, setModalidade] = useState(plano.modalidade);
  const [def, setDef] = useState<DefinicaoPlano>({
    indicadores: rascunho.indicadores ?? [],
    faixas: rascunho.faixas ?? [],
    condicoes: rascunho.condicoes ?? [],
  });
  const [salvando, setSalvando] = useState(false);
  const [compSim, setCompSim] = useState(competenciaAnterior);
  const [sim, setSim] = useState<LinhaSimulacao[] | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [publicar, setPublicar] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [vigente, setVigente] = useState(competencia);
  const [obs, setObs] = useState("");

  const setInd = (i: number, p: Partial<Indicador>) =>
    setDef({ ...def, indicadores: def.indicadores.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setFx = (i: number, p: Partial<Faixa>) =>
    setDef({ ...def, faixas: def.faixas.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setCd = (i: number, p: Partial<Condicao>) =>
    setDef({ ...def, condicoes: def.condicoes.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const nomeInd = (ind: Indicador) => ind.nome || metricas.find((m) => m.id === ind.metrica_id)?.nome || "Indicador";

  async function salvar() {
    setSalvando(true);
    const r = await salvarRascunho(plano.id, { nome, descricao, modalidade, definicao: def });
    setSalvando(false);
    if (!r.ok) toast.error(r.erro);
    else if (r.erro) toast.warning(r.erro);
    else toast.success("Rascunho salvo.");
    router.refresh();
    return r.ok && !r.erro;
  }

  async function simular() {
    setSimulando(true);
    const r = await simularPlano(plano.equipe_id, def, compSim);
    setSimulando(false);
    if (r.ok) setSim(r.linhas ?? []);
    else toast.error(r.erro);
  }

  async function confirmarPublicacao() {
    if (publicando) return; // trava contra cliques repetidos (antes cada clique publicava uma versão)
    setPublicando(true);
    try {
      if (!(await salvar())) return;
      const r = await publicarVersao(plano.id, vigente, obs);
      if (r.ok) {
        setPublicar(false);
        setObs("");
        toast.success("Nova versão publicada. O painel do mês já foi recalculado.");
        router.refresh();
      } else toast.error(r.erro);
    } finally {
      setPublicando(false);
    }
  }

  async function status(s: "ativo" | "arquivado") {
    const r = await alterarStatusPlano(plano.id, s);
    if (r.ok) {
      toast.success(s === "ativo" ? "Plano ativado para a equipe." : "Plano arquivado.");
      router.refresh();
    } else toast.error(r.erro);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_220px]">
          <div className="space-y-1.5">
            <Label>Nome do plano</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1"><Label>Descrição</Label><Dica id="cond.descricao" /></div>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1"><Label>Modalidade</Label><Dica id="plano.modalidade" /></div>
            <NativeSelect value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
              <option value="reconhecimento">Reconhecimento</option>
              <option value="premio">Prêmios</option>
              <option value="dinheiro">Comissão em R$</option>
              <option value="pontos">Pontos</option>
              <option value="misto">Misto</option>
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Indicadores ---------------- */}
      <Card data-tour="plano-indicadores">
        <CardHeader>
          <CardTitle>Indicadores</CardTitle>
          <CardDescription>
            O que entra na nota e com que peso. <b>Escopo equipe</b> soma a produção dos membros: use para avaliar o líder pelo
            resultado do conjunto. Peso 0 = indicador só informativo (aparece, mas não pesa).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {def.indicadores.map((ind, i) => (
            <div key={ind.id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-6">
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center gap-1"><Label>Métrica</Label><Dica id="ind.metrica" /></div>
                <NativeSelect value={ind.metrica_id} onChange={(e) => setInd(i, { metrica_id: e.target.value })}>
                  <option value="">Escolha…</option>
                  {metricas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.unidade})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center gap-1"><Label>Nome no extrato (opcional)</Label><Dica id="ind.nome" /></div>
                <Input value={ind.nome ?? ""} onChange={(e) => setInd(i, { nome: e.target.value || undefined })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Escopo</Label><Dica id="ind.escopo" /></div>
                <NativeSelect value={ind.escopo} onChange={(e) => setInd(i, { escopo: e.target.value as Indicador["escopo"] })}>
                  <option value="individual">Individual</option>
                  <option value="equipe">Equipe (agregado)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Aplica-se a</Label><Dica id="ind.aplica_a" /></div>
                <NativeSelect value={ind.aplica_a} onChange={(e) => setInd(i, { aplica_a: e.target.value as Indicador["aplica_a"] })}>
                  <option value="membros">Membros</option>
                  <option value="lider">Líder</option>
                  <option value="todos">Todos</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Peso</Label><Dica id="ind.peso" /></div>
                <Input type="number" min={0} value={ind.peso} onChange={(e) => setInd(i, { peso: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Teto (%)</Label><Dica id="ind.teto" /></div>
                <Input type="number" min={1} value={ind.teto_pct} onChange={(e) => setInd(i, { teto_pct: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 self-end pb-1.5 text-sm md:col-span-2">
                <Switch checked={ind.meta_proporcional} onCheckedChange={(v) => setInd(i, { meta_proporcional: v })} />
                Meta proporcional aos dias trabalhados <Dica id="ind.proporcional" />
              </label>
              {ind.escopo === "equipe" ? (
                <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
                  <Switch checked={!!ind.incluir_lider} onCheckedChange={(v) => setInd(i, { incluir_lider: v })} />
                  Incluir produção do líder <Dica id="ind.incluir_lider" />
                </label>
              ) : (
                <div />
              )}
              <div className="flex items-end justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover indicador"
                  onClick={() => setDef({ ...def, indicadores: def.indicadores.filter((_, j) => j !== i) })}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setDef({
                ...def,
                indicadores: [
                  ...def.indicadores,
                  {
                    id: novoId("ind"),
                    metrica_id: metricas[0]?.id ?? "",
                    escopo: "individual",
                    aplica_a: "membros",
                    peso: 50,
                    teto_pct: 150,
                    meta_proporcional: true,
                  },
                ],
              })
            }
          >
            <Plus /> Adicionar indicador
          </Button>
        </CardContent>
      </Card>

      {/* ---------------- Faixas ---------------- */}
      <Card data-tour="plano-faixas">
        <CardHeader>
          <CardTitle>Faixas de atingimento</CardTitle>
          <CardDescription>
            A nota geral (média ponderada) cai em uma faixa, que define o nível e a recompensa. Intervalo [de, até): &quot;até&quot; vazio
            = sem limite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...def.faixas]
            .map((f, i) => ({ f, i }))
            .sort((a, b) => a.f.de_pct - b.f.de_pct)
            .map(({ f, i }) => (
              <div key={f.id} className="grid items-end gap-3 rounded-xl border p-3 md:grid-cols-[90px_90px_1fr_60px_1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1"><Label>De (%)</Label><Dica id="faixa.de_ate" /></div>
                  <Input type="number" value={f.de_pct} onChange={(e) => setFx(i, { de_pct: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1"><Label>Até (%)</Label><Dica id="faixa.de_ate" /></div>
                  <Input
                    type="number"
                    value={f.ate_pct ?? ""}
                    placeholder="∞"
                    onChange={(e) => setFx(i, { ate_pct: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1"><Label>Nível</Label><Dica id="faixa.nivel" /></div>
                  <Input value={f.nivel} onChange={(e) => setFx(i, { nivel: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1"><Label>Cor</Label><Dica id="faixa.cor" /></div>
                  <input
                    type="color"
                    value={f.cor ?? "#1c5cab"}
                    onChange={(e) => setFx(i, { cor: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded-lg border bg-transparent"
                    aria-label="Cor do nível"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1"><Label>Recompensa</Label><Dica id="faixa.recompensa" /></div>
                  <NativeSelect
                    value={f.recompensa?.tipo ?? ""}
                    onChange={(e) =>
                      setFx(i, {
                        recompensa: e.target.value ? { ...(f.recompensa ?? {}), tipo: e.target.value as TipoRecompensa } : null,
                      })
                    }
                  >
                    {RECOMPENSAS.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.t}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label>{["valor_fixo", "percentual", "pontos"].includes(f.recompensa?.tipo ?? "") ? "Valor" : "Descrição"}</Label>
                  {["valor_fixo", "percentual", "pontos"].includes(f.recompensa?.tipo ?? "") ? (
                    <Input
                      type="number"
                      value={f.recompensa?.valor ?? ""}
                      onChange={(e) => setFx(i, { recompensa: { ...f.recompensa!, valor: Number(e.target.value) } })}
                    />
                  ) : (
                    <Input
                      disabled={!f.recompensa}
                      value={f.recompensa?.descricao ?? ""}
                      placeholder={f.recompensa?.tipo === "premio" ? "Ex.: caixa de bombom" : "Ex.: Selo Meta batida"}
                      onChange={(e) => setFx(i, { recompensa: { ...f.recompensa!, descricao: e.target.value } })}
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover faixa"
                  onClick={() => setDef({ ...def, faixas: def.faixas.filter((_, j) => j !== i) })}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const maior = def.faixas.reduce((m, f) => Math.max(m, f.ate_pct ?? f.de_pct), 0);
                setDef({
                  ...def,
                  faixas: [...def.faixas, { id: novoId("fx"), de_pct: maior, ate_pct: null, nivel: "Novo nível", cor: "#1c5cab" }],
                });
              }}
            >
              <Plus /> Adicionar faixa
            </Button>
            <div className="flex flex-wrap gap-1.5">
              {[...def.faixas]
                .sort((a, b) => a.de_pct - b.de_pct)
                .map((f) => (
                  <NivelBadge key={f.id} nivel={`${f.nivel} · ${f.de_pct}%+`} cor={f.cor} />
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Condições ---------------- */}
      <Card data-tour="plano-condicoes">
        <CardHeader>
          <CardTitle>Condições e exceções</CardTitle>
          <CardDescription>
            Gatilhos que precisam ser atendidos. Ex.: &quot;Comparecimento ≥ 60%&quot; para liberar a recompensa. Férias e atestados são
            tratados pela meta proporcional (Ausências) e erros pontuais pelos ajustes das contestações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {def.condicoes.map((c, i) => (
            <div key={c.id} className="grid items-end gap-3 rounded-xl border p-3 md:grid-cols-[1.4fr_1fr_120px_80px_100px_1fr_auto]">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Descrição</Label><Dica id="cond.descricao" /></div>
                <Input value={c.descricao} onChange={(e) => setCd(i, { descricao: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Indicador</Label><Dica id="cond.indicador" /></div>
                <NativeSelect value={c.indicador_id} onChange={(e) => setCd(i, { indicador_id: e.target.value })}>
                  {def.indicadores.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {nomeInd(ind)} · {ind.aplica_a}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Base</Label><Dica id="cond.base" /></div>
                <NativeSelect value={c.base} onChange={(e) => setCd(i, { base: e.target.value as Condicao["base"] })}>
                  <option value="realizado">Realizado</option>
                  <option value="atingimento">Atingimento %</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Op.</Label>
                <NativeSelect value={c.operador} onChange={(e) => setCd(i, { operador: e.target.value as Condicao["operador"] })}>
                  {[">=", ">", "<=", "<"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input type="number" value={c.valor} onChange={(e) => setCd(i, { valor: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Se não atender</Label><Dica id="cond.efeito" /></div>
                <NativeSelect value={c.efeito} onChange={(e) => setCd(i, { efeito: e.target.value as Condicao["efeito"] })}>
                  <option value="bloquear_recompensa">Bloquear recompensa</option>
                  <option value="limitar_nivel">Limitar nível</option>
                </NativeSelect>
                {c.efeito === "limitar_nivel" && (
                  <NativeSelect value={c.faixa_maxima_id ?? ""} onChange={(e) => setCd(i, { faixa_maxima_id: e.target.value })}>
                    <option value="">Nível máximo…</option>
                    {def.faixas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nivel}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover condição"
                onClick={() => setDef({ ...def, condicoes: def.condicoes.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={!def.indicadores.length}
            onClick={() =>
              setDef({
                ...def,
                condicoes: [
                  ...def.condicoes,
                  {
                    id: novoId("cd"),
                    descricao: "Condição mínima",
                    indicador_id: def.indicadores[0].id,
                    base: "realizado",
                    operador: ">=",
                    valor: 0,
                    efeito: "bloquear_recompensa",
                  },
                ],
              })
            }
          >
            <Plus /> Adicionar condição
          </Button>
        </CardContent>
      </Card>

      {/* ---------------- Simulador ---------------- */}
      <Card data-tour="plano-simular">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" /> Simulador <Dica id="plano.simular" />
          </CardTitle>
          <CardDescription>Aplica o rascunho (como está na tela) a um mês com dados reais e compara com o plano vigente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input type="month" value={compSim} onChange={(e) => setCompSim(e.target.value)} className="w-44" />
            <Button onClick={simular} disabled={simulando}>
              {simulando ? "Simulando…" : "Simular"}
            </Button>
          </div>
          {sim && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Nota atual</TableHead>
                    <TableHead>Nível atual</TableHead>
                    <TableHead className="text-right">Nota simulada</TableHead>
                    <TableHead>Nível simulado</TableHead>
                    <TableHead>Recompensa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sim.map((l) => (
                    <TableRow key={l.nome}>
                      <TableCell>{l.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{l.funcao}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(l.notaAtual)}</TableCell>
                      <TableCell>{l.nivelAtual ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{fmtPct(l.nota)}</TableCell>
                      <TableCell>{l.nivel ?? "—"}</TableCell>
                      <TableCell>{l.recompensa}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {plano.status !== "ativo" ? (
          <Button variant="outline" onClick={() => status("ativo")}>
            Ativar para a equipe
          </Button>
        ) : (
          <Button variant="outline" onClick={() => status("arquivado")}>
            Arquivar
          </Button>
        )}
        <Button variant="outline" onClick={salvar} disabled={salvando}>
          <Save /> Salvar rascunho
        </Button>
        <Button onClick={() => setPublicar(true)} data-tour="plano-publicar">
          <Rocket /> Publicar versão
        </Button>
      </div>

      <Dialog open={publicar} onOpenChange={(o) => !publicando && setPublicar(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar nova versão</DialogTitle>
            <DialogDescription>
              A versão publicada não pode ser editada. Ela vale a partir do mês escolhido; meses anteriores continuam com a versão
              que valia na época.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1"><Label>Vale a partir de</Label><Dica id="plano.vigente" /></div>
              <Input type="month" value={vigente} onChange={(e) => setVigente(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>O que mudou (aparece no extrato)</Label>
              <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublicar(false)} disabled={publicando}>
              Cancelar
            </Button>
            <Button onClick={confirmarPublicacao} disabled={publicando}>
              {publicando ? "Publicando e recalculando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
