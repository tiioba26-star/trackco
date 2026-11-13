import "server-only";
import { competenciaAnterior, competenciaDe, fimCompetencia, inicioCompetencia } from "@/engine/datas";
import { destaquesDoMes } from "@/engine/destaques";
import { nomeMes, textoDatas } from "@/engine/periodos";
import type { Metrica } from "@/engine/tipos";
import type { Sessao } from "@/lib/auth";
import { membrosDaEquipe } from "@/lib/calculo/carregar";
import { minhasApuracoes } from "@/lib/dados/painel";
import { linhasDasPessoas, regrasDaCategoria } from "@/lib/dados/producao";
import { recordesDe } from "@/lib/dados/rotina";
import { metricaPorPapel } from "@/lib/metricas-papel";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// "Retrospectiva do mês" (no estilo das retrospectivas de fim de ano): o mês anterior fica disponível
// o mês inteiro. Atendente vê a dela; líder e admin veem a da equipe (com nomes).

export interface NumerosMes {
  validos: number;
  total: number;
  validosAnt: number;
  crescimento: number | null;
  taxa: number | null;
  taxaAnt: number | null;
  /** "qua, 14/10" */
  melhorDia: { dia: string; valor: number } | null;
}

export interface Retrospectiva {
  tipo: "pessoa" | "equipe";
  comp: string;
  mes: string;
  mesAnterior: string;
  mesAtual: string;
  primeiroNome: string;
  equipeNome: string;
  equipe: NumerosMes & { pessoas: number };
  eu?: NumerosMes & {
    parteDaEquipe: number | null;
    recordeDia: boolean;
    recordeMes: boolean;
    conquistas: string[];
    nivel: { nome: string; cor: string | null; nota: number | null } | null;
    metaAtual: number | null;
  };
  /** só na da equipe */
  destaques?: { titulo: string; nome: string; valor: string; detalhe: string }[];
  metaBatida?: string[];
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dia = (d: { dia: string; valor: number } | null, ano: string) => (d ? { dia: textoDatas(d.dia, d.dia, ano), valor: d.valor } : null);

export async function carregarRetrospectiva(s: Sessao, hoje: string): Promise<Retrospectiva | null> {
  const mesAtual = competenciaDe(hoje);
  const comp = competenciaAnterior(mesAtual);
  const compAnt = competenciaAnterior(comp);
  const admin = criarClienteAdmin();

  const membroDe = s.equipes.find((e) => e.funcao === "membro");
  let equipe: { id: string; nome: string } | null = membroDe ? { id: membroDe.equipe_id, nome: membroDe.nome } : null;
  if (!equipe) {
    const lider = s.equipes.find((e) => e.funcao === "lider");
    if (lider) equipe = { id: lider.equipe_id, nome: lider.nome };
    else if (s.vêTudo) {
      const { data } = await admin.from("equipes").select("id, nome").eq("ativo", true).order("nome").limit(1).maybeSingle();
      if (data) equipe = { id: String(data.id), nome: String(data.nome) };
    }
  }
  if (!equipe) return null;

  const { data: metricasRows } = await admin.from("metricas").select("id, codigo, nome, tipo, unidade, definicao, ativo").eq("ativo", true);
  const metricas = (metricasRows ?? []) as Metrica[];
  const regras = regrasDaCategoria(metricas, "particular");
  if (!regras) return null;

  const membros = (await membrosDaEquipe(admin, equipe.id, comp)).filter((m) => m.funcao === "membro");
  const ids = membros.map((m) => m.colaborador_id);
  const linhas = await linhasDasPessoas(
    admin,
    membros.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo })),
    inicioCompetencia(compAnt),
    fimCompetencia(comp),
  );
  const d = destaquesDoMes(linhas, regras, ids, comp, compAnt, hoje);
  const ano = hoje.slice(0, 4);
  const base: Retrospectiva = {
    tipo: membroDe ? "pessoa" : "equipe",
    comp,
    mes: nomeMes(comp),
    mesAnterior: nomeMes(compAnt),
    mesAtual: nomeMes(mesAtual),
    primeiroNome: s.colaborador.nome.split(" ")[0],
    equipeNome: equipe.nome,
    equipe: { ...d.equipe, melhorDia: dia(d.equipe.melhorDia, ano), pessoas: ids.length },
  };

  if (membroDe) {
    const p = d.pessoas.find((x) => x.id === s.colaborador.id);
    if (!p) return base;
    // filtros sempre pelo próprio colaborador da sessão (nunca vindo do navegador)
    const db = admin;
    const validosMetrica = metricaPorPapel(metricas, "agendamentos_validos");
    const totalMetrica = metricaPorPapel(metricas, "agendamentos");
    const [rec, aps, { data: metas }] = await Promise.all([
      recordesDe(db, s, metricas, fimCompetencia(comp)).catch(() => null),
      minhasApuracoes(db, s.colaborador.id, comp),
      db
        .from("metas")
        .select("metrica_id, valor")
        .eq("colaborador_id", s.colaborador.id)
        .eq("competencia", inicioCompetencia(mesAtual))
        .in("metrica_id", [validosMetrica?.id, totalMetrica?.id].filter(Boolean) as string[]),
    ]);
    const ap = aps.find((a) => a.funcao === "membro");
    const recordeMes = !!rec?.melhorMes && rec.melhorMes.comp === comp && p.validos > 0;
    const recordeDia = !!rec?.melhorDia && competenciaDe(rec.melhorDia.dia) === comp;
    const conquistas = [
      d.vencedores.volume === p.id && "Mais agendamentos válidos da equipe",
      d.vencedores.melhorou === p.id && "Quem mais melhorou na equipe",
      d.vencedores.comparecimento === p.id && "Melhor comparecimento da equipe",
      recordeMes && "Seu melhor mês dos últimos 12",
      recordeDia && "Recorde pessoal de um dia",
      (ap?.nota ?? 0) >= 100 && "Meta do mês batida",
    ].filter((x): x is string => !!x);
    const meta = (metas ?? []).find((m) => m.metrica_id === validosMetrica?.id) ?? (metas ?? [])[0];
    base.eu = {
      ...p,
      melhorDia: dia(p.melhorDia, ano),
      parteDaEquipe: d.equipe.validos ? Math.round((p.validos / d.equipe.validos) * 1000) / 10 : null,
      recordeDia,
      recordeMes,
      conquistas,
      nivel: ap ? { nome: ap.resultado.faixa?.nivel ?? ap.nivel ?? "—", cor: ap.resultado.faixa?.cor ?? null, nota: ap.nota } : null,
      metaAtual: meta ? Number(meta.valor) : null,
    };
    return base;
  }

  // líder / admin: destaques com nomes e quem bateu a meta
  const { data: pessoas } = await admin.from("colaboradores").select("id, nome").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nome = (id: string | null) => (pessoas ?? []).find((x) => x.id === id)?.nome?.split(" ").slice(0, 2).join(" ") ?? "—";
  const porId = (id: string | null) => d.pessoas.find((x) => x.id === id);
  const destaques: NonNullable<Retrospectiva["destaques"]> = [];
  const v = porId(d.vencedores.volume);
  if (v) destaques.push({ titulo: "Mais agendamentos válidos", nome: nome(v.id), valor: String(v.validos), detalhe: `${v.total} marcações no total` });
  const m = porId(d.vencedores.melhorou);
  if (m && m.crescimento !== null) destaques.push({ titulo: "Quem mais melhorou", nome: nome(m.id), valor: `+${pct(m.crescimento)}`, detalhe: `${m.validos} contra ${m.validosAnt}` });
  const c = porId(d.vencedores.comparecimento);
  if (c && c.taxa !== null) destaques.push({ titulo: "Melhor comparecimento", nome: nome(c.id), valor: pct(c.taxa), detalhe: "dos pacientes vieram" });
  const { data: aps } = await admin.from("apuracoes").select("colaborador_id, nota, tipo").eq("competencia", inicioCompetencia(comp)).in("colaborador_id", ids);
  const bateram = Array.from(new Set((aps ?? []).filter((a) => Number(a.nota ?? 0) >= 100).map((a) => String(a.colaborador_id))));
  return { ...base, destaques, metaBatida: bateram.map(nome) };
}
