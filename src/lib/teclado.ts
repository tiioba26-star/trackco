/** Alvo de um evento de teclado, só com o que interessa (funciona sem DOM nos testes). */
type Alvo = { tagName?: string; isContentEditable?: boolean; type?: string } | null | undefined;

const TIPOS_SEM_TEXTO = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);

/**
 * A tecla foi digitada num campo de texto? Atalhos globais (espaço, setas, Esc) não devem
 * agir aí: o espaço tem de sair na resposta e as setas movem o cursor.
 */
export function teclaEmCampoDeTexto(alvo: Alvo): boolean {
  if (!alvo) return false;
  if (alvo.isContentEditable) return true;
  const tag = alvo.tagName?.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !TIPOS_SEM_TEXTO.has((alvo.type ?? "text").toLowerCase());
  return false;
}
