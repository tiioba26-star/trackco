import type { Unidade } from "@/engine/tipos";

export function fmtNum(n: number | null | undefined, casas = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: 0 });
}

export function fmtValor(n: number | null | undefined, unidade: Unidade | string = "un"): string {
  if (n === null || n === undefined) return "—";
  switch (unidade) {
    case "%":
      return `${fmtNum(n, 1)}%`;
    case "R$":
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "pts":
      return `${fmtNum(n, 1)} pts`;
    default:
      return fmtNum(n, 1);
  }
}

export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${fmtNum(n, 1)}%`;
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tempoRelativo(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return "nunca";
  const min = Math.round((agora - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export function competenciaValida(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

/** Emoji da carinha de nível (nunca triste). */
export function carinhaEmoji(nota: number | null): string {
  if (nota === null) return "🙂";
  if (nota >= 100) return "🤩";
  if (nota >= 80) return "😄";
  return "🙂";
}
