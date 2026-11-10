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
