import { WifiOff } from "lucide-react";
import { RodapeVersiculo } from "@/components/app/versiculo";
import { Logo } from "@/components/logo";

export const metadata = { title: "Sem conexão" };

export default function PaginaOffline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <WifiOff className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Sem conexão</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        O Trackco precisa de internet para mostrar seus números atualizados. Assim que a conexão voltar, recarregue a página.
      </p>
      <RodapeVersiculo className="mt-8" />
    </main>
  );
}
