// Utilitários de data em strings ISO (YYYY-MM-DD), sem fuso: evita surpresas de UTC x local.
// O "hoje" do negócio é sempre o de Salvador (America/Bahia).

export const FUSO = "America/Bahia";

export function hojeNoFuso(agora: Date = new Date(), fuso = FUSO): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

function paraUTC(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function deUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const dt = paraUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + dias);
  return deUTC(dt);
}

/** 1 = segunda ... 7 = domingo (ISO). */
export function diaDaSemanaISO(iso: string): number {
  const d = paraUTC(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export function inicioCompetencia(comp: string): string {
  return `${comp.slice(0, 7)}-01`;
}

export function fimCompetencia(comp: string): string {
  const [a, m] = comp.slice(0, 7).split("-").map(Number);
  return deUTC(new Date(Date.UTC(a, m, 0)));
}

export function competenciaDe(iso: string): string {
  return iso.slice(0, 7);
}

export function competenciaAnterior(comp: string, n = 1): string {
  const [a, m] = comp.slice(0, 7).split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1 - n, 1));
  return deUTC(dt).slice(0, 7);
}

export function maiorData(a: string, b: string): string {
  return a >= b ? a : b;
}

export function menorData(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Lista as datas do intervalo [inicio, fim] (inclusivo). */
export function datasEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) out.push(d);
  return out;
}

export function ehDiaUtil(iso: string, diasTrabalho: number[], feriados: Set<string>): boolean {
  return diasTrabalho.includes(diaDaSemanaISO(iso)) && !feriados.has(iso);
}

export function contarDiasUteis(
  inicio: string,
  fim: string,
  diasTrabalho: number[],
  feriados: Set<string>,
): number {
  if (fim < inicio) return 0;
  return datasEntre(inicio, fim).filter((d) => ehDiaUtil(d, diasTrabalho, feriados)).length;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function nomeCompetencia(comp: string, curto = false): string {
  const [a, m] = comp.slice(0, 7).split("-").map(Number);
  const nome = MESES[m - 1];
  return curto ? `${nome.slice(0, 3)}/${String(a).slice(2)}` : `${nome} de ${a}`;
}

export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
