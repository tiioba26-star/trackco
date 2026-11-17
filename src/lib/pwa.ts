// Regras do convite para instalar o Trackco no celular (PWA). Puras, para testar sem navegador.

export const CHAVE_ADIADO = "trackco-instalar-adiado";
export const DIAS_ADIADO = 14;

export type Plataforma = "ios" | "android" | "outro";

/** iPhone, iPad (inclusive o iPadOS, que se diz "Macintosh" mas tem tela de toque) ou Android. */
export function plataformaDe(ua: string, toques = 0): Plataforma {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && toques > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "outro";
}

/**
 * Mostrar o convite?
 * - só no celular/tablet (computador não);
 * - nunca se já está aberto como app (tela cheia);
 * - não se a pessoa tocou em "Agora não" há menos de 14 dias;
 * - no Android, só quando o navegador avisou que dá para instalar (evento beforeinstallprompt): se ele não avisa,
 *   ou já está instalado ou o navegador não instala; no iPhone não existe esse aviso, então mostramos o passo a passo.
 */
export function deveConvidar(o: {
  plataforma: Plataforma;
  instalado: boolean;
  adiadoEm: number | null;
  agora: number;
  navegadorOferece: boolean;
}): boolean {
  if (o.plataforma === "outro" || o.instalado) return false;
  if (o.adiadoEm !== null && o.agora - o.adiadoEm < DIAS_ADIADO * 86_400_000) return false;
  return o.plataforma === "ios" || o.navegadorOferece;
}
