"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, { erro: erroInicial });
  const [verSenha, setVerSenha] = useState(false);
  // some durante a tentativa e volta com o resultado: o aviso remonta e o leitor de tela anuncia de novo,
  // mesmo quando o erro se repete
  const erro = pendente ? undefined : estado.erro;
  const invalido = erro ? true : undefined;
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="usuario">Usuário</Label>
        <Input
          id="usuario"
          name="usuario"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
          className="h-10"
          aria-invalid={invalido}
          aria-describedby={erro ? "erro-login" : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <Input
            id="senha"
            name="senha"
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-10 pr-10"
            aria-invalid={invalido}
            aria-describedby={erro ? "erro-login" : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
            aria-pressed={verSenha}
            aria-controls="senha"
          >
            {verSenha ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>
      {erro && (
        <Alert id="erro-login" variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
