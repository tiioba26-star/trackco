import type { Carinha as TipoCarinha } from "@/engine/apuracao";

/** Ícone de perfil anônimo com carinha (SVG próprio: renderiza igual em qualquer TV). Nunca triste. */
export function Carinha({ tipo, cor, tamanho = 56 }: { tipo: TipoCarinha; cor: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label={`carinha ${tipo.replace("_", " ")}`}>
      <circle cx="32" cy="32" r="30" fill={cor} />
      <circle cx="32" cy="32" r="30" fill="url(#brilho)" />
      <defs>
        <radialGradient id="brilho" cx="30%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {tipo === "mega_feliz" ? (
        <>
          {/* olhos fechados de alegria */}
          <path d="M17 26 q5 -6 10 0" stroke="#0b1324" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M37 26 q5 -6 10 0" stroke="#0b1324" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M16 36 q16 20 32 0 z" fill="#0b1324" />
          <path d="M23 43 q9 6 18 0" fill="#ff6b81" />
          <circle cx="14" cy="36" r="3.5" fill="#ff8fa3" opacity="0.7" />
          <circle cx="50" cy="36" r="3.5" fill="#ff8fa3" opacity="0.7" />
        </>
      ) : tipo === "feliz" ? (
        <>
          <circle cx="23" cy="26" r="3.5" fill="#0b1324" />
          <circle cx="41" cy="26" r="3.5" fill="#0b1324" />
          <path d="M20 38 q12 12 24 0" stroke="#0b1324" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="23" cy="27" r="3.5" fill="#0b1324" />
          <circle cx="41" cy="27" r="3.5" fill="#0b1324" />
          <path d="M23 41 h18" stroke="#0b1324" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
