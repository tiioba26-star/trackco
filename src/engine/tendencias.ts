// Contas prontas para as análises da IA: o código calcula, a IA só interpreta.

export interface PontoMes {
  mes: string; // AAAA-MM
  valor: number | null;
}

export interface Tendencia {
  mes: string | null;
  ultimo: number | null;
  anterior: number | null;
  /** variação contra o mês anterior (% ou, para taxas, pontos percentuais) */
  vs_mes_anterior: number | null;
  media_3_anteriores: number | null;
  vs_media_3: number | null;
  mesmo_mes_ano_anterior: number | null;
  vs_ano_anterior: number | null;
  meses_seguidos_em_queda: number;
  meses_seguidos_em_alta: number;
  /** os últimos meses, com a variação de cada um contra o mês antes dele */
  ultimos: { mes: string; valor: number | null; variacao: number | null }[];
  unidade_variacao: "%" | "p.p.";
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function mudanca(antes: number | null, depois: number | null, pp: boolean): number | null {
  if (antes === null || depois === null) return null;
  if (pp) return r1(depois - antes);
  if (!antes) return null;
  return r1(((depois - antes) / Math.abs(antes)) * 100);
}

function mesAnterior(mes: string, n = 1): string {
  let a = Number(mes.slice(0, 4));
  let m = Number(mes.slice(5, 7)) - n;
  while (m <= 0) {
    m += 12;
    a -= 1;
  }
  return `${a}-${String(m).padStart(2, "0")}`;
}

/**
 * Tendência de uma série mensal (ordenada ou não). `pp`: a série é uma taxa em % e as variações saem em pontos percentuais.
 * Meses seguidos em queda/alta contam do último mês para trás, só com quedas/altas estritas.
 */
export function tendencia(serie: PontoMes[], opcoes: { pp?: boolean; ultimos?: number } = {}): Tendencia {
  const pp = !!opcoes.pp;
  const s = [...serie].sort((a, b) => a.mes.localeCompare(b.mes));
  const por = new Map(s.map((p) => [p.mes, p.valor]));
  const ult = s.at(-1);
  if (!ult) {
    return {
      mes: null,
      ultimo: null,
      anterior: null,
      vs_mes_anterior: null,
      media_3_anteriores: null,
      vs_media_3: null,
      mesmo_mes_ano_anterior: null,
      vs_ano_anterior: null,
      meses_seguidos_em_queda: 0,
      meses_seguidos_em_alta: 0,
      ultimos: [],
      unidade_variacao: pp ? "p.p." : "%",
    };
  }
  const valorDe = (mes: string) => por.get(mes) ?? null;
  const anterior = valorDe(mesAnterior(ult.mes));
  const tres = [1, 2, 3].map((n) => valorDe(mesAnterior(ult.mes, n))).filter((v): v is number => v !== null);
  const media3 = tres.length === 3 ? r1(tres.reduce((a, b) => a + b, 0) / 3) : null;
  const anoAnt = valorDe(mesAnterior(ult.mes, 12));

  let queda = 0;
  let alta = 0;
  for (let i = s.length - 1; i > 0; i--) {
    const a = s[i - 1].valor;
    const b = s[i].valor;
    if (a === null || b === null || mesAnterior(s[i].mes) !== s[i - 1].mes) break;
    if (b < a && alta === 0) queda++;
    else if (b > a && queda === 0) alta++;
    else break;
  }

  const n = opcoes.ultimos ?? 6;
  const ultimos = s.slice(-n).map((p) => ({ mes: p.mes, valor: p.valor, variacao: mudanca(valorDe(mesAnterior(p.mes)), p.valor, pp) }));
  return {
    mes: ult.mes,
    ultimo: ult.valor,
    anterior,
    vs_mes_anterior: mudanca(anterior, ult.valor, pp),
    media_3_anteriores: media3,
    vs_media_3: mudanca(media3, ult.valor, pp),
    mesmo_mes_ano_anterior: anoAnt,
    vs_ano_anterior: mudanca(anoAnt, ult.valor, pp),
    meses_seguidos_em_queda: queda,
    meses_seguidos_em_alta: alta,
    ultimos,
    unidade_variacao: pp ? "p.p." : "%",
  };
}

const semAcento = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

export const CATEGORIAS_MOTIVO = [
  "Sem motivo registrado",
  "Quer pelo SUS ou convênio",
  "Vai fazer em outro lugar",
  "Já atendido ou erro de cadastro",
  "Vai remarcar / outra data",
  "A pedido do paciente ou da família",
  "Outros",
] as const;
export type CategoriaMotivo = (typeof CATEGORIAS_MOTIVO)[number];

/**
 * Agrupa o motivo de cancelamento que a recepção digitou. A IA recebe só a categoria:
 * o texto livre pode ter nome de paciente e nunca sai do banco.
 */
export function categoriaMotivo(texto: string | null | undefined): CategoriaMotivo {
  const t = semAcento(texto ?? "").trim();
  if (!t) return "Sem motivo registrado";
  if (/\bSUS\b|CONVENIO|PLANO DE SAUDE/.test(t)) return "Quer pelo SUS ou convênio";
  if (/EXTERN|OUTR[OA] (MEDIC|CLINIC|LUGAR|HOSPITAL)|EM OUTRO|FORA DA CLINICA/.test(t)) return "Vai fazer em outro lugar";
  if (/JA ATENDID|ATENDID[OA] (DIA|EM|NO)|DUPLIC|INCORRET|ERRO|ENGANO|JA FEZ|JA REALIZ/.test(t)) return "Já atendido ou erro de cadastro";
  if (/REMARC|REAGEND|PROXIMO MES|OUTRO DIA|OUTRA DATA|RETORNAR|MAIS PRA FRENTE|MAIS PARA FRENTE|DEPOIS|SEMANA QUE VEM|NOVO HORARIO/.test(t))
    return "Vai remarcar / outra data";
  if (/PEDIDO|SOLICIT|DESIST|FAMILIA|IRMA|MARIDO|ESPOSA|FILH|\bMAE\b|\bPAI\b|PACIENTE|NAO PODE|NAO PODERA|TRABALH|VIAG|DOENT|INTERNAD|CHUVA|TRANSPORTE/.test(t))
    return "A pedido do paciente ou da família";
  return "Outros";
}

/** Arredonda para 2 algarismos significativos (147.265 → 150.000; 67,7 → 68; 9 → 9). */
function grosso(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n;
  const e = Math.floor(Math.log10(Math.abs(n)));
  if (e < 1) return Math.round(n * 10) / 10; // abaixo de 10: uma casa decimal
  const passo = 10 ** (e - 1);
  return Math.round(n / passo) * passo;
}

function normalizar(v: unknown): unknown {
  if (typeof v === "number") return grosso(v);
  if (Array.isArray(v)) return v.map(normalizar);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, normalizar((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/**
 * Assinatura "material" dos dados: muda quando algum número muda de verdade (mais ou menos 5%),
 * não por um lançamento atrasado de R$ 500 num mês de R$ 147 mil. Hash FNV-1a de 32 bits, em hexadecimal.
 */
export function assinatura(dados: unknown): string {
  const texto = JSON.stringify(normalizar(dados));
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
