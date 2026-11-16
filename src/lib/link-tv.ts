import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import "server-only";

// O link da TV fica guardado CIFRADO (AES-256-GCM, chave derivada do segredo do servidor) para poder
// ser mostrado de novo a quem gerencia o painel, sem trocar o link. O banco sozinho não abre o link:
// a TV continua sendo encontrada pelo hash, e a cifra só se desfaz no servidor do Trackco.

function chave(): Buffer {
  const segredo = process.env.SUPABASE_SECRET_KEY;
  if (!segredo) throw new Error("Segredo do servidor ausente.");
  return createHash("sha256").update(`trackco-link-tv|${segredo}`).digest();
}

export function cifrarLink(token: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrarLink(cifrado: string): string | null {
  try {
    const [iv, tag, dados] = cifrado.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", chave(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Tira o token de um link colado ("https://…/tv/AbC…" ou só o token). */
export function tokenDoLink(texto: string): string | null {
  const t = texto.trim().split("/tv/").pop()?.split(/[?#/]/)[0] ?? "";
  return /^[A-Za-z0-9_-]{20,100}$/.test(t) ? t : null;
}
