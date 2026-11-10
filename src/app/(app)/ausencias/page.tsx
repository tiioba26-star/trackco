import { Trash2 } from "lucide-react";
import { CabecalhoPagina } from "@/components/app/blocos";
import { BotaoAcao, FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { datasEntre, formatarDataBR, hojeNoFuso, somarDias } from "@/engine/datas";
import { exigirGestaoOuLider } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lancarAusencia, removerAusencia } from "./actions";

export const metadata = { title: "Ausências" };

const TIPO: Record<string, string> = {
  ferias: "Férias",
  atestado: "Atestado",
  folga: "Folga",
  afastamento: "Afastamento",
  outro: "Outro",
};

export default async function PaginaAusencias() {
  const s = await exigirGestaoOuLider();
  const db = await criarClienteServidor();
  const desde = somarDias(hojeNoFuso(), -120);
  const [{ data: aus }, { data: pessoas }] = await Promise.all([
    db
      .from("ausencias")
      .select("id, colaborador_id, inicio, fim, tipo, observacao, colaboradores(nome)")
      .gte("fim", desde)
      .order("inicio", { ascending: false }),
    db.from("colaboradores").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  type A = { id: string; inicio: string; fim: string; tipo: string; observacao: string | null; colaboradores: { nome: string } | null };
  // pessoas que o usuário pode gerenciar: admin = todas; líder = a equipe (RLS já filtra a leitura)
  const gerenciaveis = (pessoas ?? []).filter((p) => s.ehAdmin || p.id !== s.colaborador.id);

  return (
    <div>
      <CabecalhoPagina
        titulo="Ausências"
        descricao="Férias, atestados e folgas reduzem a meta proporcionalmente aos dias úteis trabalhados. Lançadas pelo admin ou pelo líder da equipe."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Últimos 4 meses</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Dias corridos</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {((aus ?? []) as unknown as A[]).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.colaboradores?.nome}</TableCell>
                    <TableCell>{TIPO[a.tipo] ?? a.tipo}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatarDataBR(a.inicio)} → {formatarDataBR(a.fim)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{datasEntre(a.inicio, a.fim).length}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">{a.observacao ?? ""}</TableCell>
                    <TableCell>
                      <BotaoAcao
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remover ausência"
                        confirmar="Remover esta ausência? A meta volta a ser integral."
                        acao={removerAusencia.bind(null, a.id)}
                      >
                        <Trash2 />
                      </BotaoAcao>
                    </TableCell>
                  </TableRow>
                ))}
                {!aus?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma ausência lançada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="h-fit" data-tour="aus-form">
          <CardHeader>
            <CardTitle>Lançar ausência</CardTitle>
            <CardDescription>Ex.: 22 dias úteis no mês e 5 de férias → meta × 17/22.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormAcao acao={lancarAusencia} className="space-y-3" limpar>
              <div className="space-y-1.5">
                <Label>Pessoa</Label>
                <NativeSelect name="colaborador_id" required defaultValue="">
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {gerenciaveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <Input type="date" name="inicio" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Até</Label>
                  <Input type="date" name="fim" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <NativeSelect name="tipo" defaultValue="ferias">
                  {Object.entries(TIPO).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Input name="observacao" />
              </div>
              <Button type="submit" className="w-full">
                Lançar
              </Button>
            </FormAcao>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
