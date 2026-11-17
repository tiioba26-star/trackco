import { CabecalhoPagina } from "@/components/app/blocos";
import { Card, CardContent } from "@/components/ui/card";
import { exigirSessao } from "@/lib/auth";
import { FormSenha } from "./form-senha";

export const metadata = { title: "Trocar senha" };

export default async function PaginaTrocarSenha() {
  await exigirSessao();
  return (
    <div className="max-w-md">
      <CabecalhoPagina
        titulo="Trocar senha"
        descricao="Escolha uma senha nova com pelo menos 8 caracteres."
      />
      <Card>
        <CardContent>
          <FormSenha />
        </CardContent>
      </Card>
    </div>
  );
}
