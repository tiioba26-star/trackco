// Situação de uma marcação do Klingo (por que a consulta aconteceu ou não).
// "conta" = entra na base da taxa de conversão.
export const ROTULO_SITUACAO: Record<string, { t: string; c: string; conta: boolean }> = {
  realizada: { t: "Realizada", c: "text-up", conta: true },
  falta: { t: "Faltou", c: "text-down", conta: true },
  nao_realizada: { t: "Não compareceu", c: "text-down", conta: true },
  cancelada: { t: "Cancelada", c: "text-down", conta: true },
  remarcada: { t: "Remarcada", c: "text-muted-foreground", conta: false },
  falta_remarcada: { t: "Faltou e remarcou", c: "text-muted-foreground", conta: false },
  bloqueio_clinica: { t: "Bloqueio da clínica", c: "text-muted-foreground", conta: false },
  erro: { t: "Erro de cadastro", c: "text-muted-foreground", conta: false },
};
