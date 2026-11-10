"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { responderContestacao } from "./actions";

export function Responder({
  id,
  metricaId,
  metricas,
  ehAdmin,
}: {
  id: string;
  metricaId: string | null;
  metricas: { id: string; nome: string }[];
  ehAdmin: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [decisao, setDecisao] = useState<"aceita" | "recusada" | "em_analise">("aceita");
  const [resposta, setResposta] = useState("");
  const [delta, setDelta] = useState("");
  const [metrica, setMetrica] = useState(metricaId ?? metricas[0]?.id ?? "");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const n = delta.trim() ? Number(delta.replace(",", ".")) : undefined;
    const r = await responderContestacao({
      id,
      decisao,
      resposta,
      delta: decisao === "aceita" && n ? n : undefined,
      metrica_id: metrica || undefined,
    });
    setEnviando(false);
    if (r.ok) {
      toast.success("Resposta registrada.");
      setAberto(false);
    } else toast.error(r.erro ?? "Falha ao responder.");
  }

  return (
    <>
      <Button size="sm" onClick={() => setAberto(true)}>
        Responder
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder contestação</DialogTitle>
            <DialogDescription>A resposta fica visível para o colaborador e registrada na auditoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
              {(
                [
                  ["aceita", "Aceitar"],
                  ["em_analise", "Em análise"],
                  ["recusada", "Recusar"],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDecisao(v)}
                  className={`rounded-md py-1.5 text-sm ${decisao === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {decisao === "aceita" && ehAdmin && (
              <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ajuste (+/-) opcional</Label>
                  <Input inputMode="decimal" placeholder="ex.: 1 ou -1" value={delta} onChange={(e) => setDelta(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Na métrica</Label>
                  <NativeSelect value={metrica} onChange={(e) => setMetrica(e.target.value)}>
                    {metricas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  O ajuste entra no cálculo do mês com a sua resposta como justificativa. Se o erro for do Klingo, corrija lá e
                  aguarde a próxima sincronização em vez de ajustar.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Resposta</Label>
              <Textarea rows={4} value={resposta} onChange={(e) => setResposta(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={enviando || resposta.trim().length < 3}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
