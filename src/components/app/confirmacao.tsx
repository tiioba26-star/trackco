"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OpcoesConfirmar = {
  /** a pergunta, curta: "Ativar este plano?" */
  titulo: string;
  /** a consequência, em uma ou duas frases */
  texto?: ReactNode;
  /** rótulo do botão de confirmar (padrão "Confirmar") */
  confirmar?: string;
  /** ação que apaga, desliga ou não tem volta: botão vermelho */
  perigo?: boolean;
};

export type OpcoesPedirValor = OpcoesConfirmar & { rotulo: string; tipo?: "text" | "number"; inicial?: string };

type Pendente =
  | { tipo: "confirmar"; o: OpcoesConfirmar; fim: (ok: boolean) => void }
  | { tipo: "valor"; o: OpcoesPedirValor; fim: (v: string | null) => void };

type Api = {
  confirmar: (o: OpcoesConfirmar | string) => Promise<boolean>;
  pedirValor: (o: OpcoesPedirValor) => Promise<string | null>;
};

const Ctx = createContext<Api | null>(null);

/**
 * Caixa de confirmação do próprio sistema (no lugar do `window.confirm` do navegador):
 * segue o tema, fica igual em todo celular e diz a consequência antes de agir.
 */
export function ProvedorConfirmacao({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Pendente | null>(null);
  const [valor, setValor] = useState("");
  const atual = useRef<Pendente | null>(null);

  const abrir = useCallback((novo: Pendente) => {
    // uma caixa por vez: se outra estava aberta, ela conta como cancelada
    const antes = atual.current;
    if (antes?.tipo === "confirmar") antes.fim(false);
    else if (antes) antes.fim(null);
    atual.current = novo;
    setP(novo);
  }, []);

  const api = useMemo<Api>(
    () => ({
      confirmar: (o) => new Promise<boolean>((fim) => abrir({ tipo: "confirmar", o: typeof o === "string" ? { titulo: o } : o, fim })),
      pedirValor: (o) =>
        new Promise<string | null>((fim) => {
          setValor(o.inicial ?? "");
          abrir({ tipo: "valor", o, fim });
        }),
    }),
    [abrir],
  );

  const fechar = (ok: boolean) => {
    const x = atual.current;
    atual.current = null;
    setP(null);
    if (!x) return;
    if (x.tipo === "confirmar") x.fim(ok);
    else x.fim(ok ? valor : null);
  };

  const o = p?.o;
  return (
    <Ctx.Provider value={api}>
      {children}
      <AlertDialog open={!!p} onOpenChange={(aberto) => !aberto && fechar(false)}>
        <AlertDialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              fechar(true);
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{o?.titulo}</AlertDialogTitle>
              {o?.texto && <AlertDialogDescription>{o.texto}</AlertDialogDescription>}
            </AlertDialogHeader>
            {p?.tipo === "valor" && (
              <div className="space-y-2">
                <Label htmlFor="confirmacao-valor">{p.o.rotulo}</Label>
                <Input id="confirmacao-valor" type={p.o.tipo ?? "text"} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus required />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" variant={o?.perigo ? "destructive" : "default"}>
                {o?.confirmar ?? "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

/** `await confirmar({ titulo, texto })` → true se a pessoa confirmou. Sem provedor, cai no confirm do navegador. */
export function useConfirmar() {
  const api = useContext(Ctx);
  return api?.confirmar ?? (async (o: OpcoesConfirmar | string) => window.confirm(typeof o === "string" ? o : o.titulo));
}

/** `await pedirValor({ titulo, rotulo })` → o texto digitado, ou null se cancelou. */
export function usePedirValor() {
  const api = useContext(Ctx);
  return api?.pedirValor ?? (async (o: OpcoesPedirValor) => window.prompt(o.rotulo, o.inicial ?? ""));
}

// ------------------------------------------------------------------ somente leitura

const Leitura = createContext(false);

/** Liga o modo "somente leitura" nas telas: botões de alterar ficam desativados. */
export function ProvedorLeitura({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return <Leitura.Provider value={ativo}>{children}</Leitura.Provider>;
}

export const useSomenteLeitura = () => useContext(Leitura);
export const DICA_LEITURA = "Somente leitura: peça a um administrador para alterar.";
