import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recalcularParcial, recalcularRecentes } from "@/lib/calculo/recalcular";
import { env } from "@/lib/env";

export const maxDuration = 60;

function tokenValido(recebido: string | null): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(env.recalcToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamado pelo robô do Klingo ao final de cada sincronização.
// POST /api/recalcular  (Authorization: Bearer <TRACKCO_RECALC_TOKEN>)  body opcional: {"competencia":"2026-11"}
export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!tokenValido(auth)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  let competencia: string | undefined;
  try {
    const body = (await request.json()) as { competencia?: string };
    if (body?.competencia && /^\d{4}-\d{2}$/.test(body.competencia)) competencia = body.competencia;
  } catch {
    // sem corpo: recalcula mês atual e anterior
  }
  try {
    const resumo = competencia ? [await recalcularParcial(competencia)] : await recalcularRecentes();
    return NextResponse.json({ ok: true, resumo });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
