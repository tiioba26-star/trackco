import "server-only";
import { competenciaAnterior, fimCompetencia, inicioCompetencia } from "@/engine/datas";
import { calcularMetrica } from "@/engine/metricas";
import type { Linha, Metrica } from "@/engine/tipos";
import { linhasKlingo, membrosDaEquipe } from "@/lib/calculo/carregar";
import type { Db } from "@/lib/supabase/tipos";

export interface HistoricoMeta {
  /** média dos meses com atividade (null = sem histórico) */
  media: number | null;
  /** valor do mês anterior à competência */
  ultimo: number | null;
  /** quantos meses entraram na média */
  meses: number;
  /** de onde vem a sugestão */
  base: "historico" | "media_equipe" | "sem_dados";
  /** valor-base da sugestão, antes do crescimento */
  referencia: number | null;
}

export type MapaHistorico = Record<string, HistoricoMeta>; // chave: `${metrica_id}|${colaborador_id ?? "equipe"}`

const arred = (n: number, casas = 1) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Histórico para sugerir metas: para cada pessoa e métrica, a média dos últimos `nMeses` meses
 * fechados em que a métrica foi maior que zero (meses zerados não puxam a média para baixo:
 * entrada recente, férias, mês ainda sem cruzamento com a produção). Quem não tem histórico
 * recebe a média por pessoa da equipe.
 * Só métricas do Klingo; métricas "somente análise" (SUS) ficam de fora.
 */
export async function historicoParaMetas(
  db: Db,
  equipeId: string,
  competencia: string,
  metricas: Metrica[],
  nMeses = 3,
): Promise<MapaHistorico> {
  const usaveis = metricas.filter((m) => {
    const d = m.definicao;
    if (d.somente_analise) return false;
    return d.tipo_calculo === "taxa"
      ? d.numerador.fonte === "klingo_agendamentos" && d.denominador.fonte === "klingo_agendamentos"
      : d.fonte === "klingo_agendamentos";
  });
  const atuais = await membrosDaEquipe(db, equipeId, competencia);
  const pessoas = atuais.filter((m) => m.funcao === "membro");
  const porLogin = new Map(pessoas.filter((p) => p.login_klingo).map((p) => [p.login_klingo!.toLowerCase(), p.colaborador_id]));
  const meses = Array.from({ length: nMeses }, (_, i) => competenciaAnterior(competencia, i + 1)); // mais recente primeiro

  // valores[metrica][pessoa] = lista de valores por mês (só meses com atividade)
  const valores = new Map<string, Map<string, number[]>>();
  const ultimo = new Map<string, Map<string, number>>();
  // os meses são carregados em paralelo; o cálculo abaixo é só em memória
  const brutasPorMes = await Promise.all(meses.map((mes) => linhasKlingo(db, Array.from(porLogin.keys()), mes)));
  for (const [idx, mes] of meses.entries()) {
    const brutas = brutasPorMes[idx];
    const linhas: Linha[] = brutas.map((l) => ({
      ...l,
      chave: l.chave as string,
      colaborador_id: porLogin.get(String(l.responsavel_login ?? "").toLowerCase()) ?? null,
    }));
    const janela = { inicio: inicioCompetencia(mes), fim: fimCompetencia(mes) };
    for (const m of usaveis) {
      for (const p of pessoas) {
        const v = calcularMetrica(m.definicao, () => linhas, janela, fimCompetencia(mes), [p.colaborador_id]).valor;
        if (idx === 0) {
          if (!ultimo.has(m.id)) ultimo.set(m.id, new Map());
          ultimo.get(m.id)!.set(p.colaborador_id, v);
        }
        if (!(v > 0)) continue; // mês sem atividade nessa métrica não entra na média
        if (!valores.has(m.id)) valores.set(m.id, new Map());
        const mp = valores.get(m.id)!;
        mp.set(p.colaborador_id, [...(mp.get(p.colaborador_id) ?? []), v]);
      }
    }
  }

  const out: MapaHistorico = {};
  for (const m of usaveis) {
    const mp = valores.get(m.id) ?? new Map<string, number[]>();
    const medias = new Map(
      Array.from(mp.entries()).map(([id, vs]) => [id, vs.reduce((s, v) => s + v, 0) / vs.length] as const),
    );
    const mediaPorPessoa = medias.size ? Array.from(medias.values()).reduce((s, v) => s + v, 0) / medias.size : null;
    let somaRef = 0;
    let algumRef = false;
    for (const p of pessoas) {
      const media = medias.get(p.colaborador_id);
      const ref = media ?? mediaPorPessoa;
      if (ref !== null && ref !== undefined) {
        somaRef += ref;
        algumRef = true;
      }
      out[`${m.id}|${p.colaborador_id}`] = {
        media: media === undefined ? null : arred(media),
        ultimo: ultimo.get(m.id)?.get(p.colaborador_id) ?? null,
        meses: mp.get(p.colaborador_id)?.length ?? 0,
        base: media !== undefined ? "historico" : mediaPorPessoa !== null ? "media_equipe" : "sem_dados",
        referencia: ref === null || ref === undefined ? null : arred(ref),
      };
    }
    const taxa = m.unidade === "%";
    out[`${m.id}|equipe`] = {
      media: null,
      ultimo: null,
      meses: 0,
      base: algumRef ? "historico" : "sem_dados",
      referencia: algumRef ? arred(taxa ? somaRef / Math.max(1, pessoas.length) : somaRef) : null,
    };
  }
  return out;
}
