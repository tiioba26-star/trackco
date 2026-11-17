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
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Condicao, DefinicaoPlano, Faixa, Indicador, TipoRecompensa } from "@/engine/tipos";
import { nomeCompetencia } from "@/engine/datas";
import { useAvisoAoSair } from "@/hooks/use-aviso-sair";
import { fmtPct } from "@/lib/formato";
import { useConfirmar, useSomenteLeitura } from "@/components/app/confirmacao";
import { alterarStatusPlano, publicarVersao, salvarRascunho, simularPlano, type LinhaSimulacao } from "../actions";
import { Dica } from "@/components/ajuda/dica";
import { Campo } from "@/components/ui/campo";

const novoId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

const RECOMPENSAS: { v: TipoRecompensa | ""; t: string }[] = [
  { v: "", t: "Nenhuma" },
  { v: "reconhecimento", t: "Reconhecimento (selo)" },
  { v: "premio", t: "Prêmio (bombom, caneca…)" },
  { v: "valor_fixo", t: "Valor fixo (R$)" },
  { v: "percentual", t: "Percentual (%)" },
  { v: "pontos", t: "Pontos" },
];

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

interface Props {
  plano: {
    id: string;
    nome: string;
    descricao: string;
    modalidade: string;
    status: string;
    equipe_id: string;
    equipe: string;
    /** plano que está ativo hoje na equipe (será arquivado se este for ativado) */
    outroAtivo: string | null;
  };
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
  const confirmar = useConfirmar();
  const leitura = useSomenteLeitura();
  // alterações não salvas: compara com o que foi salvo por último
  const foto = JSON.stringify({ nome, descricao, modalidade, def });
  const [salvoComo, setSalvoComo] = useState(foto);
  useAvisoAoSair(foto !== salvoComo && !leitura);

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
    if (r.ok) setSalvoComo(foto);
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
    const mes = nomeCompetencia(competencia);
    const ok = await confirmar(
      s === "ativo"
        ? {
            titulo: `Ativar este plano para a equipe ${plano.equipe}?`,
            texto: plano.outroAtivo
              ? `O plano "${plano.outroAtivo}", que vale hoje, será arquivado, e ${mes} será recalculado com a versão publicada deste plano.`
              : `${maiuscula(mes)} será recalculado com a versão publicada deste plano.`,
            confirmar: "Ativar e recalcular",
          }
        : {
            titulo: "Arquivar este plano?",
            texto: `A equipe ${plano.equipe} fica sem plano ativo até você ativar outro. O histórico e as versões continuam guardados.`,
            confirmar: "Arquivar",
            perigo: true,
          },
    );
    if (!ok) return;
    const r = await alterarStatusPlano(plano.id, s);
    if (r.ok) {
      toast.success(s === "ativo" ? "Plano ativado para a equipe." : "Plano arquivado.");
      router.refresh();
    } else toast.error(r.erro);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-x-4 gap-y-5 md:grid-cols-[1fr_1fr_220px]">
          <Campo rotulo="Nome do plano">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo rotulo="Descrição" dica="plano.descricao">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
          <Campo rotulo="Modalidade" dica="plano.modalidade">
            <NativeSelect value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
              <option value="reconhecimento">Reconhecimento</option>
              <option value="premio">Prêmios</option>
              <option value="dinheiro">Comissão em R$</option>
              <option value="pontos">Pontos</option>
              <option value="misto">Misto</option>
            </NativeSelect>
          </Campo>
        </CardContent>
      </Card>

      {/* ---------------- Indicadores ---------------- */}
      <Card data-tour="plano-indicadores">
        <CardHeader>
          <CardTitle>Indicadores</CardTitle>
          <CardDescription>
            O que entra na nota e com que peso. <b>Conta a equipe toda</b> soma a produção dos membros: use para avaliar o líder pelo
            resultado do conjunto. Peso 0 = indicador só informativo (aparece, mas não pesa).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {def.indicadores.map((ind, i) => (
            <div key={ind.id} className="grid gap-x-3 gap-y-5 rounded-xl border p-3 md:grid-cols-6">
              <Campo rotulo="Métrica" dica="ind.metrica" className="md:col-span-2">
                <NativeSelect value={ind.metrica_id} onChange={(e) => setInd(i, { metrica_id: e.target.value })}>
                  <option value="">Escolha…</option>
                  {metricas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.unidade})
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <Campo rotulo="Nome no extrato (opcional)" dica="ind.nome" className="md:col-span-2">
                <Input value={ind.nome ?? ""} onChange={(e) => setInd(i, { nome: e.target.value || undefined })} />
              </Campo>
              <Campo rotulo="Conta de quem" dica="ind.escopo">
                <NativeSelect value={ind.escopo} onChange={(e) => setInd(i, { escopo: e.target.value as Indicador["escopo"] })}>
                  <option value="individual">De cada pessoa</option>
                  <option value="equipe">Da equipe toda (soma)</option>
                </NativeSelect>
              </Campo>
              <Campo rotulo="Vale para" dica="ind.aplica_a">
                <NativeSelect value={ind.aplica_a} onChange={(e) => setInd(i, { aplica_a: e.target.value as Indicador["aplica_a"] })}>
                  <option value="membros">Membros</option>
                  <option value="lider">Líder</option>
                  <option value="todos">Todos</option>
                </NativeSelect>
              </Campo>
              <Campo rotulo="Peso" dica="ind.peso">
                <Input type="number" min={0} value={ind.peso} onChange={(e) => setInd(i, { peso: Number(e.target.value) })} />
              </Campo>
              <Campo rotulo="Conta até no máximo (%)" dica="ind.teto">
                <Input type="number" min={1} value={ind.teto_pct} onChange={(e) => setInd(i, { teto_pct: Number(e.target.value) })} />
              </Campo>
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
            A nota geral (média dos indicadores, com os pesos) cai em uma faixa, que define o nível e a recompensa. Cada faixa vai de
            &quot;De&quot; até menos de &quot;Até&quot;; &quot;Até&quot; vazio = sem limite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...def.faixas]
            .map((f, i) => ({ f, i }))
            .sort((a, b) => a.f.de_pct - b.f.de_pct)
            .map(({ f, i }) => (
              <div key={f.id} className="grid items-end gap-x-3 gap-y-5 rounded-xl border p-3 md:grid-cols-[90px_90px_1fr_60px_1fr_1fr_auto]">
                <Campo rotulo="De (%)" dica="faixa.de_ate">
                  <Input type="number" value={f.de_pct} onChange={(e) => setFx(i, { de_pct: Number(e.target.value) })} />
                </Campo>
                <Campo rotulo="Até (%)" dica="faixa.de_ate">
                  <Input
                    type="number"
                    value={f.ate_pct ?? ""}
                    placeholder="∞"
                    onChange={(e) => setFx(i, { ate_pct: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </Campo>
                <Campo rotulo="Nível" dica="faixa.nivel">
                  <Input value={f.nivel} onChange={(e) => setFx(i, { nivel: e.target.value })} />
                </Campo>
                <Campo rotulo="Cor" dica="faixa.cor">
                  <input
                    type="color"
                    value={f.cor ?? "#1c5cab"}
                    onChange={(e) => setFx(i, { cor: e.target.value })}
                    className="h-8 w-full cursor-pointer rounded-lg border bg-transparent"
                    aria-label="Cor do nível"
                  />
                </Campo>
                <Campo rotulo="Recompensa" dica="faixa.recompensa">
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
                </Campo>
                <Campo rotulo={["valor_fixo", "percentual", "pontos"].includes(f.recompensa?.tipo ?? "") ? "Valor" : "Descrição"}>
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
                </Campo>
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
            <div key={c.id} className="grid items-end gap-x-3 gap-y-5 rounded-xl border p-3 md:grid-cols-[1.4fr_1fr_120px_80px_100px_1fr_auto]">
              <Campo rotulo="Descrição" dica="cond.descricao">
                <Input value={c.descricao} onChange={(e) => setCd(i, { descricao: e.target.value })} />
              </Campo>
              <Campo rotulo="Indicador" dica="cond.indicador">
                <NativeSelect value={c.indicador_id} onChange={(e) => setCd(i, { indicador_id: e.target.value })}>
                  {def.indicadores.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {nomeInd(ind)} · {ind.aplica_a === "lider" ? "líder" : ind.aplica_a === "todos" ? "todos" : "membros"}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <Campo rotulo="Comparar" dica="cond.base">
                <NativeSelect value={c.base} onChange={(e) => setCd(i, { base: e.target.value as Condicao["base"] })}>
                  <option value="realizado">O número feito</option>
                  <option value="atingimento">O % da meta</option>
                </NativeSelect>
              </Campo>
              <Campo rotulo="Precisa ser">
                <NativeSelect value={c.operador} onChange={(e) => setCd(i, { operador: e.target.value as Condicao["operador"] })}>
                  {(
                    [
                      [">=", "pelo menos"],
                      [">", "mais que"],
                      ["<=", "no máximo"],
                      ["<", "menos que"],
                    ] as const
                  ).map(([o, t]) => (
                    <option key={o} value={o}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <Campo rotulo="Valor">
                <Input type="number" value={c.valor} onChange={(e) => setCd(i, { valor: Number(e.target.value) })} />
              </Campo>
              <Campo rotulo="Se não atender" dica="cond.efeito">
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
              </Campo>
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
          <Button variant="outline" onClick={() => status("ativo")} disabled={leitura}>
            Ativar para a equipe
          </Button>
        ) : (
          <Button variant="outline" onClick={() => status("arquivado")} disabled={leitura}>
            Arquivar
          </Button>
        )}
        <Button variant="outline" onClick={salvar} disabled={salvando || leitura}>
          <Save /> Salvar rascunho
        </Button>
        <Button onClick={() => setPublicar(true)} data-tour="plano-publicar" disabled={leitura}>
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
          <div className="space-y-5">
            <Campo rotulo="Vale a partir de" dica="plano.vigente">
              <Input type="month" value={vigente} onChange={(e) => setVigente(e.target.value)} />
            </Campo>
            <Campo rotulo="O que mudou (aparece no extrato)">
              <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
            </Campo>
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
