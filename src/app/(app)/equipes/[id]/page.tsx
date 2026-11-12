import { notFound } from "next/navigation";
import { CabecalhoPagina, NivelBadge } from "@/components/app/blocos";
import { BotaoAcao, FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarDataBR, hojeNoFuso } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { adicionarMembro, alterarVinculo, salvarEquipe } from "../actions";
import { Dica } from "@/components/ajuda/dica";

export const metadata = { title: "Equipe" };

const DIAS = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [7, "Dom"],
] as const;

export default async function PaginaEquipe(props: PageProps<"/equipes/[id]">) {
  await exigirAdmin();
  const { id } = await props.params;
  const db = await criarClienteServidor();
  const [{ data: e }, { data: vinculos }, { data: colabs }] = await Promise.all([
    db.from("equipes").select("*").eq("id", id).maybeSingle(),
    db
      .from("equipe_membros")
      .select("id, funcao, inicio, fim, colaborador_id, colaboradores(nome, login_klingo)")
      .eq("equipe_id", id)
      .order("fim", { ascending: false, nullsFirst: true })
      .order("funcao"),
    db.from("colaboradores").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  if (!e) notFound();
  const hoje = hojeNoFuso();
  type V = {
    id: string;
    funcao: "lider" | "membro";
    inicio: string;
    fim: string | null;
    colaborador_id: string;
    colaboradores: { nome: string; login_klingo: string | null } | null;
  };
  const lista = (vinculos ?? []) as unknown as V[];
  const ativos = new Set(lista.filter((v) => !v.fim || v.fim >= hoje).map((v) => v.colaborador_id));
  const salvar = salvarEquipe.bind(null, id);
  const adicionar = adicionarMembro.bind(null, id);

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo={`Equipe ${e.nome}`} descricao="Membros, líder e regras de visibilidade e fechamento." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Membros</CardTitle>
            <CardDescription>O líder é avaliado pelo resultado do conjunto (indicadores de escopo equipe no plano).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((v) => {
                    const ativo = !v.fim || v.fim >= hoje;
                    return (
                      <TableRow key={v.id} className={ativo ? "" : "opacity-50"}>
                        <TableCell>
                          <div className="font-medium">{v.colaboradores?.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            Klingo: {v.colaboradores?.login_klingo ?? <span className="text-down">sem login</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <NivelBadge nivel={v.funcao === "lider" ? "Líder" : "Membro"} cor={v.funcao === "lider" ? "#f59e0b" : undefined} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatarDataBR(v.inicio)} → {v.fim ? formatarDataBR(v.fim) : "atual"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ativo && (
                            <div className="flex justify-end gap-1">
                              <BotaoAcao
                                size="sm"
                                variant="outline"
                                acao={alterarVinculo.bind(null, id, v.id, { funcao: v.funcao === "lider" ? "membro" : "lider" })}
                              >
                                {v.funcao === "lider" ? "Tornar membro" : "Tornar líder"}
                              </BotaoAcao>
                              <BotaoAcao
                                size="sm"
                                variant="ghost"
                                confirmar="Encerrar o vínculo hoje? O histórico é mantido."
                                acao={alterarVinculo.bind(null, id, v.id, { encerrar: true })}
                              >
                                Encerrar
                              </BotaoAcao>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <FormAcao acao={adicionar} className="grid items-end gap-3 rounded-xl border p-3 md:grid-cols-[1.5fr_1fr_1fr_auto]" limpar>
              <div className="space-y-1.5">
                <Label>Adicionar pessoa</Label>
                <NativeSelect name="colaborador_id" required defaultValue="">
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {(colabs ?? [])
                    .filter((c) => !ativos.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Função</Label>
                <NativeSelect name="funcao" defaultValue="membro">
                  <option value="membro">Membro</option>
                  <option value="lider">Líder</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="date" name="inicio" defaultValue={hoje} required />
              </div>
              <Button type="submit">Adicionar</Button>
            </FormAcao>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
          </CardHeader>
          <CardContent>
            <FormAcao acao={salvar} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input name="nome" defaultValue={e.nome} required />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input name="descricao" defaultValue={e.descricao ?? ""} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>O que cada membro vê dos colegas</Label><Dica id="eq.visibilidade" /></div>
                <NativeSelect name="visibilidade_ranking" defaultValue={e.visibilidade_ranking}>
                  <option value="aberto">Ranking aberto (nomes e números)</option>
                  <option value="posicoes">Só posições e níveis (sem números dos colegas)</option>
                  <option value="privado">Privado (cada um vê só o seu)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Dias de trabalho (para dias úteis e meta proporcional)</Label><Dica id="eq.dias" /></div>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map(([n, t]) => (
                    <label key={n} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm">
                      <input type="checkbox" name="dias_trabalho" value={n} defaultChecked={e.dias_trabalho.includes(n)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Etapas do fechamento</Label><Dica id="eq.etapas" /></div>
                <div className="space-y-1.5 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="etapas" value="contestacao" defaultChecked={e.etapas_aprovacao.includes("contestacao")} />
                    Prazo de contestação dos colaboradores
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="etapas" value="lider" defaultChecked={e.etapas_aprovacao.includes("lider")} />
                    Conferência do líder
                  </label>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" name="etapas" value="admin" defaultChecked disabled />
                    Aprovação do admin (obrigatória)
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1"><Label>Prazo de contestação (dias)</Label><Dica id="eq.prazo" /></div>
                <Input type="number" name="prazo_contestacao_dias" min={0} max={31} defaultValue={e.prazo_contestacao_dias} className="w-28" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ativo" defaultChecked={e.ativo} /> Equipe ativa
              </label>
              <Button type="submit">Salvar configuração</Button>
            </FormAcao>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
