import { SearchX } from "lucide-react";
import Link from "next/link";
import { Vazio } from "@/components/app/blocos";
import { buttonVariants } from "@/components/ui/button";

/** Item que não existe (ou foi apagado) dentro do sistema: menu continua visível. */
export default function NaoEncontradoNoSistema() {
  return (
    <Vazio
      icone={SearchX}
      className="my-10"
      titulo="Não encontramos o que você procurou"
      texto="Talvez tenha sido apagado ou o link esteja incompleto. Use o menu ou volte ao Painel."
      acao={
        <Link href="/" className={buttonVariants({ className: "mt-2" })}>
          Voltar ao Painel
        </Link>
      }
    />
  );
}
