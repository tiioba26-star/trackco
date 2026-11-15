import "server-only";
import {
  type CuriosidadesDoNascimento,
  type VersiculoAniversario,
  aniversarioNoAno,
  curiosidadesDoNascimento,
  dataPorExtenso,
  diaDaSemanaCurto,
  fatoDoAnoNoAniversario,
  mensagemDeParabens,
  parabensPendente,
  ultimoAniversario,
  versiculoDeAniversario,
} from "@/engine/aniversario";
import { inicioCompetencia, somarDias } from "@/engine/datas";
import { diaMes } from "@/engine/periodos";
import type { Sessao } from "@/lib/auth";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Aniversários. A data de nascimento fica em colaboradores.nascimento (migração 13); se a migração
// ainda não foi aplicada, tudo aqui devolve "nada" e o resto do site segue normal.

type Admin = ReturnType<typeof criarClienteAdmin>;

export interface Parabens {
  /** o aniversário que está sendo comemorado (deste ano) */
  aniversario: string;
  /** a pessoa abriu o site no próprio dia */
  ehHoje: boolean;
  primeiroNome: string;
  mensagem: string;
  versiculo: VersiculoAniversario;
  nascimento: CuriosidadesDoNascimento & { porExtenso: string; ano: number };
  /** consultas e exames realizados nos últimos 12 meses que a pessoa marcou (null se não marca no Klingo) */
  atendimentos: number | null;
}

export interface Aniversariante {
  nome: string;
  /** aniversário deste ano */
  data: string;
  /** "12/11" */
  dia: string;
  /** "qui" */
  semana: string;
}

const primeiroNome = (nome: string) => nome.split(" ")[0];
const doisNomes = (nome: string) => nome.split(" ").slice(0, 2).join(" ");

/** Posição fixa da pessoa entre todos os cadastros: com ela, pessoas diferentes recebem textos diferentes no mesmo ano. */
async function posicaoDe(admin: Admin, id: string): Promise<number> {
  const { data } = await admin.from("colaboradores").select("id").order("id");
  const i = (data ?? []).findIndex((c) => c.id === id);
  return i < 0 ? 0 : i;
}

async function nascimentoDe(admin: Admin, id: string): Promise<string | null> {
  const { data, error } = await admin.from("colaboradores").select("nascimento").eq("id", id).maybeSingle();
  if (error || !data?.nascimento) return null;
  return String(data.nascimento).slice(0, 10);
}

/** Aniversário que ainda falta parabenizar (no dia ou na primeira visita depois dele). */
async function aniversarioPendente(admin: Admin, s: Sessao, hoje: string): Promise<{ nascimento: string; aniversario: string } | null> {
  const nascimento = await nascimentoDe(admin, s.colaborador.id);
  if (!nascimento) return null;
  const { data: vistos, error } = await admin
    .from("parabens_vistos")
    .select("aniversario")
    .eq("colaborador_id", s.colaborador.id)
    .order("aniversario", { ascending: false })
    .limit(1);
  if (error) return null;
  const aniversario = parabensPendente(nascimento, vistos?.[0]?.aniversario ? String(vistos[0].aniversario) : null, hoje);
  return aniversario ? { nascimento, aniversario } : null;
}

/**
 * Monta os parabéns de um aniversário. A mensagem, o versículo e o fato do ano dependem só da pessoa
 * e do ano do aniversário: quem revê ou quem vê a prévia enxerga exatamente o mesmo.
 */
async function montarParabens(
  admin: Admin,
  pessoa: { id: string; nome: string; login_klingo: string | null },
  nascimento: string,
  aniversario: string,
  hoje: string,
): Promise<Parabens> {
  const ano = Number(aniversario.slice(0, 4));
  // dias de vida até hoje; numa prévia (aniversário ainda por vir), até o dia do aniversário
  const referencia = aniversario > hoje ? aniversario : hoje;
  const login = pessoa.login_klingo?.toLowerCase();
  const [posicao, atendimentos] = await Promise.all([
    posicaoDe(admin, pessoa.id),
    login
      ? admin
          .from("klingo_agendamentos")
          .select("chave", { count: "exact", head: true })
          .eq("responsavel_login", login)
          .eq("atendido", true)
          .gte("data_realizacao", somarDias(hoje, -365))
          .lte("data_realizacao", hoje)
          .then((r) => (r.error ? null : (r.count ?? 0)))
      : Promise.resolve(null),
  ]);
  const nome = primeiroNome(pessoa.nome);
  return {
    aniversario,
    ehHoje: aniversario === hoje,
    primeiroNome: nome,
    mensagem: mensagemDeParabens(nome, posicao, ano),
    versiculo: versiculoDeAniversario(posicao, ano),
    nascimento: {
      ...curiosidadesDoNascimento(nascimento, referencia),
      fatoDoAno: fatoDoAnoNoAniversario(Number(nascimento.slice(0, 4)), ano, posicao),
      porExtenso: dataPorExtenso(nascimento),
      ano: Number(nascimento.slice(0, 4)),
    },
    atendimentos,
  };
}

/** Os parabéns do dia, se ainda não foram vistos (abrem sozinhos). */
export async function parabensDoDia(s: Sessao, hoje: string): Promise<Parabens | null> {
  const admin = criarClienteAdmin();
  const p = await aniversarioPendente(admin, s, hoje);
  if (!p) return null;
  return montarParabens(admin, s.colaborador, p.nascimento, p.aniversario, hoje);
}

/** Os parabéns do último aniversário da própria pessoa, para rever quantas vezes quiser. */
export async function meusParabens(s: Sessao, hoje: string): Promise<Parabens | null> {
  const admin = criarClienteAdmin();
  const nascimento = await nascimentoDe(admin, s.colaborador.id);
  if (!nascimento) return null;
  return montarParabens(admin, s.colaborador, nascimento, ultimoAniversario(nascimento, hoje), hoje);
}

/**
 * Prévia dos parabéns que a pessoa vai receber no próximo aniversário. Só para administrador,
 * gestor ou o líder de uma equipe em que a pessoa está.
 */
export async function previaDosParabens(s: Sessao, id: string, hoje: string): Promise<Parabens | null> {
  const admin = criarClienteAdmin();
  if (!s.vêTudo) {
    const { data } = await admin.from("equipe_membros").select("equipe_id, fim").eq("colaborador_id", id);
    const lidera = (data ?? []).some((m) => (!m.fim || String(m.fim) >= hoje) && s.lidera.includes(String(m.equipe_id)));
    if (!lidera) throw new Error("Você só pode ver os parabéns de quem está na sua equipe.");
  }
  const { data: pessoa, error } = await admin.from("colaboradores").select("id, nome, login_klingo, nascimento").eq("id", id).maybeSingle();
  if (error || !pessoa?.nascimento) return null;
  const nascimento = String(pessoa.nascimento).slice(0, 10);
  const ano = Number(hoje.slice(0, 4));
  const deste = aniversarioNoAno(nascimento, ano);
  const proximo = deste >= hoje ? deste : aniversarioNoAno(nascimento, ano + 1);
  return montarParabens(
    admin,
    { id: String(pessoa.id), nome: String(pessoa.nome), login_klingo: pessoa.login_klingo ? String(pessoa.login_klingo) : null },
    nascimento,
    proximo,
    hoje,
  );
}

/** Guarda que a pessoa viu os parabéns (o aniversário vem do servidor, nunca do navegador). */
export async function marcarParabensVistos(s: Sessao, hoje: string): Promise<void> {
  const admin = criarClienteAdmin();
  const p = await aniversarioPendente(admin, s, hoje);
  if (!p) return;
  const { error } = await admin.from("parabens_vistos").upsert({ colaborador_id: s.colaborador.id, aniversario: p.aniversario });
  if (error) throw new Error(error.message);
}

/**
 * Aniversariantes do mês: o líder vê os das equipes que lidera; administrador e gestor veem todos.
 * Só dia e mês (a idade não aparece).
 */
export async function aniversariantesDoMes(admin: Admin, s: Sessao, comp: string): Promise<Aniversariante[]> {
  let ids: string[] | null = null;
  if (!s.vêTudo) {
    if (!s.lidera.length) return [];
    const { data } = await admin.from("equipe_membros").select("colaborador_id, fim").in("equipe_id", s.lidera);
    ids = Array.from(new Set((data ?? []).filter((m) => !m.fim || String(m.fim) >= inicioCompetencia(comp)).map((m) => String(m.colaborador_id))));
    if (!ids.length) return [];
  }
  let q = admin.from("colaboradores").select("id, nome, nascimento").eq("ativo", true).not("nascimento", "is", null);
  if (ids) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) return [];
  const ano = Number(comp.slice(0, 4));
  const mes = comp.slice(5, 7);
  return (data ?? [])
    .filter((c) => String(c.nascimento).slice(5, 7) === mes)
    .map((c) => {
      const d = aniversarioNoAno(String(c.nascimento), ano);
      return { nome: doisNomes(String(c.nome)), data: d, dia: diaMes(d), semana: diaDaSemanaCurto(d) };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Para a retrospectiva pessoal: o aniversário caiu no mês que ela resume? (mensagem diferente da dos parabéns do dia) */
export async function aniversarioNoMes(admin: Admin, s: Sessao, comp: string): Promise<{ dia: string; mensagem: string } | null> {
  const nascimento = await nascimentoDe(admin, s.colaborador.id);
  if (!nascimento || nascimento.slice(5, 7) !== comp.slice(5, 7)) return null;
  const ano = Number(comp.slice(0, 4));
  const posicao = await posicaoDe(admin, s.colaborador.id);
  return {
    dia: dataPorExtenso(aniversarioNoAno(nascimento, ano), false),
    mensagem: mensagemDeParabens(primeiroNome(s.colaborador.nome), posicao, ano, 17),
  };
}
