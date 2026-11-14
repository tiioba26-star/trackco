import "server-only";
import { calcularDias } from "@/engine/apuracao";
import { competenciaAnterior, competenciaDe, datasEntre, ehDiaUtil, fimCompetencia, inicioCompetencia, nomeCompetencia } from "@/engine/datas";
import type { Ausencia, DefinicaoPlano, EntradaApuracao, Indicador, MembroEquipe, Metrica } from "@/engine/tipos";
import { serieAnalise } from "@/lib/dados/analise";
import type { Db } from "@/lib/supabase/tipos";

// Realizado × esperado de uma pessoa, mês a mês ou dia a dia (Metas → seção de baixo).
// Cada ponto é só daquele mês ou daquele dia: nada é acumulado nem somado no período.
// Em cada mês vale a regra do plano daquele mês (ex.: até outubro contava o total; desde novembro, os válidos).

export type VisaoRealEsperado = "mes" | "dia";

export interface PontoRealEsperado {
  chave: string; // AAAA-MM ou AAAA-MM-DD
  rotulo: string;
  /** AAAA-MM-DD na visão por dia (eixo com o dia da semana) */
  data: string | null;
  real: number | null;
  /** o que a meta esperava naquele ponto (no mês em andamento: até hoje) */
  esperado: number | null;
  /** meta do mês inteiro, já ajustada a ausências e feriados (só na visão por mês) */
  metaMes: number | null;
  /** mês em andamento ou dia de hoje */
  parcial: boolean;
  futuro: boolean;
}

export interface IndicadorRealEsperado {
  id: string;
  nome: string;
  unidade: string;
  peso: number;
  escopo: "individual" | "equipe";
  /** existe meta em pelo menos um ponto */
  temMeta: boolean;
  /** quando a métrica do indicador mudou no período: a partir de que mês vale cada uma */
  trocas: { desde: string; metrica: string }[];
  pontos: PontoRealEsperado[];
}

type Membro = MembroEquipe & { login_klingo: string | null };

const arred = (n: number, casas = 1) => Math.round(n * 10 ** casas) / 10 ** casas;

export async function realEsperado(
  db: Db,
  op: {
    equipe: { id: string; nome: string; dias_trabalho: number[] };
    pessoa: Membro;
    membros: Membro[];
    /** indicadores do plano do último mês: definem o que aparece e em que ordem */
    indicadores: Indicador[];
    metricas: Metrica[];
    visao: VisaoRealEsperado;
    /** visão por mês: intervalo de meses; visão por dia: de = ate = o mês */
    de: string;
    ate: string;
    hoje: string;
  },
): Promise<IndicadorRealEsperado[]> {
  const atual = competenciaDe(op.hoje);
  const meses: string[] = [];
  for (let c = op.ate; c >= op.de && meses.length < 24; c = competenciaAnterior(c)) meses.unshift(c);
  const ini = inicioCompetencia(meses[0]);
  const fim = fimCompetencia(meses[meses.length - 1]);

  // versões do plano ativo: cada mês usa a versão que valia nele
  const { data: plano } = await db.from("planos").select("id").eq("equipe_id", op.equipe.id).eq("status", "ativo").maybeSingle();
  const { data: versoesRows } = plano
    ? await db.from("plano_versoes").select("numero, vigente_desde, definicao").eq("plano_id", plano.id)
    : { data: [] };
  const versoes = ((versoesRows ?? []) as { numero: number; vigente_desde: string; definicao: DefinicaoPlano }[]).sort(
    (a, b) => b.vigente_desde.localeCompare(a.vigente_desde) || b.numero - a.numero,
  );
  const indicadorNoMes = (ind: Indicador, comp: string): Indicador =>
    versoes.find((v) => v.vigente_desde <= inicioCompetencia(comp))?.definicao.indicadores.find((i) => i.id === ind.id) ?? ind;

  const aplicaveis = op.indicadores.filter(
    (i) => i.peso > 0 && (i.aplica_a === "todos" || (i.aplica_a === "lider") === (op.pessoa.funcao === "lider")),
  );
  const ativoNoMes = (m: Membro, comp: string) => m.inicio <= fimCompetencia(comp) && (!m.fim || m.fim >= inicioCompetencia(comp));
  const conjuntoDe = (ind: Indicador, comp: string): Membro[] =>
    ind.escopo === "individual"
      ? [op.pessoa]
      : op.membros.filter((m) => ativoNoMes(m, comp) && (m.funcao === "membro" || (ind.incluir_lider && m.funcao === "lider")));
  const ids = Array.from(new Set(op.membros.map((m) => m.colaborador_id)));
  const idsMetrica = Array.from(new Set(aplicaveis.flatMap((i) => meses.map((c) => indicadorNoMes(i, c).metrica_id))));

  const [metasRes, ausRes, ferRes] = await Promise.all([
    idsMetrica.length
      ? db
          .from("metas")
          .select("metrica_id, colaborador_id, equipe_id, competencia, valor")
          .in("metrica_id", idsMetrica)
          .gte("competencia", ini)
          .lte("competencia", fim)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db.from("ausencias").select("colaborador_id, inicio, fim").in("colaborador_id", ids).lte("inicio", fim).gte("fim", ini)
      : Promise.resolve({ data: [] }),
    db.from("feriados").select("data").gte("data", ini).lte("data", fim),
  ]);
  type MetaLinha = { metrica_id: string; colaborador_id: string | null; equipe_id: string | null; competencia: string; valor: number };
  const metas = (metasRes.data ?? []) as MetaLinha[];
  const ausencias = (ausRes.data ?? []) as Ausencia[];
  const feriados = (ferRes.data ?? []).map((f) => String((f as { data: string }).data));
  const feriadosSet = new Set(feriados);

  // dias úteis e disponíveis de cada membro em cada mês (mesma regra da nota)
  const dias = (comp: string, m: Membro) =>
    calcularDias({ competencia: comp, hoje: op.hoje, equipe: op.equipe, feriados, ausencias } as unknown as EntradaApuracao, m);
  const disponivel = (dia: string, m: Membro) =>
    ehDiaUtil(dia, op.equipe.dias_trabalho, feriadosSet) &&
    dia >= m.inicio &&
    (!m.fim || dia <= m.fim) &&
    !ausencias.some((a) => a.colaborador_id === m.colaborador_id && a.inicio <= dia && a.fim >= dia);
  const metricaPorId = (id: string) => op.metricas.find((m) => m.id === id);

  /** meta do mês, ajustada a ausências/feriados quando o indicador é proporcional (mesma conta da nota) */
  const metaDoMes = (ind: Indicador, comp: string, conjunto: Membro[]) => {
    const metrica = metricaPorId(ind.metrica_id);
    const ehTaxa = metrica?.definicao.tipo_calculo === "taxa";
    const doMes = metas.filter((x) => x.metrica_id === ind.metrica_id && String(x.competencia).startsWith(comp));
    const ds = new Map(conjunto.map((m) => [m.colaborador_id, dias(comp, m)]));
    const proporcional = ind.meta_proporcional && !ehTaxa;
    let ajustada: number | null = null;
    if (ind.escopo === "individual") {
      const v = doMes.find((x) => x.colaborador_id === op.pessoa.colaborador_id)?.valor;
      if (v !== undefined) ajustada = Number(v) * (proporcional ? (ds.get(op.pessoa.colaborador_id)?.fator_proporcional ?? 1) : 1);
    } else {
      const daEquipe = doMes.find((x) => x.equipe_id === op.equipe.id)?.valor;
      if (daEquipe !== undefined) {
        const uteis = conjunto.reduce((s, m) => s + (ds.get(m.colaborador_id)?.uteis_total ?? 0), 0);
        const disp = conjunto.reduce((s, m) => s + (ds.get(m.colaborador_id)?.disponiveis_total ?? 0), 0);
        ajustada = Number(daEquipe) * (proporcional && uteis > 0 ? disp / uteis : 1);
      } else {
        const indiv = conjunto
          .map((m) => ({ m, v: doMes.find((x) => x.colaborador_id === m.colaborador_id)?.valor }))
          .filter((x) => x.v !== undefined);
        if (indiv.length)
          ajustada = ehTaxa
            ? indiv.reduce((s, x) => s + Number(x.v), 0) / indiv.length
            : indiv.reduce((s, x) => s + Number(x.v) * (proporcional ? (ds.get(x.m.colaborador_id)?.fator_proporcional ?? 1) : 1), 0);
      }
    }
    if (ajustada === null || ajustada <= 0) return null;
    const primeiro = ds.values().next().value;
    return { ajustada, ehTaxa, uteis: primeiro?.uteis_total ?? 0, decorridos: primeiro?.uteis_decorridos ?? 0 };
  };

  return Promise.all(
    aplicaveis.map(async (indRef): Promise<IndicadorRealEsperado> => {
      const metricaRef = metricaPorId(indRef.metrica_id);
      const trocas: { desde: string; metrica: string }[] = [];
      for (const c of meses) {
        const nome = metricaPorId(indicadorNoMes(indRef, c).metrica_id)?.nome ?? "—";
        if (trocas[trocas.length - 1]?.metrica !== nome) trocas.push({ desde: c, metrica: nome });
      }
      const base = {
        id: indRef.id,
        nome: indRef.nome ?? metricaRef?.nome ?? "Indicador",
        unidade: metricaRef?.unidade ?? "un",
        peso: indRef.peso,
        escopo: indRef.escopo,
        trocas: trocas.length > 1 ? trocas : [],
      };

      let pontos: PontoRealEsperado[] = [];
      if (op.visao === "mes") {
        pontos = await Promise.all(
          meses.map(async (comp) => {
            const ind = indicadorNoMes(indRef, comp);
            const metrica = metricaPorId(ind.metrica_id);
            const conjunto = conjuntoDe(ind, comp);
            const futuro = comp > atual;
            const serie =
              metrica && conjunto.length && !futuro
                ? await serieAnalise(db, {
                    a: metrica,
                    b: null,
                    colaboradores: conjunto.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo })),
                    granularidade: "mes",
                    de: comp,
                    ate: comp,
                    acumulado: false,
                    hoje: op.hoje,
                  })
                : null;
            const meta = metaDoMes(ind, comp, conjunto);
            const emAndamento = comp === atual;
            let esperado: number | null = null;
            // mês em andamento: compara com o que a meta esperava até hoje (taxa não tem "até hoje")
            if (meta) esperado = meta.ehTaxa || !emAndamento || meta.uteis === 0 ? meta.ajustada : (meta.ajustada * meta.decorridos) / meta.uteis;
            return {
              chave: comp,
              rotulo: nomeCompetencia(comp, true),
              data: null,
              real: serie?.pontos[0]?.a ?? null,
              esperado: esperado === null ? null : arred(esperado),
              metaMes: meta ? arred(meta.ajustada) : null,
              parcial: emAndamento,
              futuro,
            };
          }),
        );
      } else {
        const comp = meses[0];
        const ind = indicadorNoMes(indRef, comp);
        const metrica = metricaPorId(ind.metrica_id);
        const conjunto = conjuntoDe(ind, comp);
        const serie = metrica
          ? await serieAnalise(db, {
              a: metrica,
              b: null,
              colaboradores: conjunto.map((m) => ({ id: m.colaborador_id, login_klingo: m.login_klingo })),
              granularidade: "dia",
              de: comp,
              ate: comp,
              acumulado: false,
              hoje: op.hoje,
            })
          : { pontos: datasEntre(inicioCompetencia(comp), fimCompetencia(comp)).map((d) => ({ chave: d, a: null, futuro: d > op.hoje })) };
        const meta = metaDoMes(ind, comp, conjunto);
        // por dia: a meta do mês dividida pelos dias em que a pessoa (ou o conjunto) trabalhou
        const porDia = new Map(datasEntre(inicioCompetencia(comp), fimCompetencia(comp)).map((d) => [d, conjunto.filter((m) => disponivel(d, m)).length]));
        const pessoasDia = Array.from(porDia.values()).reduce((s, n) => s + n, 0);
        pontos = serie.pontos.map((p) => {
          const n = porDia.get(p.chave) ?? 0;
          let esperado: number | null = null;
          if (meta && n > 0) esperado = meta.ehTaxa ? meta.ajustada : pessoasDia > 0 ? (meta.ajustada * n) / pessoasDia : null;
          return {
            chave: p.chave,
            rotulo: `${p.chave.slice(8)}/${p.chave.slice(5, 7)}`,
            data: p.chave,
            real: p.futuro ? null : p.a,
            esperado: esperado === null ? null : arred(esperado),
            metaMes: null,
            parcial: p.chave === op.hoje,
            futuro: p.futuro,
          };
        });
      }
      return { ...base, temMeta: pontos.some((p) => p.esperado !== null), pontos };
    }),
  );
}
