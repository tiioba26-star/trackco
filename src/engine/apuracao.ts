import {
  contarDiasUteis,
  datasEntre,
  ehDiaUtil,
  fimCompetencia,
  formatarDataBR,
  inicioCompetencia,
  maiorData,
  menorData,
  nomeCompetencia,
} from "./datas";
import { arred, calcularMetrica, type Janela } from "./metricas";
import type {
  Condicao,
  DiasCompetencia,
  EntradaApuracao,
  Faixa,
  Indicador,
  ItemMemorial,
  Linha,
  MembroEquipe,
  Recompensa,
  ResultadoApuracao,
  ResultadoCondicao,
  ResultadoIndicador,
} from "./tipos";

export function encontrarFaixa(faixas: Faixa[] | undefined, pct: number | null): Faixa | null {
  if (pct === null || !faixas?.length) return null;
  const ordenadas = [...faixas].sort((a, b) => a.de_pct - b.de_pct);
  return ordenadas.find((f) => pct >= f.de_pct && (f.ate_pct === null || pct < f.ate_pct)) ?? null;
}

function aplicaA(ind: Indicador, funcao: MembroEquipe["funcao"]): boolean {
  if (ind.aplica_a === "todos") return true;
  if (ind.aplica_a === "lider") return funcao === "lider";
  return funcao === "membro";
}

function membroAtivoNoPeriodo(m: MembroEquipe, inicio: string, fim: string): boolean {
  return m.inicio <= fim && (m.fim === null || m.fim >= inicio);
}

/** Dias úteis, ausências e fator proporcional da meta para um membro na competência. */
export function calcularDias(
  entrada: EntradaApuracao,
  membro: MembroEquipe,
): DiasCompetencia {
  const ini = inicioCompetencia(entrada.competencia);
  const fim = fimCompetencia(entrada.competencia);
  const feriados = new Set(entrada.feriados);
  const dt = entrada.equipe.dias_trabalho;
  const uteis_total = contarDiasUteis(ini, fim, dt, feriados);

  let uteis_decorridos: number;
  let uteis_restantes: number;
  if (entrada.hoje < ini) {
    uteis_decorridos = 0;
    uteis_restantes = uteis_total;
  } else if (entrada.hoje > fim) {
    uteis_decorridos = uteis_total;
    uteis_restantes = 0;
  } else {
    uteis_decorridos = contarDiasUteis(ini, entrada.hoje, dt, feriados);
    // inclui hoje nos restantes: o dia ainda não terminou
    uteis_restantes = contarDiasUteis(entrada.hoje, fim, dt, feriados);
  }

  // dias em que a pessoa estava na equipe e não estava ausente
  const vIni = maiorData(ini, membro.inicio);
  const vFim = membro.fim ? menorData(fim, membro.fim) : fim;
  const ausentesSet = new Set<string>();
  for (const a of entrada.ausencias.filter((x) => x.colaborador_id === membro.colaborador_id)) {
    const aIni = maiorData(a.inicio, ini);
    const aFim = menorData(a.fim, fim);
    if (aFim < aIni) continue;
    for (const d of datasEntre(aIni, aFim)) if (ehDiaUtil(d, dt, feriados)) ausentesSet.add(d);
  }
  let disponiveis_total = 0;
  if (vFim >= vIni) {
    for (const d of datasEntre(vIni, vFim)) {
      if (ehDiaUtil(d, dt, feriados) && !ausentesSet.has(d)) disponiveis_total++;
    }
  }
  const fator_proporcional = uteis_total > 0 ? disponiveis_total / uteis_total : 0;
  return {
    uteis_total,
    uteis_decorridos,
    uteis_restantes,
    disponiveis_total,
    ausentes: uteis_total - disponiveis_total,
    // sem arredondar: o arredondamento acontece só no valor final da meta
    fator_proporcional,
  };
}

function compara(a: number, op: Condicao["operador"], b: number): boolean {
  switch (op) {
    case ">=":
      return a >= b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case "<":
      return a < b;
  }
}

function fmt(n: number | null | undefined, unidade = "un"): string {
  if (n === null || n === undefined) return "—";
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (unidade === "%") return `${s}%`;
  if (unidade === "R$") return `R$ ${s}`;
  if (unidade === "pts") return `${s} pts`;
  return s;
}

/** Apura todos os membros de uma equipe numa competência, segundo uma versão de plano. */
export function apurarEquipe(entrada: EntradaApuracao): ResultadoApuracao[] {
  const ini = inicioCompetencia(entrada.competencia);
  const fim = fimCompetencia(entrada.competencia);
  const janela: Janela = { inicio: ini, fim };
  const mesCorrente = entrada.hoje >= ini && entrada.hoje <= fim;
  const mesFuturo = entrada.hoje < ini;
  const def = entrada.plano.definicao;

  const linhasPorFonte = (f: keyof EntradaApuracao["linhas"]): Linha[] => entrada.linhas[f] ?? [];
  const donoDaChave = new Map<string, string | null>();
  for (const ls of Object.values(entrada.linhas)) {
    for (const l of ls ?? []) donoDaChave.set(l.chave, l.colaborador_id);
  }

  const membrosAtivos = entrada.membros.filter((m) => membroAtivoNoPeriodo(m, ini, fim));
  const diasPorMembro = new Map(membrosAtivos.map((m) => [m.colaborador_id, calcularDias(entrada, m)]));

  const resultados: ResultadoApuracao[] = [];

  for (const membro of membrosAtivos) {
    const dias = diasPorMembro.get(membro.colaborador_id)!;
    const memorial: string[] = [];
    const itens: ItemMemorial[] = [];
    memorial.push(
      `Competência ${nomeCompetencia(entrada.competencia)} · equipe ${entrada.equipe.nome} · ${membro.funcao === "lider" ? "líder" : "membro"}.`,
    );
    memorial.push(
      `Dias úteis no mês: ${dias.uteis_total}; disponíveis para ${membro.nome}: ${dias.disponiveis_total} (fator de meta ${fmt(arred(dias.fator_proporcional * 100, 1), "%")}).`,
    );
    if (mesCorrente) {
      memorial.push(
        `Mês em curso: dados até ${formatarDataBR(entrada.hoje)}; ${dias.uteis_decorridos} dia(s) útil(eis) decorrido(s), ${dias.uteis_restantes} restante(s) contando hoje.`,
      );
    }

    const indicadores: ResultadoIndicador[] = [];
    for (const ind of def.indicadores.filter((i) => aplicaA(i, membro.funcao))) {
      const met = entrada.metricas[ind.metrica_id];
      if (!met) {
        memorial.push(`Indicador ${ind.nome ?? ind.id}: métrica não encontrada; ignorado.`);
        continue;
      }
      if (met.definicao.somente_analise) {
        // trava de segurança: métricas só de análise (ex.: SUS) nunca contam para nota/recompensa
        memorial.push(`Indicador ${ind.nome || met.nome}: métrica marcada como "somente análise"; não entra no cálculo.`);
        continue;
      }
      const nome = ind.nome || met.nome;
      const conjunto =
        ind.escopo === "individual"
          ? [membro]
          : membrosAtivos.filter((m) => m.funcao === "membro" || (ind.incluir_lider && m.funcao === "lider"));
      const ids = conjunto.map((m) => m.colaborador_id);

      const v = calcularMetrica(met.definicao, linhasPorFonte, janela, entrada.hoje, ids);
      const ajustes = entrada.ajustes.filter(
        (a) => a.metrica_id === met.id && ids.includes(a.colaborador_id),
      );
      const ajuste_total = arred(
        ajustes.reduce((s, a) => s + a.delta, 0),
        2,
      );
      const realizado = arred(v.valor + ajuste_total, 2);

      // ---- meta ----
      const ehTaxa = met.unidade === "%";
      let meta: number | null = null;
      let meta_ajustada: number | null = null;
      let origemMeta = "";
      if (ind.escopo === "individual") {
        const m = entrada.metas.find(
          (x) => x.metrica_id === met.id && x.colaborador_id === membro.colaborador_id,
        );
        if (m) {
          meta = m.valor;
          meta_ajustada =
            ind.meta_proporcional && !ehTaxa ? arred(m.valor * dias.fator_proporcional, 2) : m.valor;
          origemMeta = "meta individual";
        }
      } else {
        const me = entrada.metas.find(
          (x) => x.metrica_id === met.id && x.equipe_id === entrada.equipe.id,
        );
        if (me) {
          meta = me.valor;
          if (ind.meta_proporcional && !ehTaxa) {
            const tot = conjunto.reduce((s, m) => s + (diasPorMembro.get(m.colaborador_id)?.uteis_total ?? 0), 0);
            const disp = conjunto.reduce(
              (s, m) => s + (diasPorMembro.get(m.colaborador_id)?.disponiveis_total ?? 0),
              0,
            );
            meta_ajustada = tot > 0 ? arred(me.valor * (disp / tot), 2) : me.valor;
          } else {
            meta_ajustada = me.valor;
          }
          origemMeta = "meta da equipe";
        } else {
          const indiv = conjunto
            .map((m) => ({
              m,
              meta: entrada.metas.find((x) => x.metrica_id === met.id && x.colaborador_id === m.colaborador_id),
            }))
            .filter((x) => x.meta);
          if (indiv.length) {
            if (ehTaxa) {
              meta = arred(indiv.reduce((s, x) => s + x.meta!.valor, 0) / indiv.length, 2);
              meta_ajustada = meta;
              origemMeta = "média das metas individuais";
            } else {
              meta = arred(indiv.reduce((s, x) => s + x.meta!.valor, 0), 2);
              meta_ajustada = ind.meta_proporcional
                ? arred(
                    indiv.reduce(
                      (s, x) => s + x.meta!.valor * (diasPorMembro.get(x.m.colaborador_id)?.fator_proporcional ?? 1),
                      0,
                    ),
                    2,
                  )
                : meta;
              origemMeta = "soma das metas individuais";
            }
          }
        }
      }

      const sem_meta = meta_ajustada === null || meta_ajustada <= 0;
      const atingimento_pct = sem_meta ? null : arred((realizado / meta_ajustada!) * 100, 1);
      const atingimento_considerado_pct =
        atingimento_pct === null ? null : arred(Math.min(atingimento_pct, ind.teto_pct || 9999), 1);

      let projecao: number | null = null;
      let ritmo_necessario_dia: number | null = null;
      if (!ehTaxa && !mesFuturo) {
        if (mesCorrente) {
          projecao =
            dias.uteis_decorridos > 0
              ? arred((realizado / dias.uteis_decorridos) * dias.uteis_total, 1)
              : realizado;
          if (!sem_meta) {
            const falta = Math.max(0, meta_ajustada! - realizado);
            ritmo_necessario_dia = arred(falta / Math.max(1, dias.uteis_restantes), 1);
          }
        } else {
          projecao = realizado;
        }
      }

      const fxInd = encontrarFaixa(ind.faixas, atingimento_pct);
      indicadores.push({
        indicador_id: ind.id,
        metrica_id: met.id,
        nome,
        unidade: met.unidade,
        escopo: ind.escopo,
        peso: ind.peso,
        realizado,
        numerador: v.numerador,
        denominador: v.denominador,
        ajuste_total,
        meta,
        meta_ajustada,
        atingimento_pct,
        atingimento_considerado_pct,
        projecao,
        ritmo_necessario_dia,
        faixa: fxInd ? { id: fxInd.id, nivel: fxInd.nivel, cor: fxInd.cor } : null,
        recompensa: fxInd?.recompensa ?? null,
        sem_meta,
      });

      for (const it of v.itens) {
        itens.push({
          metrica_id: met.id,
          chave: it.chave,
          papel: it.papel,
          colaborador_id: donoDaChave.get(it.chave) ?? null,
        });
      }

      // ---- memorial ----
      const escopoTxt =
        ind.escopo === "equipe" ? `agregado de ${conjunto.length} membro(s) da equipe` : "produção individual";
      const base =
        v.denominador !== undefined
          ? `${fmt(v.numerador)} ÷ ${fmt(v.denominador)} = ${fmt(v.valor, "%")}`
          : fmt(v.valor, met.unidade);
      let linha = `${nome} (${escopoTxt}, peso ${ind.peso}): apurado ${base}`;
      if (ajuste_total) linha += `; ajustes ${ajuste_total > 0 ? "+" : ""}${fmt(ajuste_total)} → ${fmt(realizado, met.unidade)}`;
      if (sem_meta) {
        linha += "; sem meta cadastrada (não entra na nota).";
      } else {
        linha += `; ${origemMeta} ${fmt(meta, met.unidade)}`;
        if (meta_ajustada !== meta) linha += ` → ajustada ${fmt(meta_ajustada, met.unidade)}`;
        linha += `; atingimento ${fmt(atingimento_pct, "%")}`;
        if (atingimento_considerado_pct !== atingimento_pct) linha += ` (limitado ao teto ${fmt(ind.teto_pct, "%")})`;
        linha += ".";
      }
      memorial.push(linha);
      for (const a of ajustes) memorial.push(`  · Ajuste ${a.delta > 0 ? "+" : ""}${fmt(a.delta)}: ${a.justificativa}`);
    }

    // ---- nota geral ----
    const comMeta = indicadores.filter((i) => i.atingimento_considerado_pct !== null && i.peso > 0);
    const somaPesos = comMeta.reduce((s, i) => s + i.peso, 0);
    const nota_pct =
      somaPesos > 0
        ? arred(comMeta.reduce((s, i) => s + i.peso * i.atingimento_considerado_pct!, 0) / somaPesos, 1)
        : null;

    let faixa = encontrarFaixa(def.faixas, nota_pct);
    let recompensa: Recompensa | null = faixa?.recompensa ?? null;

    // ---- condições ----
    const condicoes: ResultadoCondicao[] = [];
    for (const c of def.condicoes ?? []) {
      const ri = indicadores.find((i) => i.indicador_id === c.indicador_id);
      if (!ri) continue;
      const base = c.base === "realizado" ? ri.realizado : (ri.atingimento_pct ?? 0);
      const ok = compara(base, c.operador, c.valor);
      condicoes.push({ id: c.id, descricao: c.descricao, ok, efeito: c.efeito });
      if (!ok) {
        if (c.efeito === "bloquear_recompensa") {
          recompensa = null;
          memorial.push(`Condição não atendida: ${c.descricao} → recompensa bloqueada.`);
        } else if (c.efeito === "limitar_nivel" && c.faixa_maxima_id && faixa) {
          const max = def.faixas.find((f) => f.id === c.faixa_maxima_id);
          if (max && faixa.de_pct > max.de_pct) {
            faixa = max;
            recompensa = max.recompensa ?? null;
            memorial.push(`Condição não atendida: ${c.descricao} → nível limitado a "${max.nivel}".`);
          }
        }
      } else {
        memorial.push(`Condição atendida: ${c.descricao}.`);
      }
    }

    if (nota_pct === null) {
      memorial.push("Nota geral: sem indicadores com meta; nenhum nível atribuído.");
    } else {
      memorial.push(
        `Nota geral (média ponderada dos atingimentos): ${fmt(nota_pct, "%")} → nível ${faixa ? `"${faixa.nivel}"` : "fora das faixas"}.`,
      );
      if (recompensa) memorial.push(`Resultado: ${descreverRecompensa(recompensa)}.`);
    }

    resultados.push({
      competencia: entrada.competencia,
      colaborador_id: membro.colaborador_id,
      nome: membro.nome,
      equipe_id: entrada.equipe.id,
      funcao: membro.funcao,
      plano_versao_id: entrada.plano.versao_id,
      indicadores,
      nota_pct,
      faixa: faixa ? { id: faixa.id, nivel: faixa.nivel, cor: faixa.cor } : null,
      recompensa,
      condicoes,
      dias,
      memorial,
      itens,
    });
  }
  return resultados;
}

export function descreverRecompensa(r: Recompensa | null | undefined): string {
  if (!r) return "sem recompensa";
  switch (r.tipo) {
    case "reconhecimento":
      return r.descricao ? `reconhecimento (${r.descricao})` : "reconhecimento";
    case "premio":
      return r.descricao ? `prêmio: ${r.descricao}` : "prêmio do catálogo";
    case "valor_fixo":
      return `R$ ${(r.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    case "percentual":
      return `${r.valor ?? 0}% sobre a base`;
    case "pontos":
      return `${r.valor ?? 0} pontos`;
  }
}

/** Carinha para o modo TV (nunca triste). */
export type Carinha = "neutra" | "feliz" | "mega_feliz";

export function carinhaPara(
  atingimento: number | null,
  limites: { feliz: number; mega_feliz: number } = { feliz: 80, mega_feliz: 100 },
): Carinha {
  if (atingimento === null) return "neutra";
  if (atingimento >= limites.mega_feliz) return "mega_feliz";
  if (atingimento >= limites.feliz) return "feliz";
  return "neutra";
}
