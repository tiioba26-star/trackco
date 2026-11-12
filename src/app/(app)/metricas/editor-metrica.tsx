"use client";

import { FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Rotulo } from "@/components/app/blocos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { camposDeData, campoDaFonte, FONTES, OPERADORES_POR_TIPO, ROTULO_OPERADOR } from "@/engine/fontes";
import { descreverContagem } from "@/engine/metricas";
import type { Contagem, DefinicaoMetrica, FonteId, Metrica, OperadorFiltro } from "@/engine/tipos";
import { fmtValor } from "@/lib/formato";
import { salvarMetrica, testarMetrica, type ResultadoTeste } from "./actions";
import { Dica } from "@/components/ajuda/dica";

const CONTAGEM_PADRAO: Contagem = {
  fonte: "klingo_agendamentos",
  agregacao: "contar",
  campo_data: "data_agendado_em",
  filtros: [],
};

function slug(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function EditorContagem({ valor, onChange, titulo }: { valor: Contagem; onChange: (c: Contagem) => void; titulo?: string }) {
  const fonte = FONTES[valor.fonte];
  const rotulo = (c: string) => campoDaFonte(valor.fonte, c)?.rotulo.toLowerCase() ?? c;
  const set = (p: Partial<Contagem>) => onChange({ ...valor, ...p });

  return (
    <div className="space-y-4 rounded-xl border p-4">
      {titulo && <Rotulo>{titulo}</Rotulo>}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1"><Label>Fonte de dados</Label><Dica id="met.fonte" /></div>
          <NativeSelect
            value={valor.fonte}
            onChange={(e) => {
              const f = e.target.value as FonteId;
              set({ fonte: f, campo_data: camposDeData(f)[0].id, filtros: [], campo_valor: undefined });
            }}
          >
            {Object.values(FONTES).map((f) => (
              <option key={f.id} value={f.id}>
                {f.rotulo}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1"><Label>Como agregar</Label><Dica id="met.agregacao" /></div>
          <NativeSelect value={valor.agregacao} onChange={(e) => set({ agregacao: e.target.value as Contagem["agregacao"] })}>
            <option value="contar">Contar registros</option>
            <option value="somar">Somar um campo</option>
          </NativeSelect>
        </div>
        {valor.agregacao === "somar" ? (
          <div className="space-y-1.5">
            <Label>Campo a somar</Label>
            <NativeSelect value={valor.campo_valor ?? ""} onChange={(e) => set({ campo_valor: e.target.value })}>
              <option value="">Escolha…</option>
              {fonte.campos
                .filter((c) => c.tipo === "numero")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.rotulo}
                  </option>
                ))}
            </NativeSelect>
          </div>
        ) : (
          <div />
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1"><Label>Conta no mês pela data</Label><Dica id="met.campo_data" /></div>
        <NativeSelect value={valor.campo_data} onChange={(e) => set({ campo_data: e.target.value })}>
          {camposDeData(valor.fonte).map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
              {c.ajuda ? ` — ${c.ajuda}` : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1"><Label>Filtros (todos precisam ser verdadeiros)</Label><Dica id="met.filtros" /></div>
        {valor.filtros.map((f, i) => {
          const campo = campoDaFonte(valor.fonte, f.campo);
          const ops = OPERADORES_POR_TIPO[campo?.tipo ?? "texto"];
          const precisaValor = !["verdadeiro", "falso", "preenchido", "vazio"].includes(f.op);
          const atualizar = (p: Partial<typeof f>) =>
            set({ filtros: valor.filtros.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]">
              <NativeSelect
                value={f.campo}
                onChange={(e) => {
                  const c = campoDaFonte(valor.fonte, e.target.value);
                  atualizar({ campo: e.target.value, op: OPERADORES_POR_TIPO[c?.tipo ?? "texto"][0], valor: "" });
                }}
              >
                {fonte.campos
                  .filter((c) => c.tipo !== "data")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.rotulo}
                    </option>
                  ))}
              </NativeSelect>
              <NativeSelect value={f.op} onChange={(e) => atualizar({ op: e.target.value as OperadorFiltro })}>
                {ops.map((o) => (
                  <option key={o} value={o}>
                    {ROTULO_OPERADOR[o]}
                  </option>
                ))}
              </NativeSelect>
              {precisaValor ? (
                <Input
                  value={Array.isArray(f.valor) ? f.valor.join(", ") : (f.valor ?? "")}
                  onChange={(e) => atualizar({ valor: e.target.value })}
                  placeholder={f.op === "em" || f.op === "nao_em" ? "valores separados por vírgula" : "valor"}
                />
              ) : (
                <div />
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover filtro"
                onClick={() => set({ filtros: valor.filtros.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              filtros: [
                ...valor.filtros,
                { campo: fonte.campos.find((c) => c.tipo !== "data")!.id, op: "igual", valor: "" },
              ],
            })
          }
        >
          <Plus /> Adicionar filtro
        </Button>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Em palavras: <span className="text-foreground">{descreverContagem(valor, rotulo)}</span>.
      </p>
    </div>
  );
}

export function EditorMetrica({ metrica, competencia }: { metrica: Metrica | null; competencia: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(metrica?.nome ?? "");
  const [codigo, setCodigo] = useState(metrica?.codigo ?? "");
  const [descricao, setDescricao] = useState(metrica?.descricao ?? "");
  const [tipo, setTipo] = useState<Metrica["tipo"]>(metrica?.tipo ?? "quantitativa");
  const [unidade, setUnidade] = useState<Metrica["unidade"]>(metrica?.unidade ?? "un");
  const [ativo, setAtivo] = useState(metrica?.ativo ?? true);
  const [def, setDef] = useState<DefinicaoMetrica>(
    metrica?.definicao ?? { tipo_calculo: "simples", corte: "hoje", ...CONTAGEM_PADRAO },
  );
  const [comp, setComp] = useState(competencia);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<ResultadoTeste[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  function mudarTipoCalculo(t: "simples" | "taxa") {
    if (t === def.tipo_calculo) return;
    if (t === "taxa") {
      const base = def.tipo_calculo === "simples" ? def : CONTAGEM_PADRAO;
      const { tipo_calculo: _t, corte: _c, somente_analise: _s, ...cont } = base as DefinicaoMetrica & Contagem;
      setDef({ tipo_calculo: "taxa", corte: "ontem", numerador: { ...cont }, denominador: { ...cont }, somente_analise: def.somente_analise });
      setUnidade("%");
    } else {
      setDef({ tipo_calculo: "simples", corte: "hoje", ...(def.tipo_calculo === "taxa" ? def.numerador : CONTAGEM_PADRAO), somente_analise: def.somente_analise });
      if (unidade === "%") setUnidade("un");
    }
  }

  async function salvar() {
    setSalvando(true);
    const r = await salvarMetrica({
      id: metrica?.id,
      nome,
      codigo: codigo || slug(nome),
      descricao,
      tipo,
      unidade,
      ativo,
      definicao: def,
    });
    setSalvando(false);
    if (r.ok) {
      toast.success("Métrica salva.");
      router.push("/metricas");
      router.refresh();
    } else toast.error(r.erro);
  }

  async function testar() {
    setTestando(true);
    const r = await testarMetrica(def, unidade, comp);
    setTestando(false);
    if (r.ok) setTeste(r.resultados ?? []);
    else toast.error(r.erro);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (!metrica) setCodigo(slug(e.target.value));
                }}
                placeholder="Ex.: Agendamentos"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1"><Label>Código</Label><Dica id="met.codigo" /></div>
              <Input value={codigo} onChange={(e) => setCodigo(slug(e.target.value))} placeholder="agendamentos" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição (aparece para os colaboradores)</Label>
              <Textarea rows={2} value={descricao ?? ""} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1"><Label>Análise</Label><Dica id="met.analise" /></div>
              <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value as Metrica["tipo"])}>
                <option value="quantitativa">Quantitativa (volume)</option>
                <option value="qualitativa">Qualitativa (resultado/qualidade)</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1"><Label>Unidade</Label><Dica id="met.unidade" /></div>
              <NativeSelect value={unidade} onChange={(e) => setUnidade(e.target.value as Metrica["unidade"])}>
                <option value="un">Unidades</option>
                <option value="%">Percentual (%)</option>
                <option value="R$">Reais (R$)</option>
                <option value="pts">Pontos</option>
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={ativo} onCheckedChange={setAtivo} /> Ativa
            </label>
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <Switch
                checked={!!def.somente_analise}
                onCheckedChange={(v) => setDef({ ...def, somente_analise: v || undefined })}
              />
              <span>
                <b>Somente análise</b> <Dica id="met.somente_analise" />
                <span className="block text-xs text-muted-foreground">
                  Aparece no painel, nos relatórios e na TV, mas nunca entra em metas, nota, prêmios, comissão ou pontos (ex.: SUS).
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como calcular</CardTitle>
            <CardDescription>Escolha a fonte, a data que define em qual mês o registro conta e os filtros.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Tipo de cálculo</Label><Dica id="met.tipo_calculo" /></div>
                <NativeSelect value={def.tipo_calculo} onChange={(e) => mudarTipoCalculo(e.target.value as "simples" | "taxa")}>
                  <option value="simples">Contagem / soma</option>
                  <option value="taxa">Taxa (numerador ÷ denominador)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>No mês em andamento, contar até</Label><Dica id="met.corte" /></div>
                <NativeSelect value={def.corte ?? "hoje"} onChange={(e) => setDef({ ...def, corte: e.target.value as "hoje" | "ontem" })}>
                  <option value="hoje">Hoje (atualiza durante o dia)</option>
                  <option value="ontem">Ontem (só dias fechados)</option>
                </NativeSelect>
              </div>
            </div>
            {def.tipo_calculo === "simples" ? (
              <EditorContagem
                valor={def}
                onChange={(c) => setDef({ ...c, tipo_calculo: "simples", corte: def.corte, somente_analise: def.somente_analise })}
              />
            ) : (
              <>
                <EditorContagem titulo="Numerador" valor={def.numerador} onChange={(c) => setDef({ ...def, numerador: c })} />
                <EditorContagem titulo="Denominador" valor={def.denominador} onChange={(c) => setDef({ ...def, denominador: c })} />
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/metricas")}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || nome.trim().length < 2}>
            <Save /> Salvar métrica
          </Button>
        </div>
      </div>

      <Card className="h-fit xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5" /> Testar com dados reais
          </CardTitle>
          <CardDescription>Aplica esta definição (mesmo sem salvar) a todos os membros das equipes no mês.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input type="month" value={comp} onChange={(e) => setComp(e.target.value)} className="w-44" />
            <Button onClick={testar} disabled={testando}>
              {testando ? "Calculando…" : "Testar"}
            </Button>
          </div>
          {teste?.map((t) => (
            <div key={t.equipe} className="space-y-2">
              <Rotulo>{t.equipe}</Rotulo>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {t.linhas.map((l) => (
                    <TableRow key={l.nome}>
                      <TableCell>{l.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtValor(l.valor, unidade)}
                        {l.denominador !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({l.numerador}/{l.denominador})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{l.registros}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          {teste && teste.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma equipe ativa com membros.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
