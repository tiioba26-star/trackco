import "server-only";
import { apurarEquipe } from "@/engine/apuracao";
import { competenciaAnterior, competenciaDe, hojeNoFuso, inicioCompetencia } from "@/engine/datas";
import type { ResultadoApuracao } from "@/engine/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { equipesAtivas, montarEntrada } from "./carregar";

export interface ResumoRecalculo {
  competencia: string;
  equipes: { equipe: string; pessoas: number; plano: string | null }[];
}

function fonteDaMetrica(def: unknown): string {
  const d = def as { tipo_calculo?: string; fonte?: string; numerador?: { fonte: string } };
  return d?.tipo_calculo === "taxa" ? (d.numerador?.fonte ?? "klingo_agendamentos") : (d?.fonte ?? "klingo_agendamentos");
}

async function gravar(
  resultados: ResultadoApuracao[],
  tipo: "parcial" | "final",
  fechamentoId: string | null,
  fontes: Record<string, string>,
) {
  const db = criarClienteAdmin();
  if (!resultados.length) return;
  const competencia = inicioCompetencia(resultados[0].competencia);
  const equipeId = resultados[0].equipe_id;

  const linhas = resultados.map((r) => {
    const { itens: _itens, ...resultado } = r;
    return {
      tipo,
      fechamento_id: fechamentoId,
      equipe_id: r.equipe_id,
      colaborador_id: r.colaborador_id,
      competencia,
      funcao: r.funcao,
      plano_versao_id: r.plano_versao_id,
      nota: r.nota_pct,
      nivel: r.faixa?.nivel ?? null,
      resultado,
      calculado_em: new Date().toISOString(),
    };
  });
  const { data: salvos, error } = await db
    .from("apuracoes")
    .upsert(linhas, { onConflict: "tipo,equipe_id,colaborador_id,competencia" })
    .select("id, colaborador_id");
  if (error) throw new Error(`Falha ao gravar apurações: ${error.message}`);

  const idPorColab = new Map((salvos ?? []).map((s) => [s.colaborador_id as string, s.id as string]));
  const ids = Array.from(idPorColab.values());

  // remove apurações de quem saiu da equipe nessa competência
  await db
    .from("apuracoes")
    .delete()
    .eq("tipo", tipo)
    .eq("equipe_id", equipeId)
    .eq("competencia", competencia)
    .not("colaborador_id", "in", `(${Array.from(idPorColab.keys()).join(",")})`);

  const del = await db.from("apuracao_itens").delete().in("apuracao_id", ids);
  if (del.error) throw new Error(`Falha ao limpar memorial: ${del.error.message}`);

  const itens = resultados.flatMap((r) =>
    r.itens.map((i) => ({
      apuracao_id: idPorColab.get(r.colaborador_id)!,
      metrica_id: i.metrica_id,
      origem: fontes[i.metrica_id] ?? "klingo_agendamentos",
      origem_chave: i.chave,
      papel: i.papel,
    })),
  );
  for (let k = 0; k < itens.length; k += 1000) {
    const { error: e } = await db.from("apuracao_itens").insert(itens.slice(k, k + 1000));
    if (e) throw new Error(`Falha ao gravar memorial: ${e.message}`);
  }
}

/** Recalcula as apurações parciais (painel em tempo real) de uma competência. */
export async function recalcularParcial(competencia: string, equipeIds?: string[]): Promise<ResumoRecalculo> {
  const db = criarClienteAdmin();
  const equipes = await equipesAtivas(db, equipeIds);
  const resumo: ResumoRecalculo = { competencia, equipes: [] };
  for (const equipe of equipes) {
    const montada = await montarEntrada(db, equipe, { competencia });
    if (!montada) {
      resumo.equipes.push({ equipe: equipe.nome, pessoas: 0, plano: null });
      continue;
    }
    const resultados = apurarEquipe(montada.entrada);
    const fontes = Object.fromEntries(
      Object.values(montada.entrada.metricas).map((m) => [m.id, fonteDaMetrica(m.definicao)]),
    );
    await gravar(resultados, "parcial", null, fontes);
    resumo.equipes.push({
      equipe: equipe.nome,
      pessoas: resultados.length,
      plano: montada.plano ? `${montada.plano.nome} v${montada.plano.versao_numero}` : null,
    });
  }
  return resumo;
}

/** Recalcula o mês corrente e o anterior (consultas do mês passado ainda podem ser confirmadas). */
export async function recalcularRecentes(): Promise<ResumoRecalculo[]> {
  const atual = competenciaDe(hojeNoFuso());
  const anterior = competenciaAnterior(atual);
  // meses com fechamento já aprovado não mudam o parcial de forma relevante, mas recalcular é barato
  return [await recalcularParcial(atual), await recalcularParcial(anterior)];
}

/** Calcula o resultado final de um fechamento (snapshot ligado ao fechamento). */
export async function calcularFechamento(fechamentoId: string): Promise<number> {
  const db = criarClienteAdmin();
  const { data: f, error } = await db
    .from("fechamentos")
    .select("id, equipe_id, competencia, status")
    .eq("id", fechamentoId)
    .single();
  if (error || !f) throw new Error("Fechamento não encontrado.");
  if (["aprovado", "entregue"].includes(f.status)) throw new Error("Fechamento já aprovado: o resultado está congelado.");
  const [equipe] = await equipesAtivas(db, [f.equipe_id]);
  if (!equipe) throw new Error("Equipe inativa.");
  const competencia = String(f.competencia).slice(0, 7);
  const montada = await montarEntrada(db, equipe, { competencia });
  if (!montada) throw new Error("A equipe não tem plano ativo com versão vigente para essa competência.");
  const resultados = apurarEquipe(montada.entrada);
  const fontes = Object.fromEntries(
    Object.values(montada.entrada.metricas).map((m) => [m.id, fonteDaMetrica(m.definicao)]),
  );
  await gravar(resultados, "final", f.id, fontes);
  // o painel também passa a refletir o cálculo mais recente
  await gravar(resultados, "parcial", null, fontes);
  await db.from("fechamentos").update({ calculado_em: new Date().toISOString() }).eq("id", f.id);
  return resultados.length;
}
