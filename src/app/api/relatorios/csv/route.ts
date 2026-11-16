import { NextResponse } from "next/server";
import { competenciaAnterior, competenciaDe, hojeNoFuso } from "@/engine/datas";
import { obterSessao } from "@/lib/auth";
import { linhasRelatorio, quebraKlingo } from "@/lib/dados/relatorios";
import { ROTULO_SITUACAO } from "@/lib/situacao";
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

  // quebras por operadora, procedimento, profissional e situação (os quadros da tela de Relatórios)
  if (url.searchParams.get("quadro") === "quebras") {
    const equipe = equipeId ?? (s.vêTudo ? undefined : s.lidera[0]);
    const pessoa = url.searchParams.get("pessoa");
    const { data: membros } = equipe
      ? await db.from("equipe_membros").select("colaborador_id, colaboradores(login_klingo)").eq("equipe_id", equipe)
      : { data: null };
    const logins = membros
      ? (membros as unknown as { colaborador_id: string; colaboradores: { login_klingo: string | null } | null }[])
          .filter((m) => !pessoa || m.colaborador_id === pessoa)
          .map((m) => m.colaboradores?.login_klingo?.toLowerCase())
          .filter((x): x is string => !!x)
      : undefined;
    const campos = ["operadora", "procedimento", "profissional", "situacao"] as const;
    const res = await Promise.all(campos.map((c) => quebraKlingo(db, { de, ate, equipeId: equipe, logins }, c)));
    const linhasQ = campos.flatMap((c, i) =>
      res[i].map((q) =>
        [c, c === "situacao" ? (ROTULO_SITUACAO[q.rotulo]?.t ?? (q.rotulo === "—" ? "Ainda sem desfecho" : q.rotulo)) : q.rotulo, q.agendados, q.realizados, num(q.agendados ? Math.round((q.realizados / q.agendados) * 1000) / 10 : null)]
          .map(celula)
          .join(";"),
      ),
    );
    return new NextResponse(`﻿quebra;rotulo;agendados;realizados;realizados_pct\n${linhasQ.join("\n")}\n`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="trackco_quebras_${de}_a_${ate}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

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
