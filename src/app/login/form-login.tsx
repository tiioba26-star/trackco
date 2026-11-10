"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, { erro: erroInicial });
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="usuario">Usuário</Label>
        <Input id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" required autoFocus className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required className="h-10" />
      </div>
      {estado.erro && (
        <Alert variant="destructive">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
