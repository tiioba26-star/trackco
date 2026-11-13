"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MODELOS } from "@/lib/formularios";
import { alternarFormulario, excluirFormulario } from "./actions";

export function NovoFormulario() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button onClick={() => setAberto(true)} data-tour="form-novo">
        <Plus className="size-4" /> Novo formulário
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Começar de um modelo</DialogTitle>
            <DialogDescription>Os modelos já vêm com perguntas baseadas em pesquisa. Você pode mudar tudo antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {MODELOS.map((m) => (
              <Link
                key={m.id}
                href={`/formularios/novo?modelo=${m.id}`}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/60"
                onClick={() => setAberto(false)}
              >
                <div className="font-medium">{m.titulo}</div>
                <div className="text-xs text-muted-foreground">{m.resumo}</div>
                <div className="mt-1 text-xs">{m.porque}</div>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LigarFormulario({ id, ativo }: { id: string; ativo: boolean }) {
  const [valor, setValor] = useState(ativo);
  const [, iniciar] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={valor}
        onCheckedChange={(v) => {
          setValor(v);
          iniciar(async () => {
            const r = await alternarFormulario(id, v);
            if (!r.ok) {
              setValor(!v);
              toast.error(r.erro ?? "Não foi possível mudar.");
            } else toast.success(v ? "Ligado: aparece para quem ainda não respondeu a rodada aberta." : "Desligado: não aparece para ninguém.");
          });
        }}
      />
      {valor ? "Ligado" : "Desligado"}
    </label>
  );
}

export function ExcluirFormulario({ id, titulo, respostas }: { id: string; titulo: string; respostas: number }) {
  const [aberto, setAberto] = useState(false);
  const [excluindo, iniciar] = useTransition();
  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAberto(true)}>
        <Trash2 className="size-3.5" /> Excluir
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir “{titulo}”?</DialogTitle>
            <DialogDescription>
              {respostas > 0
                ? `As ${respostas} respostas já recebidas também serão apagadas. Para só parar de pedir, desligue em vez de excluir.`
                : "Ainda não há respostas. Isto não pode ser desfeito."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={excluindo}
              onClick={() =>
                iniciar(async () => {
                  const r = await excluirFormulario(id);
                  if (!r.ok) return void toast.error(r.erro ?? "Não foi possível excluir.");
                  toast.success("Formulário excluído.");
                  setAberto(false);
                })
              }
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
