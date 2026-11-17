import { ImageResponse } from "next/og";

// Ícone da tela de início do iPhone/iPad (apple-touch-icon). Quadrado cheio, sem transparência:
// o iOS arredonda os cantos sozinho e pinta de preto o que for transparente.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1c5cab" }}>
        <svg width={132} height={132} viewBox="0 0 32 32">
          <rect x="7" y="17" width="4" height="8" rx="1.5" fill="#fff" />
          <rect x="14" y="12" width="4" height="13" rx="1.5" fill="#fff" />
          <rect x="21" y="7" width="4" height="18" rx="1.5" fill="#9ec5f4" />
          <circle cx="23" cy="6.5" r="2.2" fill="#f5b72e" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
