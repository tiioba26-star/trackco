import { NextResponse } from "next/server";
import { dadosTv } from "@/lib/dados/tv";

// Dados do modo TV (público). Só agregados anônimos: sem nomes, R$ ou pontos.
export async function GET(_: Request, ctx: RouteContext<"/api/tv/[token]">) {
  const { token } = await ctx.params;
  try {
    const dados = await dadosTv(token);
    if (!dados) return NextResponse.json({ erro: "painel não encontrado" }, { status: 404 });
    return NextResponse.json(dados, { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
  } catch {
    return NextResponse.json({ erro: "falha ao carregar" }, { status: 500 });
  }
}
