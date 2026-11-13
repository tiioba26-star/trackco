"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { competenciaDe, inicioCompetencia } from "@/engine/datas";
import { type DadosFormulario, nomeRodada, type Pergunta, proximaAbertura, rodadaAtual, ROTULO_TIPO, type TipoPergunta } from "@/lib/formularios";
import { salvarFormulario } from "./actions";

type Inicial = Omit<DadosFormulario, "inicio"> & { inicio: string | null };
const novoId = () => `p${Math.random().toString(36).slice(2, 8)}`;
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function EditorFormulario({
  id,
  inicial,
  equipes,
  hoje,
  temRespostas,
}: {
  id: string | null;
  inicial: Inicial;
  equipes: { id: string; nome: string }[];
  hoje: string;
  temRespostas: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(inicial);
  const [pedirAgora, setPedirAgora] = useState(false);
  const [salvando, iniciar] = useTransition();
  const mudar = <K extends keyof Inicial>(k: K, v: Inicial[K]) => setF((x) => ({ ...x, [k]: v }));
  const mudarPergunta = (i: number, p: Partial<Pergunta>) => mudar("perguntas", f.perguntas.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const mover = (i: number, d: -1 | 1) => {
    const lista = [...f.perguntas];
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    mudar("perguntas", lista);
  };

  // quando vai aparecer, com as escolhas atuais
  const inicioPrev = pedirAgora ? inicioCompetencia(competenciaDe(hoje)) : (f.inicio ?? hoje);
  const agenda = { ...f, inicio: inicioPrev };
  const abertaAgora = rodadaAtual(agenda, hoje);
  const proxima = proximaAbertura(agenda, hoje);

  const salvar = () =>
    iniciar(async () => {
      const { inicio: _, ...dados } = f;
      const r = await salvarFormulario(id, { ...dados, pedirAgora });
      if (!r.ok) return void toast.error(r.erro ?? "Não foi possível salvar.");
      toast.success(f.ativo ? "Formulário salvo e ligado." : "Formulário salvo (desligado).");
      router.push("/formularios");
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>O que a pessoa vê</CardTitle>
            <CardDescription>Título e uma frase dizendo para que serve. Dizer que é anônimo e rápido aumenta a sinceridade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" value={f.titulo} onChange={(e) => mudar("titulo", e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descricao">Texto de abertura</Label>
              <Textarea id="descricao" rows={2} value={f.descricao ?? ""} onChange={(e) => mudar("descricao", e.target.value || null)} maxLength={600} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perguntas ({f.perguntas.length})</CardTitle>
            <CardDescription>
              Uma ideia por pergunta. Prefira poucas: formulário curto é respondido com atenção.
              {temRespostas && " Este formulário já tem respostas: mudar o sentido de uma pergunta mistura os resultados (melhor criar outro)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {f.modelo === "sus" && (
              <p className="rounded-lg bg-primary-soft px-3 py-2 text-xs">
                Este formulário calcula a <b>nota SUS</b> (0 a 100) com as 10 primeiras perguntas de 1 a 5, na ordem. Pode reescrever as frases, mas mantenha o
                sentido e a ordem (as ímpares são positivas, as pares negativas). Perguntas extras podem vir depois da 10ª.
              </p>
            )}
            <ol className="space-y-3">
              {f.perguntas.map((p, i) => (
                <li key={p.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                    <Textarea
                      rows={1}
                      value={p.texto}
                      onChange={(e) => mudarPergunta(i, { texto: e.target.value })}
                      placeholder="Escreva a pergunta ou a frase"
                      className="min-h-9"
                      maxLength={300}
                    />
                    <div className="flex shrink-0 flex-col">
                      <Button size="icon-sm" variant="ghost" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Descer" onClick={() => mover(i, 1)} disabled={i === f.perguntas.length - 1}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pl-8">
                    <NativeSelect
                      value={p.tipo}
                      onChange={(e) => mudarPergunta(i, { tipo: e.target.value as TipoPergunta, opcoes: e.target.value === "escolha" ? (p.opcoes ?? ["Sim", "Não"]) : undefined })}
                      className="w-56"
                      aria-label="Tipo de resposta"
                    >
                      {(Object.keys(ROTULO_TIPO) as TipoPergunta[]).map((t) => (
                        <option key={t} value={t}>
                          {ROTULO_TIPO[t]}
                        </option>
                      ))}
                    </NativeSelect>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={p.obrigatoria} onChange={(e) => mudarPergunta(i, { obrigatoria: e.target.checked })} /> Obrigatória
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive"
                      onClick={() => mudar("perguntas", f.perguntas.filter((_, k) => k !== i))}
                      disabled={f.perguntas.length === 1}
                    >
                      <Trash2 className="size-3.5" /> Tirar
                    </Button>
                  </div>
                  {p.tipo === "escolha" && (
                    <div className="space-y-1 pl-8">
                      <Label className="text-xs">Opções (uma por linha)</Label>
                      <Textarea
                        rows={3}
                        value={(p.opcoes ?? []).join("\n")}
                        onChange={(e) => mudarPergunta(i, { opcoes: e.target.value.split("\n").map((o) => o.trimStart()).slice(0, 10) })}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <Button
              variant="outline"
              onClick={() => mudar("perguntas", [...f.perguntas, { id: novoId(), tipo: "escala5", texto: "", obrigatoria: true }])}
              disabled={f.perguntas.length >= 25}
            >
              <Plus className="size-4" /> Adicionar pergunta
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Quando aparece</CardTitle>
            <CardDescription>No dia marcado, no primeiro acesso: o site fica desfocado até a pessoa responder. Quem não entrar no dia responde quando entrar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["mensal", "Repetir"],
                  ["unica", "Uma vez só"],
                ] as const
              ).map(([v, t]) => (
                <Button key={v} variant={f.recorrencia === v ? "default" : "outline"} size="sm" onClick={() => mudar("recorrencia", v)}>
                  {t}
                </Button>
              ))}
            </div>
            {f.recorrencia === "mensal" ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <NativeSelect value={String(f.a_cada_meses)} onChange={(e) => mudar("a_cada_meses", Number(e.target.value))} className="w-36" aria-label="Frequência">
                  {[1, 2, 3, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Todo mês" : `A cada ${n} meses`}
                    </option>
                  ))}
                </NativeSelect>
                no dia
                <NativeSelect value={String(f.dia_mes ?? 2)} onChange={(e) => mudar("dia_mes", Number(e.target.value))} className="w-20" aria-label="Dia do mês">
                  {Array.from({ length: 28 }, (_, k) => k + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="data_unica">A partir de</Label>
                <Input id="data_unica" type="date" value={f.data_unica ?? ""} min={hoje} onChange={(e) => mudar("data_unica", e.target.value || null)} />
              </div>
            )}
            {f.recorrencia === "mensal" && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={pedirAgora} onChange={(e) => setPedirAgora(e.target.checked)} />
                <span>
                  Já pedir neste mês
                  <span className="block text-xs text-muted-foreground">Mesmo que o dia já tenha passado: quem entrar depois de salvar já responde.</span>
                </span>
              </label>
            )}
            <p className="rounded-lg bg-muted px-3 py-2 text-xs">
              {!f.ativo
                ? "Desligado: não aparece para ninguém até você ligar."
                : abertaAgora
                  ? `Ligado e aberto agora (rodada ${nomeRodada(abertaAgora)}): quem ainda não respondeu vai ver no próximo acesso.`
                  : proxima
                    ? `Ligado. Próxima vez: ${dataBR(proxima)}.`
                    : "Ligado, mas sem data para abrir."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quem responde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-4">
              {(
                [
                  ["membro", "Atendentes"],
                  ["lider", "Líderes"],
                ] as const
              ).map(([v, t]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={f.publico.funcoes.includes(v)}
                    onChange={(e) =>
                      mudar("publico", { ...f.publico, funcoes: e.target.checked ? [...f.publico.funcoes, v] : f.publico.funcoes.filter((x) => x !== v) })
                    }
                  />
                  {t}
                </label>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Equipes (nenhuma marcada = todas)</Label>
              {equipes.map((e) => (
                <label key={e.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={f.publico.equipes.includes(e.id)}
                    onChange={(ev) =>
                      mudar("publico", {
                        ...f.publico,
                        equipes: ev.target.checked ? [...f.publico.equipes, e.id] : f.publico.equipes.filter((x) => x !== e.id),
                      })
                    }
                  />
                  {e.nome}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Administradores sem equipe não são bloqueados.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <label className="flex items-start justify-between gap-3 text-sm">
              <span>
                Anônimo
                <span className="block text-xs text-muted-foreground">
                  Recomendado. Você vê quem já respondeu, mas não o que cada um respondeu. Respostas anônimas são mais sinceras.
                </span>
              </span>
              <Switch checked={f.anonimo} onCheckedChange={(v) => mudar("anonimo", v)} />
            </label>
            <label className="flex items-start justify-between gap-3 text-sm">
              <span>
                Calcular nota SUS
                <span className="block text-xs text-muted-foreground">Só para o questionário de facilidade de uso (10 frases de 1 a 5).</span>
              </span>
              <Switch checked={f.modelo === "sus"} onCheckedChange={(v) => mudar("modelo", v ? "sus" : null)} />
            </label>
            <label className="flex items-start justify-between gap-3 text-sm font-medium">
              <span>
                Ligado
                <span className="block text-xs font-normal text-muted-foreground">Desligue a qualquer momento: o bloqueio some na hora.</span>
              </span>
              <Switch checked={f.ativo} onCheckedChange={(v) => mudar("ativo", v)} />
            </label>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/formularios")}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
