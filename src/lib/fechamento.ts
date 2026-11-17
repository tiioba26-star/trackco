// Máquina de estados do fechamento, conforme as etapas configuradas na equipe.

export type StatusFechamento =
  | "aberto"
  | "calculado"
  | "em_contestacao"
  | "conferencia_lider"
  | "aprovacao_admin"
  | "aprovado"
  | "entregue";

export const ROTULO_STATUS: Record<StatusFechamento, string> = {
  aberto: "Aberto",
  calculado: "Calculado",
  em_contestacao: "Prazo de contestação",
  conferencia_lider: "Conferência do líder",
  aprovacao_admin: "Aprovação do admin",
  aprovado: "Aprovado",
  entregue: "Entregue",
};

/** Sequência de status para as etapas da equipe. */
export function sequencia(etapas: string[]): StatusFechamento[] {
  const s: StatusFechamento[] = ["aberto", "calculado"];
  if (etapas.includes("contestacao")) s.push("em_contestacao");
  if (etapas.includes("lider")) s.push("conferencia_lider");
  s.push("aprovacao_admin", "aprovado", "entregue");
  return s;
}

export function proximo(status: StatusFechamento, etapas: string[]): StatusFechamento | null {
  const seq = sequencia(etapas);
  const i = seq.indexOf(status);
  return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
}

/** Quem pode mover o fechamento a partir do status atual. */
export function quemAvanca(status: StatusFechamento): "admin" | "lider_ou_admin" | null {
  if (status === "conferencia_lider") return "lider_ou_admin";
  if (status === "aberto") return null; // precisa calcular primeiro
  if (status === "entregue") return null;
  return "admin";
}

export const ROTULO_ACAO: Partial<Record<StatusFechamento, string>> = {
  calculado: "Liberar para a próxima etapa",
  em_contestacao: "Encerrar prazo de contestação",
  conferencia_lider: "Conferi: enviar para aprovação",
  aprovacao_admin: "Aprovar resultado",
  aprovado: "Marcar como entregue",
};

export type RegistroLog = { em: string; por: string; acao: string };
export type MarcoEtapa = { em: string; por: string };
export type EtapaLinha = {
  status: StatusFechamento;
  rotulo: string;
  estado: "feita" | "atual" | "a_fazer";
  /** quando o fechamento chegou nesta etapa, e quem levou */
  inicio: MarcoEtapa | null;
  /** quando saiu dela (entrada na etapa seguinte), e quem aprovou */
  fim: MarcoEtapa | null;
  /** quem pode concluir esta etapa (null = só calcular, ou nada a fazer) */
  responsavel: "admin" | "lider_ou_admin" | null;
};

const PELO_ROTULO = new Map(Object.entries(ROTULO_STATUS).map(([k, v]) => [v, k as StatusFechamento]));

/**
 * Linha do tempo do fechamento a partir do histórico gravado pelas ações
 * ("Fechamento aberto", "Cálculo executado…", "A → B", "Reaberto…").
 * Vale a última passagem por cada etapa: uma reabertura apaga as datas das etapas depois de "Calculado".
 */
export function linhaDoTempo(etapas: string[], status: StatusFechamento, log: RegistroLog[] | null | undefined): EtapaLinha[] {
  const seq = sequencia(etapas);
  const entrada = new Map<StatusFechamento, MarcoEtapa>();
  let atual: StatusFechamento | null = null;
  const entrar = (st: StatusFechamento, r: RegistroLog) => {
    entrada.set(st, { em: r.em, por: r.por });
    atual = st;
  };
  for (const r of [...(log ?? [])].sort((a, b) => a.em.localeCompare(b.em))) {
    const seta = r.acao.split(" → ");
    if (r.acao === "Fechamento aberto") entrar("aberto", r);
    else if (r.acao.startsWith("Cálculo executado")) {
      if (atual === null || atual === "aberto") entrar("calculado", r);
    } else if (r.acao.startsWith("Reaberto")) {
      for (const st of seq.slice(seq.indexOf("calculado") + 1)) entrada.delete(st);
      entrar("calculado", r);
    } else if (seta.length === 2 && PELO_ROTULO.has(seta[1])) entrar(PELO_ROTULO.get(seta[1])!, r);
  }
  const iAtual = seq.indexOf(status);
  const fimDeTudo = status === "entregue";
  return seq.map((st, i) => {
    const estado: EtapaLinha["estado"] = i < iAtual || (fimDeTudo && i === iAtual) ? "feita" : i === iAtual ? "atual" : "a_fazer";
    return {
      status: st,
      rotulo: ROTULO_STATUS[st],
      estado,
      inicio: estado === "a_fazer" ? null : (entrada.get(st) ?? null),
      fim: estado === "feita" && i < seq.length - 1 ? (entrada.get(seq[i + 1]) ?? null) : null,
      responsavel: quemAvanca(st),
    };
  });
}
