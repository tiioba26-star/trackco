import { ImageResponse } from "next/og";

const TAMANHOS = new Set([180, 192, 512]);

// Ícones PNG do PWA gerados a partir do logo (sem arquivos binários no repositório).
export async function GET(request: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const n = Number(size);
  if (!TAMANHOS.has(n)) return new Response("tamanho inválido", { status: 404 });
  const maskable = new URL(request.url).searchParams.has("maskable");
  const pad = maskable ? n * 0.2 : 0;
  return new ImageResponse(
    (
      <div style={{ width: n, height: n, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#1c5cab" : "transparent" }}>
        <svg width={n - pad * 2} height={n - pad * 2} viewBox="0 0 32 32">
          <rect width="32" height="32" rx={maskable ? 0 : 8} fill="#1c5cab" />
          <rect x="7" y="17" width="4" height="8" rx="1.5" fill="#fff" />
          <rect x="14" y="12" width="4" height="13" rx="1.5" fill="#fff" />
          <rect x="21" y="7" width="4" height="18" rx="1.5" fill="#9ec5f4" />
          <circle cx="23" cy="6.5" r="2.2" fill="#f5b72e" />
        </svg>
      </div>
    ),
    { width: n, height: n, headers: { "cache-control": "public, max-age=604800, immutable" } },
  );
}
