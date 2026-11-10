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
        descricao="Seu login é compartilhado com o sistema de relatórios da IOBA: a nova senha vale nos dois."
      />
      <Card>
        <CardContent>
          <FormSenha />
        </CardContent>
      </Card>
    </div>
  );
}
