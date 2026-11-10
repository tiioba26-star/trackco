import { NextResponse } from "next/server";
import { competenciaAnterior, competenciaDe, hojeNoFuso } from "@/engine/datas";
import { obterSessao } from "@/lib/auth";
import { linhasRelatorio } from "@/lib/dados/relatorios";
import { competenciaValida } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";

function celula(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

// CSV (padrão Excel pt-BR: ponto e vírgula, vírgula decimal, BOM UTF-8). Respeita as permissões (RLS).
export async function GET(request: Request) {
  const s = await obterSessao();
  if (!s || (!s.vêTudo && !s.lidera.length)) return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  const url = new URL(request.url);
  const ate = competenciaValida(url.searchParams.get("ate")) ?? competenciaDe(hojeNoFuso());
  const de = competenciaValida(url.searchParams.get("de")) ?? competenciaAnterior(ate, 5);
  const equipeId = url.searchParams.get("equipe") ?? undefined;
  if (equipeId && !s.vêTudo && !s.lidera.includes(equipeId)) return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  const db = await criarClienteServidor();
  const linhas = await linhasRelatorio(db, {
    de,
    ate,
    equipeId: equipeId ?? (s.vêTudo ? undefined : s.lidera[0]),
    colaboradorId: url.searchParams.get("pessoa") ?? undefined,
  });

  const cab = ["mes", "pessoa", "funcao", "oficial", "nivel", "nota", "indicador", "realizado", "ajustes", "meta", "meta_ajustada", "atingimento_pct", "peso"];
  const corpo: string[] = [];
  for (const l of linhas) {
    for (const i of l.resultado.indicadores) {
      corpo.push(
        [
          l.competencia,
          l.nome,
          l.funcao,
          l.oficial ? "sim" : "não",
          l.nivel ?? "",
          num(l.nota),
          i.nome,
          num(i.realizado),
          num(i.ajuste_total),
          num(i.meta),
          num(i.meta_ajustada),
          num(i.atingimento_pct),
          num(i.peso),
        ]
          .map(celula)
          .join(";"),
      );
    }
  }
  const csv = `﻿${cab.join(";")}\n${corpo.join("\n")}\n`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trackco_${de}_a_${ate}.csv"`,
      "cache-control": "no-store",
    },
  });
}
