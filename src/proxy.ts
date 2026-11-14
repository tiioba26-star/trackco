import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão do Supabase e protege as rotas do app.
// Rotas públicas: /login, /tv/<token> (modo TV), APIs com token próprio e arquivos do PWA.
const PUBLICAS = ["/login", "/tv/", "/api/tv/", "/api/recalcular", "/offline"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p))) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Só renova o token quando ele vence (sem ida ao servidor de login a cada clique). Quem confere a assinatura é o
  // banco, em toda consulta (RLS), e as páginas só existem com sessão válida (exigirSessao).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(destino);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|pwa-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
