import { RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina, StatusPill } from "@/components/app/blocos";
import { BotaoAcao, FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataBR, hojeNoFuso, somarDias } from "@/engine/datas";
import { exigirAdmin } from "@/lib/auth";
import { fmtDataHora } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { competenciaDe } from "@/engine/datas";
import { excluirLancamento, importarCsv, lancar, recalcularAgora } from "./actions";
import { RecalcularPeriodo } from "./recalcular-periodo";
import { Dica } from "@/components/ajuda/dica";

export const metadata = { title: "Dados e lançamentos" };

export default async function PaginaDados() {
  await exigirAdmin();
  const db = await criarClienteServidor();
  const hoje = hojeNoFuso();
  const [{ data: syncs }, { data: semVinculo }, { data: lancs }, { data: pessoas }, { count: totalLinhas }] = await Promise.all([
    db.from("sync_execucoes").select("*").order("iniciado_em", { ascending: false }).limit(15),
    db.rpc("logins_klingo_sem_vinculo", { p_desde: somarDias(hoje, -90) }),
    db
      .from("lancamentos")
      .select("id, data, tipo, valor, descricao, colaboradores!lancamentos_colaborador_id_fkey(nome)")
      .order("data", { ascending: false })
      .limit(30),
    db.from("colaboradores").select("id, nome").eq("ativo", true).order("nome"),
    db.from("klingo_agendamentos").select("chave", { count: "estimated", head: true }),
  ]);
  type S = {
    id: number;
    modo: string;
    iniciado_em: string;
    finalizado_em: string | null;
    status: string;
    linhas_agendamentos: number;
    linhas_atendimentos: number;
    mensagem: string | null;
  };
  type L = { id: string; data: string; tipo: string; valor: number; descricao: string | null; colaboradores: { nome: string } | null };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Dados e lançamentos"
        descricao={`Fonte principal: Klingo (relatórios 2331 e 319), sincronizado de hora em hora em horário comercial. ${totalLinhas ?? 0} agendamentos na base.`}
        acoes={
          <BotaoAcao acao={recalcularAgora} sucesso="Recalculado." data-tour="dados-recalc">
            <RefreshCw /> Recalcular agora
          </BotaoAcao>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card data-tour="dados-sync">
          <CardHeader>
            <CardTitle>Sincronizações com o Klingo</CardTitle>
            <CardDescription>Rodam pelo GitHub Actions. Uma falha não apaga dados: a próxima execução completa o que faltou.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Agend.</TableHead>
                  <TableHead className="text-right">Cruzados</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((syncs ?? []) as S[]).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="tabular-nums">{fmtDataHora(s.iniciado_em)}</TableCell>
                    <TableCell className="text-muted-foreground">{s.modo}</TableCell>
                    <TableCell>
                      <StatusPill status={s.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.linhas_agendamentos}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.linhas_atendimentos}</TableCell>
                    <TableCell className="max-w-72 truncate text-xs text-muted-foreground" title={s.mensagem ?? ""}>
                      {s.mensagem}
                    </TableCell>
                  </TableRow>
                ))}
                {!syncs?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      O robô ainda não rodou. Veja o README para configurar o GitHub Actions.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logins do Klingo sem vínculo (90 dias)</CardTitle>
            <CardDescription>
              Agendamentos desses logins não são atribuídos a ninguém. Se for alguém de uma equipe, ligue o login em{" "}
              <Link href="/colaboradores" className="text-primary underline">
                Colaboradores
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Login</TableHead>
                  <TableHead>Nome no Klingo</TableHead>
                  <TableHead className="text-right">Agend.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((semVinculo ?? []) as { login: string; nome: string | null; agendamentos: number }[]).map((l) => (
                  <TableRow key={l.login}>
                    <TableCell className="font-mono text-xs">{l.login}</TableCell>
                    <TableCell>{l.nome ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.agendamentos}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recalcular um período</CardTitle>
          <CardDescription>Gera as apurações mês a mês (ex.: todo o histórico desde jan/2025).</CardDescription>
        </CardHeader>
        <CardContent>
          <RecalcularPeriodo atual={competenciaDe(hoje)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]" data-tour="dados-lanc">
        <Card>
          <CardHeader>
            <CardTitle>Lançamentos manuais recentes</CardTitle>
            <CardDescription>
              Usados por métricas da fonte &quot;Lançamentos&quot; (ex.: <code>avaliacao_lider</code>, nota de 0 a 10 do líder).
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {((lancs ?? []) as unknown as L[]).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="tabular-nums">{formatarDataBR(l.data)}</TableCell>
                    <TableCell>{l.colaboradores?.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{l.tipo}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.valor}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">{l.descricao}</TableCell>
                    <TableCell>
                      <BotaoAcao
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir lançamento"
                        confirmar="Excluir este lançamento?"
                        acao={excluirLancamento.bind(null, l.id)}
                      >
                        <Trash2 />
                      </BotaoAcao>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Novo lançamento</CardTitle>
            </CardHeader>
            <CardContent>
              <FormAcao acao={lancar} className="space-y-3" limpar>
                <div className="space-y-1.5">
                  <Label>Pessoa</Label>
                  <NativeSelect name="colaborador_id" required defaultValue="">
                    <option value="" disabled>
                      Escolha…
                    </option>
                    {(pessoas ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input type="date" name="data" defaultValue={hoje} required />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1"><Label>Valor</Label><Dica id="lanc.valor" /></div>
                    <Input name="valor" inputMode="decimal" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1"><Label>Tipo</Label><Dica id="lanc.tipo" /></div>
                  <Input name="tipo" defaultValue="avaliacao_lider" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input name="descricao" />
                </div>
                <Button type="submit" className="w-full">
                  Lançar
                </Button>
              </FormAcao>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Importar CSV</CardTitle>
              <CardDescription>
                Uma linha por registro: <code>login;data;tipo;valor;descricao</code>. Serve para equipes sem sistema (ex.: checklist
                da limpeza).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormAcao acao={importarCsv} className="space-y-3" limpar>
                <Textarea name="csv" rows={5} placeholder={"maria.souza;10/11/2026;checklist_limpeza;1;Sala 3"} />
                <Button type="submit" variant="outline" className="w-full">
                  Importar
                </Button>
              </FormAcao>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
