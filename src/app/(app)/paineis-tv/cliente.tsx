"use client";

import { Copy, ExternalLink, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarPainel, regenerarToken } from "./actions";

function MostrarLink({ token, onClose }: { token: string | null; onClose: () => void }) {
  const url = token ? `${window.location.origin}/tv/${token}` : "";
  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link do painel</DialogTitle>
          <DialogDescription>
            Copie agora: por segurança, este link não é mostrado de novo. Abra-o no navegador da TV (sem login).
          </DialogDescription>
        </DialogHeader>
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            }}
          >
            <Copy /> Copiar
          </Button>
          <Button render={<a href={url} target="_blank" rel="noreferrer" />}>
            <ExternalLink /> Abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MODOS = [
  ["agendamentos", "Barras · Agendamentos (quantitativo)"],
  ["realizadas", "Barras · Consultas realizadas (qualitativo)"],
  ["agendamentos_sus", "Barras · SUS"],
  ["geral", "Dashboard geral da equipe"],
] as const;

export function NovoPainel({ equipes }: { equipes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <form
        className="space-y-4"
        action={(fd) =>
          iniciar(async () => {
            const r = await criarPainel(fd);
            if (r.ok && r.token) {
              setToken(r.token);
              router.refresh();
            } else toast.error(r.erro);
          })
        }
      >
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input name="nome" placeholder="TV da recepção comercial" required />
        </div>
        <div className="space-y-1.5">
          <Label>Equipes</Label>
          {equipes.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="equipes" value={e.id} defaultChecked={equipes.length === 1} /> {e.nome}
            </label>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label>Modos (alternam na ordem)</Label>
          {MODOS.map(([v, t]) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="modos" value={v} defaultChecked /> {t}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>Troca a cada (s)</Label>
            <Input type="number" name="intervalo" defaultValue={30} min={10} max={300} />
          </div>
          <div className="space-y-1.5">
            <Label>😊 a partir de</Label>
            <Input type="number" name="feliz" defaultValue={80} />
          </div>
          <div className="space-y-1.5">
            <Label>🤩 a partir de</Label>
            <Input type="number" name="mega_feliz" defaultValue={100} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Abaixo do limite &quot;feliz&quot; a carinha fica neutra. Nunca aparece carinha triste, nome, foto, iniciais, valores de
          comissão ou pontos.
        </p>
        <Button type="submit" className="w-full" disabled={pendente}>
          Criar painel e gerar link
        </Button>
      </form>
      <MostrarLink token={token} onClose={() => setToken(null)} />
    </>
  );
}

export function RegenerarLink({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() => {
          if (!confirm("Gerar um novo link? O link atual deixa de funcionar.")) return;
          iniciar(async () => {
            const r = await regenerarToken(id);
            if (r.ok && r.token) setToken(r.token);
            else toast.error(r.erro);
          });
        }}
      >
        <KeyRound /> Novo link
      </Button>
      <MostrarLink token={token} onClose={() => setToken(null)} />
    </>
  );
}
