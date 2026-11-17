"use client";

import { ChevronDown, ChevronUp, Copy, Ellipsis, ExternalLink, Eye, Gamepad2, KeyRound, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { avisarNavegacao } from "@/components/app/indicador-navegacao";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pilula } from "@/components/ui/pilula";
import { Textarea } from "@/components/ui/textarea";
import { PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";
import { BLOCOS_TV, type ConfigTv, normalizarConfig, segundosDoBloco } from "@/lib/tv-config";
import { useConfirmar, useSomenteLeitura } from "@/components/app/confirmacao";
import { FormAcao } from "@/components/app/form-acao";
import { atualizarPainel, criarPainel, excluirPainel, guardarLinkAtual, regenerarToken, verLinkPainel } from "./actions";
import { Campo } from "@/components/ui/campo";

function MostrarLink({ token, onClose }: { token: string | null; onClose: () => void }) {
  const url = token ? `${window.location.origin}/tv/${token}` : "";
  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link do painel</DialogTitle>
          <DialogDescription>
            Abra no navegador da TV (sem login). Você pode ver este link de novo quando quiser em “Ver link”, sem que a TV pare.
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
      <Campo rotulo="Telas (alternam nesta ordem) e quanto tempo cada uma fica">
        {BLOCOS_TV.map((b) => (
          <div key={b.bloco} className="flex items-start justify-between gap-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox name="blocos" value={b.bloco} defaultChecked={blocos.includes(b.bloco)} className="mt-0.5" />
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
      </Campo>
      <Campo
          rotulo="Períodos"
          dicaTexto="Cada tipo de tela vira uma tela por período (a tela por pessoa vira uma por pessoa). Na TV, as setas ← → trocam de tela e a barra de espaço pausa."
        >
        <div className="flex flex-wrap gap-2">
          {PERIODOS_RAPIDOS.map((p) => (
            <Pilula key={p} name="periodos" value={p} defaultChecked={cfg.periodos!.includes(p)}>
              {ROTULO_PERIODO[p]}
            </Pilula>
          ))}
        </div>
      </Campo>
    </>
  );
}

/** Campos do painel, iguais ao criar e ao editar (antes eram dois formulários diferentes). */
function CamposPainel({ equipes, painel }: { equipes: { id: string; nome: string }[]; painel?: { nome: string; equipes: string[]; config: ConfigTv } }) {
  const [mostrarTextos, setMostrarTextos] = useState(false);
  const cfg = painel?.config;
  const linhas = (v?: string[]) => (v ?? []).join("\n");
  const textos: { name: string; rotulo: string; valor: string; exemplo: string; linhas: number }[] = [
    { name: "frases_rodape", rotulo: "Frases do rodapé", valor: linhas(cfg?.frases_rodape), exemplo: "Grandes conquistas começam com uma equipe unida.\nCada agendamento aproxima a nossa equipe da superação.", linhas: 3 },
    { name: "subtitulos", rotulo: "Subtítulos do topo", valor: linhas(cfg?.subtitulos), exemplo: "Ritmo contínuo, consistência e excelência em cada atendimento", linhas: 2 },
    { name: "msg_meta_batida", rotulo: "Na barra, quando bate a meta", valor: linhas(cfg?.mensagens_barra?.meta_batida), exemplo: "Meta batida! 🎯\nExcelente resultado! ⭐", linhas: 2 },
    { name: "msg_quase_la", rotulo: "Na barra, quando falta pouco", valor: linhas(cfg?.mensagens_barra?.quase_la), exemplo: "Falta pouco! 🔥\nNa reta final!", linhas: 2 },
    { name: "msg_evoluindo", rotulo: "Na barra, para incentivar", valor: linhas(cfg?.mensagens_barra?.evoluindo), exemplo: "Vamos lá! 💪\nEstamos evoluindo!", linhas: 2 },
  ];
  return (
    <>
      <Campo rotulo="Nome do painel">
        <Input name="nome" defaultValue={painel?.nome} placeholder="TV da recepção comercial" required />
      </Campo>
      <Campo rotulo="Equipes">
        {equipes.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm">
            <Checkbox name="equipes" value={e.id} defaultChecked={painel ? painel.equipes.includes(e.id) : equipes.length === 1} /> {e.nome}
          </label>
        ))}
      </Campo>
      <ListaModos config={cfg} />
      <div className="grid grid-cols-2 gap-x-2 gap-y-5">
        <Campo
          rotulo="😊 a partir de"
          ajuda="% da meta"
          dicaTexto="Quem chega a esta % da meta ganha a carinha feliz. Abaixo dela a carinha fica neutra. Nunca aparece carinha triste, nome, foto, iniciais, valores de comissão ou pontos."
        >
          <Input type="number" name="feliz" min={0} max={300} defaultValue={cfg?.limites?.feliz ?? 80} />
        </Campo>
        <Campo rotulo="🤩 a partir de" ajuda="% da meta" dicaTexto="Quem chega a esta % da meta ganha a carinha de festa.">
          <Input type="number" name="mega_feliz" min={0} max={300} defaultValue={cfg?.limites?.mega_feliz ?? 100} />
        </Campo>
      </div>
      <div className="border-t pt-3">
        <button
          type="button"
          onClick={() => setMostrarTextos((v) => !v)}
          aria-expanded={mostrarTextos}
          className="flex w-full items-center justify-between text-sm font-semibold text-primary hover:underline"
        >
          <span>Textos que aparecem na TV (opcional)</span>
          {mostrarTextos ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {/* recolhido, mas sempre no formulário: se sumisse, salvar apagaria os textos personalizados */}
        <div hidden={!mostrarTextos} className="mt-3 space-y-5 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Um texto por linha; eles se alternam na TV. Vazio = textos padrão.</p>
          {textos.map((t) => (
            <Campo key={t.name} rotulo={t.rotulo}>
              <Textarea name={t.name} rows={t.linhas} className="font-sans text-xs" defaultValue={t.valor} placeholder={t.exemplo} />
            </Campo>
          ))}
        </div>
      </div>
    </>
  );
}

export function NovoPainel({ equipes }: { equipes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const leitura = useSomenteLeitura();

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
        <CamposPainel equipes={equipes} />

        <Button type="submit" className="w-full" disabled={pendente || leitura}>
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
  const [sujo, setSujo] = useState(false);
  const confirmar = useConfirmar();
  const leitura = useSomenteLeitura();

  // fechar o diálogo com alterações perde tudo: pergunta antes
  async function mudarAberto(o: boolean) {
    if (o) setSujo(false);
    else if (sujo && !pendente) {
      const sair = await confirmar({
        titulo: "Fechar sem salvar?",
        texto: "As alterações deste painel ainda não foram salvas e vão se perder.",
        confirmar: "Fechar sem salvar",
        perigo: true,
      });
      if (!sair) return;
    }
    setAberto(o);
  }



  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void mudarAberto(true)} disabled={leitura}>
        <Pencil className="size-3.5" /> Editar
      </Button>

      <Dialog open={aberto} onOpenChange={(o) => void mudarAberto(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Editar Painel de TV</DialogTitle>
            <DialogDescription>
              Ajuste as equipes, limites e personalize os textos que aparecem no topo, rodapé e dentro das barras da TV.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onChange={() => setSujo(true)}
            onClickCapture={(e) => {
              // caixas de marcar do kit não disparam "change" no formulário
              if ((e.target as Element).closest("[role=checkbox],[role=switch]")) setSujo(true);
            }}
            action={(fd) =>
              iniciar(async () => {
                const r = await atualizarPainel(painel.id, fd);
                if (r.ok) {
                  toast.success(r.mensagem ?? "Painel atualizado!");
                  setSujo(false);
                  setAberto(false);
                  router.refresh();
                } else {
                  toast.error(r.erro);
                }
              })
            }
          >
            <CamposPainel equipes={equipes} painel={painel} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void mudarAberto(false)}>
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

/** Mostra o link atual sem trocar (a TV continua no ar). */
export function VerLink({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [colar, setColar] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await verLinkPainel(id);
            if (r.ok && r.token) setToken(r.token);
            else if (r.semLink) setColar(true);
            else toast.error(r.erro);
          })
        }
      >
        <Eye className="size-3.5" /> Ver link
      </Button>
      <MostrarLink token={token} onClose={() => setToken(null)} />
      <Dialog open={colar} onOpenChange={setColar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar o link que já está na TV</DialogTitle>
            <DialogDescription>
              Este painel foi criado antes de o Trackco guardar os links. Cole uma vez o link que está aberto na TV: o sistema
              confere se é o deste painel e, daqui em diante, mostra ele sempre aqui. A TV não muda nada. Se não tiver mais o link,
              use “Novo link” (aí o link antigo para de funcionar).
            </DialogDescription>
          </DialogHeader>
          <FormAcao
            acao={async (fd) => {
              const r = await guardarLinkAtual(id, fd);
              if (r.ok && r.token) {
                setColar(false);
                setToken(r.token);
              }
              return r;
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`link-${id}`}>Link da TV</Label>
              <Input id={`link-${id}`} name="link" placeholder="https://trackco.ioba.com.br/tv/…" className="font-mono text-xs" required />
            </div>
            <Button type="submit">Guardar</Button>
          </FormAcao>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RegenerarLink({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const confirmar = useConfirmar();
  const leitura = useSomenteLeitura();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pendente || leitura}
        onClick={async () => {
          if (
            !(await confirmar({
              titulo: "Gerar um novo link?",
              texto: "O link atual deixa de funcionar: a TV que usa ele precisa receber o novo.",
              confirmar: "Gerar novo link",
              perigo: true,
            }))
          )
            return;
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

/** Abre o controle remoto da TV: janelinha no PC, a própria tela no celular. */
export function BotaoControle({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      data-tour="tv-controle"
      onClick={() => {
        const url = `/controle-tv/${id}`;
        const pc = window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;
        const janela = pc ? window.open(url, `controle-${id}`, "popup,width=420,height=760") : null;
        if (!janela) {
          avisarNavegacao();
          router.push(url);
        }
      }}
    >
      <Gamepad2 className="size-4" /> Controle remoto
    </Button>
  );
}

/**
 * "Mais": as ações menos usadas de cada painel (ver link, novo link, ativar/desativar, excluir) abrem na própria linha.
 * Não é um menu flutuante porque as caixas de "Ver link" e "Excluir" vivem dentro desses botões.
 */
export function MaisAcoes({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
        <Ellipsis className="size-3.5" /> {aberto ? "Menos" : "Mais"}
      </Button>
      {aberto && <div className="flex w-full flex-wrap items-center gap-2 border-t pt-2 md:w-auto md:border-t-0 md:pt-0">{children}</div>}
    </>
  );
}
