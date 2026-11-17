import "server-only";
import ExcelJS from "exceljs";
import { titulo } from "@/engine/classificacao";
import { ROTULO_FAIXA } from "@/engine/faturamento";
import { abaConversao, abaEquipes, abaFaturamento, abaPerdas, baseMarcacoes, type FiltrosGestao } from "@/lib/dados/gestao";
import { comGraficos, ref, type Grafico } from "@/lib/xlsx-graficos";

// Excel da Gestão: Painel, Evolução, Colaboradores, Financeiro, Equipes, Perdas e as bases para o Power BI.
// Sem nome de paciente (as funções do banco já devolvem os dados somados).

const AZUL = "FF1C5CAB";
const R$ = '"R$" #,##0.00';
const PCT = '0.0"%"';
const INT = "#,##0";

function cabecalho(ws: ExcelJS.Worksheet, linha: number, textos: string[]) {
  const r = ws.getRow(linha);
  textos.forEach((t, i) => {
    const c = r.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  r.height = 30;
}

function tituloAba(ws: ExcelJS.Worksheet, texto: string, sub: string) {
  ws.getCell("A1").value = texto;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: AZUL } };
  ws.getCell("A2").value = sub;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF6B7280" } };
}

const largura = (ws: ExcelJS.Worksheet, ls: number[]) => ls.forEach((l, i) => (ws.getColumn(i + 1).width = l));

export async function planilhaGestao(f: FiltrosGestao): Promise<Buffer> {
  const [fat, conv, eqs, perdas, base] = await Promise.all([abaFaturamento(f, "categoria"), abaConversao(f), abaEquipes(f), abaPerdas(f), baseMarcacoes(f)]);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trackco";
  wb.created = new Date();
  const periodo = `${f.janela.nome} (${f.janela.datas})${f.base ? ` · comparado com ${f.base.nome}` : ""}`;
  const filtros = [
    f.equipe ? `equipe ${f.equipe}` : "clínica toda",
    f.pessoa ? `pessoa ${f.pessoa}` : "",
    f.operadora === "todas" ? "todas as operadoras" : f.operadora,
    f.categoria && `categoria ${f.categoria}`,
    f.medico && `médico ${f.medico}`,
    f.procedimento && `procedimento ${f.procedimento}`,
    f.cortesia === "excluir" ? "sem cortesias" : f.cortesia === "so" ? "só cortesias" : "",
    f.agenda === "medico" ? "só médicos" : f.agenda === "exame" ? "só agendas de exame" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const graficos: Grafico[] = [];

  // ---------------------------------------------------------------- Painel
  {
    const ws = wb.addWorksheet("Painel", { views: [{ showGridLines: false }] });
    tituloAba(ws, "Trackco · Gestão", `${periodo} · ${filtros}`);
    cabecalho(ws, 4, ["Indicador", "Período", "Comparação", "Variação", "O que conta"]);
    const fu = conv.funil;
    const comp = fu.verificaveis ? (fu.atendidas / fu.verificaveis) * 100 : null;
    const compB = conv.funilBase?.verificaveis ? (conv.funilBase.atendidas / conv.funilBase.verificaveis) * 100 : null;
    const linhas: [string, number | null, number | null, string, string][] = [
      ["Agendamentos", fu.marcadas, conv.funilBase?.marcadas ?? null, INT, "Agendamentos feitos no período (pela data em que foram feitos)"],
      ["Aconteceram", fu.atendidas, conv.funilBase?.atendidas ?? null, INT, "Agendamentos que apareceram no faturamento"],
      ["Comparecimento (%)", comp, compB, PCT, "Aconteceram ÷ agendamentos que já dá para conferir"],
      ["R$ gerado pelos agendamentos", fu.valor, conv.funilBase?.valor ?? null, R$, "Valor das visitas que aconteceram"],
      ["Faturamento", fat.atual.valor, fat.base?.valor ?? null, R$, "Tudo o que o Klingo faturou (319), pela data do atendimento"],
      ["Procedimentos realizados", fat.atual.qtd, fat.base?.qtd ?? null, INT, "Quantidade faturada"],
      ["Valor médio", fat.atual.valorMedio, fat.base?.valorMedio ?? null, R$, "Faturamento ÷ procedimentos"],
      ["Dias de atendimento", fat.atual.dias, fat.base?.dias ?? null, INT, "Dias com algum faturamento"],
    ];
    linhas.forEach(([nome, a, b, fmt, txt], i) => {
      const r = ws.getRow(5 + i);
      r.getCell(1).value = nome;
      r.getCell(2).value = a;
      r.getCell(3).value = f.base ? b : null;
      r.getCell(2).numFmt = fmt;
      r.getCell(3).numFmt = fmt;
      if (f.base && a !== null && b) {
        r.getCell(4).value = fmt === PCT ? { formula: `B${5 + i}-C${5 + i}` } : { formula: `IFERROR(B${5 + i}/C${5 + i}-1,"")` };
        r.getCell(4).numFmt = fmt === PCT ? '+0.0" p.p.";-0.0" p.p."' : "+0.0%;-0.0%";
      }
      r.getCell(5).value = txt;
      r.getCell(5).font = { color: { argb: "FF6B7280" } };
    });
    // faturamento por categoria (para a pizza)
    const porCat = new Map<string, number>();
    for (const l of fat.linhas) porCat.set(l.categoria || "Sem categoria", (porCat.get(l.categoria || "Sem categoria") ?? 0) + l.valor);
    const cats = [...porCat].sort((a, b) => b[1] - a[1]);
    const ini = 15;
    cabecalho(ws, ini, ["Categoria", "Faturamento"]);
    cats.forEach(([c, v], i) => {
      ws.getCell(ini + 1 + i, 1).value = titulo(c);
      ws.getCell(ini + 1 + i, 2).value = Math.round(v * 100) / 100;
      ws.getCell(ini + 1 + i, 2).numFmt = R$;
    });
    largura(ws, [30, 18, 18, 12, 60]);
    if (cats.length)
      graficos.push({
        aba: "Painel",
        tipo: "pizza",
        titulo: "Faturamento por categoria",
        categorias: ref("Painel", 1, ini + 1, 1, ini + cats.length),
        series: [{ nome: "Faturamento", valores: ref("Painel", 2, ini + 1, 2, ini + cats.length) }],
        posicao: { col: 6, linha: 3, largura: 7, altura: 16 },
      });
  }

  // ---------------------------------------------------------------- Evolução
  {
    const ws = wb.addWorksheet("Evolução");
    tituloAba(ws, "Faturamento ao longo do tempo", `Por ${fat.serie.grao} · ${periodo}`);
    const sers = fat.serie.series;
    cabecalho(ws, 4, ["Período", ...sers.map(titulo), "Total"]);
    fat.serie.pontos.forEach((p, i) => {
      const r = ws.getRow(5 + i);
      r.getCell(1).value = String(p.ponto);
      sers.forEach((s, j) => {
        r.getCell(2 + j).value = Number(p[s] ?? 0);
        r.getCell(2 + j).numFmt = R$;
      });
      r.getCell(2 + sers.length).value = { formula: `SUM(B${5 + i}:${String.fromCharCode(65 + sers.length)}${5 + i})` };
      r.getCell(2 + sers.length).numFmt = R$;
    });
    const n = fat.serie.pontos.length;
    if (n && sers.length)
      graficos.push({
        aba: "Evolução",
        tipo: "coluna",
        empilhado: true,
        formato: '"R$" #,##0',
        titulo: "Faturamento por categoria",
        categorias: ref("Evolução", 1, 5, 1, 4 + n),
        series: sers.map((s, j) => ({ nome: titulo(s), valores: ref("Evolução", 2 + j, 5, 2 + j, 4 + n) })),
        posicao: { col: sers.length + 3, linha: 3, largura: 10, altura: 18 },
      });

    // agendamentos por equipe
    const ini = 8 + n;
    const eqSers = eqs.porEquipe.series;
    ws.getCell(ini - 1, 1).value = "Agendamentos por equipe";
    ws.getCell(ini - 1, 1).font = { bold: true, color: { argb: AZUL } };
    cabecalho(ws, ini, ["Período", ...eqSers]);
    eqs.porEquipe.pontos.forEach((p, i) => {
      const r = ws.getRow(ini + 1 + i);
      r.getCell(1).value = String(p.ponto);
      eqSers.forEach((s, j) => (r.getCell(2 + j).value = Number(p[s] ?? 0)));
    });
    const m = eqs.porEquipe.pontos.length;
    if (m && eqSers.length)
      graficos.push({
        aba: "Evolução",
        tipo: "linha",
        titulo: "Agendamentos por equipe",
        categorias: ref("Evolução", 1, ini + 1, 1, ini + m),
        series: eqSers.map((s, j) => ({ nome: s, valores: ref("Evolução", 2 + j, ini + 1, 2 + j, ini + m) })),
        posicao: { col: sers.length + 3, linha: ini - 1, largura: 10, altura: 18 },
      });
    largura(ws, [14, ...sers.map(() => 16), 16]);
  }

  // ---------------------------------------------------------------- Colaboradores
  {
    const ws = wb.addWorksheet("Colaboradores");
    tituloAba(ws, "Colaboradores: volume, comparecimento e R$", periodo);
    const cab = ["Pessoa", "Equipe", "Agendamentos", "Agendamentos (comparação)", "Conferíveis", "Aconteceram", "Comparecimento", "R$ gerado", "R$ por consulta", "Posição"];
    cabecalho(ws, 4, cab);
    conv.pessoas.forEach((p, i) => {
      const r = ws.getRow(5 + i);
      r.values = [p.nome, p.equipe, p.marcacoes, p.marcacoesBase, p.verificaveis, p.atendidas, p.comparecimento, p.valor, p.valorMedio, p.faixa ? ROTULO_FAIXA[p.faixa] : ""];
      r.getCell(7).numFmt = PCT;
      r.getCell(8).numFmt = R$;
      r.getCell(9).numFmt = R$;
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + conv.pessoas.length, column: cab.length } };
    ws.views = [{ state: "frozen", ySplit: 4 }];
    largura(ws, [32, 20, 12, 14, 12, 12, 14, 16, 14, 22]);
    const top = Math.min(10, conv.pessoas.length);
    if (top)
      graficos.push({
        aba: "Colaboradores",
        tipo: "barra",
        titulo: "R$ gerado (os 10 maiores)",
        formato: '"R$" #,##0',
        categorias: ref("Colaboradores", 1, 5, 1, 4 + top),
        series: [{ nome: "R$ gerado", valores: ref("Colaboradores", 8, 5, 8, 4 + top), cor: "1BAF7A" }],
        posicao: { col: cab.length + 1, linha: 3, largura: 8, altura: 18 },
      });
  }

  // ---------------------------------------------------------------- Financeiro
  {
    const ws = wb.addWorksheet("Financeiro");
    tituloAba(ws, "Financeiro", `Faturamento do Klingo (319) · ${periodo}`);
    const soma = (chave: (l: (typeof fat.linhas)[number]) => string) => {
      const m = new Map<string, { qtd: number; valor: number }>();
      for (const l of fat.linhas) {
        const o = m.get(chave(l)) ?? { qtd: 0, valor: 0 };
        o.qtd += l.qtd;
        o.valor += l.valor;
        m.set(chave(l), o);
      }
      return [...m].sort((a, b) => b[1].valor - a[1].valor);
    };
    const blocos: { t: string; linhas: [string, { qtd: number; valor: number }][] }[] = [
      { t: "Por categoria", linhas: soma((l) => titulo(l.categoria || "Sem categoria")) },
      { t: "Por médico / agenda", linhas: soma((l) => titulo(l.medico) || "—") },
      { t: "Procedimentos (os 30 maiores)", linhas: soma((l) => l.procedimento || "—").slice(0, 30) },
    ];
    let lin = 4;
    blocos.forEach((b, k) => {
      ws.getCell(lin, 1).value = b.t;
      ws.getCell(lin, 1).font = { bold: true, color: { argb: AZUL } };
      cabecalho(ws, lin + 1, ["Nome", "Procedimentos", "Faturamento", "Valor médio"]);
      b.linhas.forEach(([nome, o], i) => {
        const r = ws.getRow(lin + 2 + i);
        r.values = [nome, o.qtd, Math.round(o.valor * 100) / 100, o.qtd ? o.valor / o.qtd : null];
        r.getCell(3).numFmt = R$;
        r.getCell(4).numFmt = R$;
      });
      if (k === 1 && b.linhas.length) {
        const top = Math.min(10, b.linhas.length);
        graficos.push({
          aba: "Financeiro",
          tipo: "barra",
          titulo: "Faturamento por médico / agenda (os 10 maiores)",
          formato: '"R$" #,##0',
          categorias: ref("Financeiro", 1, lin + 2, 1, lin + 1 + top),
          series: [{ nome: "Faturamento", valores: ref("Financeiro", 3, lin + 2, 3, lin + 1 + top) }],
          posicao: { col: 5, linha: 3, largura: 8, altura: 20 },
        });
      }
      lin += b.linhas.length + 4;
    });
    largura(ws, [48, 14, 18, 16]);
  }

  // ---------------------------------------------------------------- Equipes
  {
    const ws = wb.addWorksheet("Equipes");
    tituloAba(ws, "Todas as equipes", periodo);
    cabecalho(ws, 4, ["Equipe", "Pessoas", "Agendamentos", "Agendamentos (comparação)", "Participação", "Viraram consulta", "R$ gerado"]);
    eqs.equipes.forEach((e, i) => {
      const r = ws.getRow(5 + i);
      r.values = [e.equipe, e.pessoas, e.marcacoes, e.marcacoesBase, e.participacao, e.atendidas, e.valor];
      r.getCell(5).numFmt = PCT;
      r.getCell(7).numFmt = R$;
    });
    largura(ws, [28, 10, 12, 14, 14, 16, 16]);
    if (eqs.equipes.length)
      graficos.push({
        aba: "Equipes",
        tipo: "coluna",
        titulo: f.base ? "Agendamentos: período × comparação" : "Agendamentos por equipe",
        categorias: ref("Equipes", 1, 5, 1, 4 + eqs.equipes.length),
        series: [
          { nome: "Período", valores: ref("Equipes", 3, 5, 3, 4 + eqs.equipes.length) },
          ...(f.base ? [{ nome: "Comparação", valores: ref("Equipes", 4, 5, 4, 4 + eqs.equipes.length), cor: "9CA3AF" }] : []),
        ],
        posicao: { col: 8, linha: 3, largura: 9, altura: 16 },
      });
  }

  // ---------------------------------------------------------------- Perdas
  {
    const ws = wb.addWorksheet("Perdas");
    tituloAba(ws, "Faltas e cancelamentos", `Pela data da consulta · ${periodo}`);
    cabecalho(ws, 4, ["Tipo", "Motivo", "Consultas"]);
    perdas.porMotivo.forEach((m, i) => (ws.getRow(5 + i).values = [m.situacao === "cancelada" ? "Cancelamento" : "Falta", m.motivo, m.n]));
    largura(ws, [16, 60, 12]);
  }

  // ---------------------------------------------------------------- Bases (Power BI)
  {
    const ws = wb.addWorksheet("Base");
    tituloAba(ws, "Base de agendamentos (para Power BI / tabela dinâmica)", `${periodo} · tabela tblBase · sem paciente`);
    const linhas = base.map((l) => [
      l.mes,
      l.nome,
      l.login,
      l.equipe,
      l.procedimento,
      l.cortesia ? "Sim" : "Não",
      titulo(l.profissional),
      l.tipoAgenda,
      l.operadora,
      l.grupoOperadora,
      l.n,
      l.verificaveis,
      l.atendidas,
      l.faltas,
      l.canceladas,
      l.remarcadas,
      Math.round(l.valor * 100) / 100,
    ]);
    ws.addTable({
      name: "tblBase",
      ref: "A4",
      headerRow: true,
      style: { theme: "TableStyleLight9", showRowStripes: true },
      columns: [
        "Mês",
        "Quem agendou",
        "Login Klingo",
        "Equipe",
        "Procedimento",
        "Cortesia",
        "Profissional",
        "Tipo de agenda",
        "Operadora",
        "Grupo da operadora",
        "Agendamentos",
        "Conferíveis",
        "Aconteceram",
        "Faltas",
        "Canceladas",
        "Remarcadas",
        "Valor gerado",
      ].map((name) => ({ name, filterButton: true })),
      rows: linhas.length ? linhas : [["", "", "", "", "", "", "", "", "", "", 0, 0, 0, 0, 0, 0, 0]],
    });
    ws.getColumn(17).numFmt = R$;
    largura(ws, [9, 28, 16, 18, 40, 9, 28, 16, 24, 16, 11, 11, 12, 9, 10, 11, 14]);
  }
  {
    const ws = wb.addWorksheet("BaseFaturamento");
    tituloAba(ws, "Base de faturamento (319, somado por dia)", `${periodo} · tabela tblFaturamento · sem paciente`);
    const linhas = fat.linhas.map((l) => [l.data, titulo(l.medico), l.operadora, l.categoria, l.procedimento, l.qtd, l.valor]);
    ws.addTable({
      name: "tblFaturamento",
      ref: "A4",
      headerRow: true,
      style: { theme: "TableStyleLight9", showRowStripes: true },
      columns: ["Data", "Médico / agenda", "Operadora", "Categoria", "Procedimento", "Quantidade", "Valor"].map((name) => ({ name, filterButton: true })),
      rows: linhas.length ? linhas : [["", "", "", "", "", 0, 0]],
    });
    ws.getColumn(7).numFmt = R$;
    largura(ws, [12, 28, 32, 18, 44, 12, 14]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return graficos.length ? comGraficos(buf as ArrayBuffer, graficos) : Buffer.from(buf as ArrayBuffer);
}
