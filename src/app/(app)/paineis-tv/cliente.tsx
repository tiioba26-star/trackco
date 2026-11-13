"use client";

import { ChevronDown, ChevronUp, Copy, ExternalLink, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";
import { BLOCOS_TV, type ConfigTv, normalizarConfig, segundosDoBloco } from "@/lib/tv-config";
import { atualizarPainel, criarPainel, excluirPainel, regenerarToken } from "./actions";

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
            <Copy className="size-4" /> Copiar
          </Button>
          <Button render={<a href={url} target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-4" /> Abrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROTULO_PERIODO: Record<PeriodoRapido, string> = {
  hoje: "Hoje",
  semana: "Últimos 7 dias (hoje e os 6 dias antes)",
  mes: "Mês atual até agora",
  mes_passado: "Mês passado",
};

/** Tipos de tela e períodos. Cada tipo vira uma tela por período (ou uma por pessoa). */
function ListaModos({ config }: { config?: ConfigTv }) {
  const cfg = normalizarConfig(config);
  const blocos = cfg.modos.map((m) => m.bloco);
  return (
    <>
      <div className="space-y-1.5">
        <Label>Telas (alternam nesta ordem) e quanto tempo cada uma fica</Label>
        {BLOCOS_TV.map((b) => (
          <div key={b.bloco} className="flex items-start justify-between gap-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="blocos" value={b.bloco} defaultChecked={blocos.includes(b.bloco)} className="mt-1" />
              <span>
                {b.rotulo}
                <span className="block text-xs text-muted-foreground">{b.descricao}</span>
              </span>
            </label>
            <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Segundos que cada tela deste tipo fica na TV">
              <Input
                type="number"
                name={`tempo_${b.bloco}`}
                defaultValue={segundosDoBloco(cfg, b.bloco)}
                min={5}
                max={300}
                className="h-7 w-16 px-1.5 text-right text-xs"
                aria-label={`Segundos de cada tela: ${b.rotulo}`}
              />
              s
            </label>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label>Períodos</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {PERIODOS_RAPIDOS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="periodos" value={p} defaultChecked={cfg.periodos!.includes(p)} /> {ROTULO_PERIODO[p]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Cada tipo vira uma tela por período (a tela por pessoa vira uma por pessoa). Na TV: ← → trocam de tela e a barra de espaço
          pausa.
        </p>
      </div>
    </>
  );
}

export function NovoPainel({ equipes }: { equipes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [mostrarTextos, setMostrarTextos] = useState(false);

  return (
    <>
      <form
        className="space-y-4"
        action={(fd) =>
          iniciar(async () => {
            const r = await criarPainel(fd);
            if (r.ok && r.token) {
              setToken(r.token);
              toast.success("Painel criado com sucesso!");
              router.refresh();
            } else toast.error(r.erro);
          })
        }
      >
        <div className="space-y-1.5">
          <Label>Nome do Painel</Label>
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
        <ListaModos />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>😊 a partir de</Label>
            <Input type="number" name="feliz" defaultValue={80} />
          </div>
          <div className="space-y-1.5">
            <Label>🤩 a partir de</Label>
            <Input type="number" name="mega_feliz" defaultValue={100} />
          </div>
        </div>

        {/* Seção retrátil para personalizar textos da TV */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setMostrarTextos((prev) => !prev)}
            className="flex w-full items-center justify-between text-xs font-semibold text-primary hover:underline"
          >
            <span>Personalizar Frases e Textos da TV</span>
            {mostrarTextos ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {mostrarTextos && (
            <div className="mt-3 space-y-3 rounded-lg border bg-muted/40 p-3">
              <div className="space-y-1">
                <Label className="text-xs">Frases do Rodapé (uma por linha)</Label>
                <Textarea
                  name="frases_rodape"
                  rows={3}
                  className="text-xs font-sans"
                  placeholder="Grandes conquistas começam com uma equipe unida.&#10;Cada agendamento aproxima a nossa equipe da superação."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Subtítulos do Topo (um por linha)</Label>
                <Textarea
                  name="subtitulos"
                  rows={2}
                  className="text-xs font-sans"
                  placeholder="Ritmo contínuo, consistência e excelência em cada atendimento&#10;Evolução diária da equipe rumo à superação de metas"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagens de Meta Batida (uma por linha)</Label>
                <Textarea
                  name="msg_meta_batida"
                  rows={2}
                  className="text-xs font-sans"
                  placeholder="Meta batida! 🎯&#10;Excelente resultado! ⭐"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagens de Incentivo / Vamos lá (uma por linha)</Label>
                <Textarea
                  name="msg_evoluindo"
                  rows={2}
                  className="text-xs font-sans"
                  placeholder="Vamos lá! 💪&#10;Estamos evoluindo!&#10;Seguimos crescendo!"
                />
              </div>
            </div>
          )}
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

export function EditarPainel({
  painel,
  equipes,
}: {
  painel: {
    id: string;
    nome: string;
    equipes: string[];
    config: ConfigTv;
  };
  equipes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();

  const cfg = painel.config;

  const frasesRodapeTexto = (cfg.frases_rodape ?? []).join("\n");
  const subtitulosTexto = (cfg.subtitulos ?? []).join("\n");
  const msgMetaBatida = (cfg.mensagens_barra?.meta_batida ?? []).join("\n");
  const msgQuaseLa = (cfg.mensagens_barra?.quase_la ?? []).join("\n");
  const msgEvoluindo = (cfg.mensagens_barra?.evoluindo ?? []).join("\n");

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Pencil className="size-3.5" /> Editar
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Editar Painel de TV</DialogTitle>
            <DialogDescription>
              Ajuste as equipes, limites e personalize os textos que aparecem no topo, rodapé e dentro das barras da TV.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            action={(fd) =>
              iniciar(async () => {
                const r = await atualizarPainel(painel.id, fd);
                if (r.ok) {
                  toast.success(r.mensagem ?? "Painel atualizado!");
                  setAberto(false);
                  router.refresh();
                } else {
                  toast.error(r.erro);
                }
              })
            }
          >
            <div className="space-y-1.5">
              <Label>Nome do Painel</Label>
              <Input name="nome" defaultValue={painel.nome} required />
            </div>

            <div className="space-y-1.5">
              <Label>Equipes</Label>
              {equipes.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="equipes"
                    value={e.id}
                    defaultChecked={painel.equipes.includes(e.id)}
                  />
                  {e.nome}
                </label>
              ))}
            </div>

            <ListaModos config={painel.config} />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>😊 a partir de</Label>
                <Input type="number" name="feliz" defaultValue={cfg.limites?.feliz ?? 80} />
              </div>
              <div className="space-y-1.5">
                <Label>🤩 a partir de</Label>
                <Input type="number" name="mega_feliz" defaultValue={cfg.limites?.mega_feliz ?? 100} />
              </div>
            </div>

            {/* Configuração de Textos da TV */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3.5">
              <div className="text-xs font-semibold text-primary">Textos Personalizados da TV</div>

              <div className="space-y-1">
                <Label className="text-xs">Frases do Rodapé (uma por linha)</Label>
                <Textarea
                  name="frases_rodape"
                  rows={3}
                  className="text-xs font-sans"
                  defaultValue={frasesRodapeTexto}
                  placeholder="Grandes conquistas começam com uma equipe unida.&#10;Cada agendamento aproxima a nossa equipe da superação."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Subtítulos do Topo (um por linha)</Label>
                <Textarea
                  name="subtitulos"
                  rows={2}
                  className="text-xs font-sans"
                  defaultValue={subtitulosTexto}
                  placeholder="Ritmo contínuo, consistência e excelência em cada atendimento&#10;Evolução diária da equipe rumo à superação de metas"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagens de Meta Batida (uma por linha)</Label>
                <Textarea
                  name="msg_meta_batida"
                  rows={2}
                  className="text-xs font-sans"
                  defaultValue={msgMetaBatida}
                  placeholder="Meta batida! 🎯&#10;Excelente resultado! ⭐"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagens de Quase Lá / Falta Pouco (uma por linha)</Label>
                <Textarea
                  name="msg_quase_la"
                  rows={2}
                  className="text-xs font-sans"
                  defaultValue={msgQuaseLa}
                  placeholder="Falta pouco! 🔥&#10;Na reta final!"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagens de Incentivo / Vamos lá (uma por linha)</Label>
                <Textarea
                  name="msg_evoluindo"
                  rows={2}
                  className="text-xs font-sans"
                  defaultValue={msgEvoluindo}
                  placeholder="Vamos lá! 💪&#10;Estamos evoluindo!&#10;Seguimos crescendo!"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pendente}>
                {pendente ? "Salvando…" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ExcluirPainel({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setAberto(true)}>
        <Trash2 className="size-3.5" /> Excluir
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => !pendente && setAberto(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir o painel &quot;{nome}&quot;?</DialogTitle>
            <DialogDescription>
              O link para de funcionar na hora e o painel some da lista. Isso não pode ser desfeito. Se quiser só pausar, use
              &quot;Desativar&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pendente} onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await excluirPainel(id);
                  if (r.ok) {
                    toast.success(r.mensagem ?? "Painel excluído.");
                    setAberto(false);
                    router.refresh();
                  } else toast.error(r.erro);
                })
              }
            >
              {pendente ? "Excluindo…" : "Excluir painel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <KeyRound className="size-3.5" /> Novo link
      </Button>
      <MostrarLink token={token} onClose={() => setToken(null)} />
    </>
  );
}
