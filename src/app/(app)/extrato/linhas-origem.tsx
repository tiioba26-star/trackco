"use client";

import { MessageSquareWarning, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataBR } from "@/engine/datas";
import { ROTULO_SITUACAO } from "@/lib/situacao";
import { cn } from "@/lib/utils";
import { abrirContestacao } from "./actions";

export interface LinhaOrigem {
  chave: string;
  metrica_id: string;
  papel: string;
  data_agendado_em?: string | null;
  data_agendado_para?: string | null;
  data_realizacao?: string | null;
  paciente_nome?: string | null;
  procedimento?: string | null;
  profissional?: string | null;
  operadora?: string | null;
  responsavel_login?: string | null;
  atendido?: boolean | null;
  situacao?: string | null;
  motivo?: string | null;
  descricao?: string | null;
}


const PAPEL: Record<string, string> = { realizado: "conta", numerador: "numerador", denominador: "base" };

export function LinhasOrigem({
  linhas,
  metricas,
  competencia,
  podeContestar,
}: {
  linhas: LinhaOrigem[];
  metricas: { id: string; nome: string }[];
  competencia: string;
  podeContestar: boolean;
}) {
  const [filtro, setFiltro] = useState<string>(metricas[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [contestar, setContestar] = useState<{ metrica_id?: string; chave?: string; titulo: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return linhas
      .filter((l) => !filtro || l.metrica_id === filtro)
      .filter(
        (l) =>
          !b ||
          [l.paciente_nome, l.procedimento, l.profissional, l.operadora, l.responsavel_login, l.descricao]
            .some((v) => v?.toLowerCase().includes(b)),
      )
      .sort((a, b) => String(a.data_agendado_em ?? "").localeCompare(String(b.data_agendado_em ?? "")));
  }, [linhas, filtro, busca]);

  async function enviar() {
    setEnviando(true);
    const r = await abrirContestacao({
      competencia,
      metrica_id: contestar?.metrica_id ?? "",
      origem_chave: contestar?.chave ?? "",
      descricao: texto,
    });
    setEnviando(false);
    if (r.ok) {
      toast.success("Contestação enviada. O líder e o administrador vão analisar.");
      setContestar(null);
      setTexto("");
    } else {
      toast.error(r.erro ?? "Não foi possível enviar.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {metricas.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFiltro(m.id)}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                filtro === m.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {m.nome} <span className="opacity-70">({linhas.filter((l) => l.metrica_id === m.id).length})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente, procedimento…"
              className="pl-8 md:w-64"
            />
          </div>
          {podeContestar && (
            <Button
              variant="outline"
              data-tour="contestar"
              onClick={() => setContestar({ metrica_id: filtro, titulo: "Contestar um número deste mês" })}
            >
              <MessageSquareWarning /> Contestar
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agendado em</TableHead>
              <TableHead>Para</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Procedimento</TableHead>
              <TableHead className="hidden lg:table-cell">Profissional</TableHead>
              <TableHead>Operadora</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden md:table-cell">Papel</TableHead>
              {podeContestar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Nenhuma linha.
                </TableCell>
              </TableRow>
            )}
            {visiveis.slice(0, 500).map((l) => (
              <TableRow key={`${l.metrica_id}-${l.chave}-${l.papel}`}>
                <TableCell className="tabular-nums">{formatarDataBR(l.data_agendado_em)}</TableCell>
                <TableCell className="tabular-nums">{formatarDataBR(l.data_agendado_para)}</TableCell>
                <TableCell className="max-w-48 truncate">{l.paciente_nome ?? l.descricao ?? "—"}</TableCell>
                <TableCell className="max-w-48 truncate">{l.procedimento ?? "—"}</TableCell>
                <TableCell className="hidden max-w-40 truncate lg:table-cell">{l.profissional ?? "—"}</TableCell>
                <TableCell>{l.operadora ?? "—"}</TableCell>
                <TableCell>
                  {l.situacao && l.situacao !== "realizada" && ROTULO_SITUACAO[l.situacao] ? (
                    <span className={ROTULO_SITUACAO[l.situacao].c} title={l.motivo ?? undefined}>
                      {ROTULO_SITUACAO[l.situacao].t}
                      {!ROTULO_SITUACAO[l.situacao].conta && <span className="ml-1 text-[10px]">(fora do comparecimento)</span>}
                      {l.motivo && <span className="block text-[11px] text-muted-foreground">{l.motivo}</span>}
                    </span>
                  ) : l.atendido === true ? (
                    <span className="text-up">Realizada {l.data_realizacao ? formatarDataBR(l.data_realizacao) : ""}</span>
                  ) : l.atendido === false ? (
                    <span className="text-down">Não realizada</span>
                  ) : l.data_agendado_em !== undefined ? (
                    <span className="text-muted-foreground">Pendente</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{PAPEL[l.papel] ?? l.papel}</TableCell>
                {podeContestar && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Contestar esta linha"
                      onClick={() =>
                        setContestar({
                          metrica_id: l.metrica_id,
                          chave: l.chave,
                          titulo: `Contestar: ${l.paciente_nome ?? "linha"} (${formatarDataBR(l.data_agendado_em)})`,
                        })
                      }
                    >
                      <MessageSquareWarning />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {visiveis.length > 500 && (
        <p className="text-xs text-muted-foreground">Mostrando 500 de {visiveis.length}. Use a busca para filtrar.</p>
      )}

      <Dialog open={!!contestar} onOpenChange={(o) => !o && setContestar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contestar?.titulo}</DialogTitle>
            <DialogDescription>
              Explique o que está errado. Ex.: &quot;Agendei a paciente Maria em 05/11 e não aparece&quot; ou &quot;Esta consulta foi
              agendada por outra pessoa&quot;.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder="Descreva a divergência…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setContestar(null)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={enviando || texto.trim().length < 5}>
              Enviar contestação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
