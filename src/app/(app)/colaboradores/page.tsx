import { Campo } from "@/components/ui/campo";
import { JanelaFormulario } from "@/components/app/janela-formulario";
import { CabecalhoPagina } from "@/components/app/blocos";
import { FormAcao } from "@/components/app/form-acao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { titulo } from "@/engine/classificacao";
import { hojeNoFuso, somarDias } from "@/engine/datas";
import { diaMes } from "@/engine/periodos";
import { exigirGestaoOuLider } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarColaborador } from "./actions";
import { AniversariosDaEquipe, nascimentos } from "./aniversarios";
import { TabelaColaboradores, type LinhaColab } from "./tabela";

export const metadata = { title: "Colaboradores" };

export default async function PaginaColaboradores() {
  const s = await exigirGestaoOuLider();
  // líder (e gestor) só lança aniversários; o resto da tela é do administrador (o somente leitura vê, não altera)
  if (!s.veComoAdmin) return <AniversariosDaEquipe s={s} />;
  const db = await criarClienteServidor();
  const hoje = hojeNoFuso();
  const [{ data }, { data: klingo }, nasc, { data: recentes }] = await Promise.all([
    // "*" traz a coluna acesso quando a migração 18 já foi aplicada
    db.from("colaboradores").select("*, equipe_membros(fim, funcao, equipes(nome))").order("nome"),
    db.from("klingo_usuarios").select("login, nome").order("nome"),
    nascimentos(),
    db.rpc("logins_klingo_sem_vinculo", { p_desde: somarDias(hoje, -90) }),
  ]);
  type C = {
    id: string;
    nome: string;
    login: string | null;
    login_klingo: string | null;
    papel: string;
    ativo: boolean;
    acesso?: boolean;
    auth_id: string | null;
    equipe_membros: { fim: string | null; funcao: string; equipes: { nome: string } | null }[];
  };
  const colabs = (data ?? []) as unknown as C[];
  const marcacoes = new Map(((recentes ?? []) as { login: string; agendamentos: number }[]).map((r) => [r.login.toLowerCase(), Number(r.agendamentos)]));

  const doTrackco: LinhaColab[] = colabs.map((c) => ({
    chave: c.id,
    id: c.id,
    nome: c.nome,
    login: c.login,
    loginKlingo: c.login_klingo,
    papel: c.papel,
    ativo: c.ativo,
    temLogin: !!c.auth_id,
    acesso: !!c.auth_id && c.acesso !== false,
    equipes: c.equipe_membros
      .filter((m) => !m.fim || m.fim >= hoje)
      .map((m) => `${m.equipes?.nome}${m.funcao === "lider" ? " (líder)" : ""}`)
      .join(", "),
    aniversario: nasc?.get(c.id) ? diaMes(nasc.get(c.id)!) : null,
    nascimento: nasc ? (nasc.get(c.id) ?? "") : null,
    marcacoes90: 0,
  }));
  const cadastrados = new Set(colabs.map((c) => (c.login_klingo ?? "").toLowerCase()).filter(Boolean));
  const soNoKlingo: LinhaColab[] = (klingo ?? [])
    .filter((k) => !cadastrados.has(k.login.toLowerCase()))
    .map((k) => ({
      chave: `klingo:${k.login}`,
      id: null,
      nome: titulo(k.nome),
      login: null,
      loginKlingo: k.login,
      papel: "colaborador",
      ativo: true,
      temLogin: false,
      acesso: false,
      equipes: "",
      aniversario: null,
      nascimento: null,
      marcacoes90: marcacoes.get(k.login.toLowerCase()) ?? 0,
    }));
  // quem está no Trackco primeiro; depois quem está só no Klingo, quem marcou mais recentemente primeiro
  const linhas = [
    ...doTrackco.sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR")),
    ...soNoKlingo.sort((a, b) => b.marcacoes90 - a.marcacoes90 || a.nome.localeCompare(b.nome, "pt-BR")),
  ];

  return (
    <div>
      <CabecalhoPagina
        titulo="Colaboradores"
        descricao="Todo mundo da clínica: quem está no Trackco e quem está só no Klingo. O botão deslizante decide quem pode entrar no Trackco; sem acesso, a pessoa continua nas equipes, nos relatórios e na Gestão."
        acoes={
          s.ehAdmin ? (
            <span data-tour="colab-novo">
              <JanelaFormulario
                rotulo="Pessoa de fora do Klingo"
                titulo="Pessoa de fora do Klingo"
                descricao="Quem está no Klingo já aparece na tabela. Use aqui para quem não usa o Klingo (ex.: tráfego pago, contador)."
              >
                <FormAcao acao={criarColaborador} className="space-y-5" limpar sucesso="Pessoa adicionada.">
                  <Campo rotulo="Nome completo" htmlFor="n-nome">
                    <Input id="n-nome" name="nome" required />
                  </Campo>
                  <Campo rotulo="Usuário de acesso" htmlFor="n-login" dica="colab.usuario">
                    <Input id="n-login" name="login" required autoCapitalize="none" placeholder="ex.: maria.souza" />
                  </Campo>
                  <Campo rotulo="Perfil" htmlFor="n-papel" dica="colab.perfil">
                    <NativeSelect id="n-papel" name="papel" defaultValue="leitura">
                      <option value="leitura">Somente leitura</option>
                      <option value="admin">Administrador</option>
                      <option value="gestor">Gestor</option>
                      <option value="colaborador">Colaborador</option>
                    </NativeSelect>
                  </Campo>
                  <Campo rotulo="Senha inicial (mínimo 8 caracteres)" htmlFor="n-senha">
                    <Input id="n-senha" name="senha" type="password" autoComplete="new-password" minLength={8} />
                  </Campo>
                  <Button type="submit" className="w-full">
                    Adicionar
                  </Button>
                </FormAcao>
              </JanelaFormulario>
            </span>
          ) : undefined
        }
      />
      {!nasc && (
        <p className="mb-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Para guardar os aniversários, falta uma atualização do banco.
          <details className="mt-1 text-xs [&_summary]:cursor-pointer">
            <summary>Detalhes técnicos</summary>
            Aplicar a migração <code>20261115000013_trackco_aniversarios.sql</code> no SQL Editor do Supabase.
          </details>
        </p>
      )}
      <datalist id="logins-klingo">
        {(klingo ?? []).map((k) => (
          <option key={k.login} value={k.login}>
            {k.nome}
          </option>
        ))}
      </datalist>
      {/* a tabela usa a largura toda: com o formulário ao lado, as colunas de acesso e edição ficavam fora da tela */}
      <Card data-tour="colab-lista">
        <CardContent>
          <TabelaColaboradores linhas={linhas} podeAlterar={s.ehAdmin} meuId={s.colaborador.id} />
        </CardContent>
      </Card>
    </div>
  );
}
