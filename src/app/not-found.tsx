import { SearchX } from "lucide-react";
import Link from "next/link";
import { Vazio } from "@/components/app/blocos";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Página não encontrada" };

/** Endereço que não existe no Trackco. */
export default function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <Logo />
      <Vazio
        icone={SearchX}
        titulo="Esta página não existe"
        texto="Confira o endereço ou volte para o início."
        acao={
          <Link href="/" className={buttonVariants({ className: "mt-2" })}>
            Ir para o Trackco
          </Link>
        }
      />
    </main>
  );
}
