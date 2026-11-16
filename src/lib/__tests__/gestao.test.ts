import JSZip from "jszip";
import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// banco falso: as funções trackco.gestao_* devolvem linhas fixas por período
const PROD: Record<string, unknown[][]> = {
  "2026-10-01": [
    ["2026-10-01", "ANDRÉ BORN", "Particular - PARTICULAR", "CONSULTAS", "CONSULTA OFTALMOLOGICA", 4, 720],
    ["2026-10-02", "AGENDA TOMOGRAFIA", "Particular - M. M. VASCONCELOS", "EXAMES", "TOMOGRAFIA", 2, 500],
    ["2026-10-02", "ANDRÉ BORN", "SUS - SUS", "CONSULTAS", "CONSULTA SUS", 10, 100],
  ],
  "2026-09-01": [["2026-09-01", "ANDRÉ BORN", "Particular - PARTICULAR", "CONSULTAS", "CONSULTA OFTALMOLOGICA", 3, 540]],
};
const MARC: Record<string, unknown[][]> = {
  "2026-10-01": [
    ["2026-10", "ana.k", "CONSULTA OFTALMOLOGICA", "ANDRÉ BORN", "Particular", 12, 10, 8, 1, 1, 0, 1440],
    ["2026-10", "bia.k", "CONSULTA CORTESIA", "ANDRÉ BORN", "Particular", 3, 3, 0, 0, 0, 1, 0],
    ["2026-10", "ze.k", "TOMOGRAFIA", "AGENDA TOMOGRAFIA", "Particular", 20, 18, 15, 2, 1, 1, 3750],
  ],
  "2026-09-01": [["2026-09", "ana.k", "CONSULTA OFTALMOLOGICA", "ANDRÉ BORN", "Particular", 10, 10, 7, 1, 1, 0, 1260]],
};
const DIA: Record<string, unknown[][]> = {
  "2026-10-01": [
    ["2026-10-01", "ana.k", "Particular", 12, 8, 1440],
    ["2026-10-02", "ze.k", "Particular", 20, 15, 3750],
  ],
  "2026-09-01": [["2026-09-01", "ana.k", "Particular", 10, 7, 1260]],
};
const PERDAS: Record<string, unknown[][]> = {
  "2026-10-01": [
    ["cancelada", "PACIENTE DESISTIU", "ana.k", "CONSULTA OFTALMOLOGICA", "ANDRÉ BORN", "Particular", 2],
    ["falta", "", "ze.k", "TOMOGRAFIA", "AGENDA TOMOGRAFIA", "Particular", 3],
  ],
  "2026-09-01": [],
};

function consulta(data: unknown) {
  const o: Record<string, unknown> = { then: (r: (v: unknown) => unknown) => r({ data, error: null }) };
  for (const m of ["select", "not", "eq", "in", "gte", "lte", "order"]) o[m] = () => o;
  return o;
}
const banco = {
  rpc: async (nome: string, a: { p_ini?: string }) => {
    const ini = a.p_ini ?? "";
    const data =
      nome === "gestao_producao" ? PROD[ini]
      : nome === "gestao_marcacoes" ? MARC[ini]
      : nome === "gestao_marcacoes_dia" ? DIA[ini]
      : nome === "gestao_perdas" ? PERDAS[ini]
      : nome === "gestao_producao_mensal" ? [["2025-10", "Particular - PARTICULAR", "CONSULTAS", 30, 5000], ["2026-10", "Particular - PARTICULAR", "CONSULTAS", 4, 720]]
      : [];
    return { data: data ?? [], error: null };
  },
  from: (t: string) =>
    consulta(
      t === "klingo_usuarios"
        ? [{ login: "ze.k", nome: "JOSE DA SILVA" }]
        : t === "colaboradores"
          ? [
              { nome: "Ana", login_klingo: "ana.k", equipe_membros: [{ funcao: "membro", fim: null, equipes: { nome: "Comercial" } }] },
              { nome: "Bia", login_klingo: "bia.k", equipe_membros: [{ funcao: "membro", fim: null, equipes: { nome: "Comercial" } }] },
            ]
          : [],
    ),
  schema: () => ({ from: () => consulta([{ nome: "Zé", login_klingo: "ze.k", equipe: "Recepção Particular" }]) }),
};
vi.mock("@/lib/supabase/admin", () => ({ criarClienteAdmin: () => banco }));

const g = await import("@/lib/dados/gestao");
const { planilhaGestao } = await import("@/lib/gestao-xlsx");
const f = g.lerFiltros({ p: "mes_passado" }, "2026-11-16");

describe("Gestão", () => {
  it("lê os filtros com padrões seguros", () => {
    expect(f.janela).toMatchObject({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(f.base).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30" });
    expect(f.operadora).toBe("Particular");
    const outro = g.lerFiltros({ p: "mes", de: "2026-10-05", ate: "2026-10-20" }, "2026-11-16");
    expect(outro.janela).toMatchObject({ periodo: "personalizado", inicio: "2026-10-05", fim: "2026-10-20" });
    expect(g.lerFiltros({ p: "xx", operadora: "drop table" }, "2026-11-16").operadora).toBe("Particular");
  });

  it("faturamento: só Particular por padrão, com decomposição e sazonalidade", async () => {
    const d = await g.abaFaturamento(f);
    expect(d.atual).toMatchObject({ valor: 1220, qtd: 6, dias: 2 });
    expect(d.base).toMatchObject({ valor: 540, qtd: 3, dias: 1 });
    expect(d.decomposicao!.dias + d.decomposicao!.volume + d.decomposicao!.valorMedio).toBeCloseTo(680, 2);
    expect(Object.keys(d.sazonal.meses)).toEqual(["2025-10", "2026-10"]);
    const sus = await g.abaFaturamento({ ...f, operadora: "SUS" });
    expect(sus.atual.valor).toBe(100);
  });

  it("marcação → R$: funil, pessoas e cortesias", async () => {
    const d = await g.abaConversao(f);
    expect(d.funil).toMatchObject({ marcadas: 35, valor: 5190 });
    expect(d.pessoas[0]).toMatchObject({ nome: "Zé", equipe: "Recepção Particular", valor: 3750 });
    const semCortesia = await g.abaConversao({ ...f, cortesia: "excluir" });
    expect(semCortesia.funil.marcadas).toBe(32);
    const comercial = await g.abaConversao({ ...f, equipe: "Comercial" });
    expect(comercial.pessoas.map((p) => p.nome).sort()).toEqual(["Ana", "Bia"]);
  });

  it("equipes, quem marca para quem e perdas", async () => {
    const e = await g.abaEquipes(f);
    expect(e.equipes.map((x) => x.equipe)).toEqual(["Recepção Particular", "Comercial"]);
    expect(e.acumulado[1]).toMatchObject({ atual: 32, base: 10 });
    const q = await g.abaQuem(f);
    expect(q.linhas[0]).toMatchObject({ nome: "Zé", total: 20 });
    const p = await g.abaPerdas(f);
    expect(p.totais).toEqual({ faltas: 3, canceladas: 2, remarcadas: 0 });
    expect(p.porMotivo.map((m) => m.motivo)).toContain("PACIENTE DESISTIU");
  });

  it("Excel abre, tem gráficos nativos e nenhuma coluna de paciente", async () => {
    const buf = await planilhaGestao(f);
    if (process.env.GESTAO_XLSX_SAIDA) (await import("node:fs")).writeFileSync(process.env.GESTAO_XLSX_SAIDA, buf);
    const zip = await JSZip.loadAsync(buf);
    const graficos = Object.keys(zip.files).filter((n) => /^xl\/charts\/trackco\d+\.xml$/.test(n));
    expect(graficos.length).toBeGreaterThanOrEqual(5);
    const tipos = await zip.file("[Content_Types].xml")!.async("string");
    expect(tipos).toContain("drawingml.chart+xml");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Painel", "Evolução", "Colaboradores", "Financeiro", "Equipes", "Perdas", "Base", "BaseFaturamento"]);
    const tudo = (await Promise.all(Object.values(zip.files).map((x) => x.async("string")))).join(" ").toLowerCase();
    expect(tudo).not.toContain("paciente_nome");
    // cada aba com gráfico aponta para o desenho
    const painel = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(painel).toMatch(/<drawing r:id="rIdTrackcoDesenho"\/>/);
  });
});
