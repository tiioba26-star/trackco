import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/auth";
import { lerFiltros } from "@/lib/dados/gestao";
import { planilhaGestao } from "@/lib/gestao-xlsx";

// Excel da Gestão (só administradores). Mesmos filtros da tela.
export const maxDuration = 60;

export async function GET(request: Request) {
  const s = await obterSessao();
  if (!s?.veComoAdmin) return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  const url = new URL(request.url);
  const f = lerFiltros(Object.fromEntries(url.searchParams));
  try {
    const arquivo = await planilhaGestao(f);
    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="trackco-gestao-${f.janela.inicio}-a-${f.janela.fim}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
