import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/auth";
import { abaConversao, abaEquipes, abaFaturamento, abaPerdas, abaQuem, lerFiltros } from "@/lib/dados/gestao";

// CSVs da Gestão (padrão Excel pt-BR: ponto e vírgula, vírgula decimal, BOM UTF-8). Só administradores. Sem paciente.

const celula = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (cab: string[], linhas: unknown[][]) => "﻿" + [cab, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";

export async function GET(request: Request) {
  const s = await obterSessao();
  if (!s?.veComoAdmin) return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  const url = new URL(request.url);
  const f = lerFiltros(Object.fromEntries(url.searchParams));
  const quadro = url.searchParams.get("quadro") ?? "colaboradores";
  let corpo: string;
  try {
    switch (quadro) {
      case "faturamento": {
        const d = await abaFaturamento(f);
        corpo = csv(
          ["data", "medico", "operadora", "categoria", "procedimento", "qtd", "valor"],
          d.linhas.map((l) => [l.data, l.medico, l.operadora, l.categoria, l.procedimento, l.qtd, l.valor]),
        );
        break;
      }
      case "equipes": {
        const d = await abaEquipes(f);
        corpo = csv(
          ["equipe", "pessoas", "marcacoes", "marcacoes_comparacao", "participacao_pct", "viraram_consulta", "valor_gerado"],
          d.equipes.map((e) => [e.equipe, e.pessoas, e.marcacoes, e.marcacoesBase, e.participacao, e.atendidas, e.valor]),
        );
        break;
      }
      case "matriz": {
        const d = await abaQuem(f);
        corpo = csv(["quem_marcou", "equipe", ...d.profissionais, "total"], d.linhas.map((l) => [l.nome, l.equipe, ...l.celulas, l.total]));
        break;
      }
      case "detalhe": {
        const d = await abaQuem(f);
        const linhas: unknown[][] = [];
        for (const p of d.arvore)
          for (const pr of p.procedimentos) for (const pf of pr.profissionais) linhas.push([p.nome, pr.procedimento, pf.profissional, pf.total, pf.atendidas]);
        corpo = csv(["quem_marcou", "procedimento", "profissional", "marcacoes", "aconteceram"], linhas);
        break;
      }
      case "perdas": {
        const d = await abaPerdas(f);
        corpo = csv(["tipo", "motivo", "consultas"], d.porMotivo.map((m) => [m.situacao === "cancelada" ? "cancelamento" : "falta", m.motivo, m.n]));
        break;
      }
      default: {
        const d = await abaConversao(f);
        corpo = csv(
          ["pessoa", "login_klingo", "equipe", "marcacoes", "marcacoes_comparacao", "conferiveis", "aconteceram", "comparecimento_pct", "valor_gerado", "valor_por_consulta", "posicao"],
          d.pessoas.map((p) => [p.nome, p.login, p.equipe, p.marcacoes, p.marcacoesBase, p.verificaveis, p.atendidas, p.comparecimento, p.valor, p.valorMedio, p.faixa ?? ""]),
        );
      }
    }
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
  return new NextResponse(corpo, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trackco-gestao-${quadro}-${f.janela.inicio}-a-${f.janela.fim}.csv"`,
      "cache-control": "no-store",
    },
  });
}
