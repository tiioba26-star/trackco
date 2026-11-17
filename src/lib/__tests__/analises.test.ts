import { describe, expect, it, vi } from "vitest";
import {
  conferirAnalise,
  lerArquivo,
  limparTexto,
  montarArquivo,
  nomeArquivo,
  prioridade,
  todosOsArquivos,
} from "@/lib/analises/arquivos";

describe("ordem de importância (rodada com limite)", () => {
  it("a visão padrão da Gestão vem primeiro; Particular antes da clínica toda; todas as 20 combinações têm lugar próprio", () => {
    expect(prioridade("mes", "anterior", "particular")).toBe(0);
    expect(prioridade("mes", "anterior", "todas")).toBe(1);
    expect(prioridade("mes_passado", "anterior", "particular")).toBeLessThan(prioridade("ano", "ano", "particular"));
    const todas = (["mes", "mes_passado", "3m", "ano", "12m"] as const).flatMap((p) =>
      (["anterior", "ano"] as const).flatMap((c) => (["particular", "todas"] as const).map((r) => prioridade(p, c, r))),
    );
    expect(new Set(todas).size).toBe(20);
  });
});

vi.mock("server-only", () => ({}));

const MOTIVO_LIVRE = "A PEDIDO DA IRMÃ MARIA DA SILVA, PACIENTE VIAJOU";

// banco falso: devolve as mesmas linhas para qualquer período (basta para conferir a montagem)
const banco = {
  rpc: async (nome: string) => {
    const data =
      nome === "gestao_producao"
        ? [["2026-10-01", "ANDRÉ BORN", "Particular - PARTICULAR", "CONSULTAS", "CONSULTA", 4, 720], ["2026-10-02", "DR SUS", "SUS - SUS", "CONSULTAS", "CONSULTA SUS", 10, 100]]
        : nome === "gestao_marcacoes"
          ? [["2026-10", "ana.k", "CONSULTA", "ANDRÉ BORN", "Particular", 30, 25, 20, 3, 2, 1, 4000]]
          : nome === "gestao_marcacoes_dia"
            ? [["2026-10-01", "ana.k", "Particular", 30, 20, 4000]]
            : nome === "gestao_perdas"
              ? [["cancelada", MOTIVO_LIVRE, "ana.k", "CONSULTA", "ANDRÉ BORN", "Particular", 2], ["falta", "", "ana.k", "CONSULTA", "ANDRÉ BORN", "Particular", 3]]
              : nome === "gestao_producao_mensal"
                ? [["2025-10", "Particular - PARTICULAR", "CONSULTAS", 30, 5000], ["2026-10", "Particular - PARTICULAR", "CONSULTAS", 4, 720]]
                : nome === "gestao_series_mensais"
                  ? [["2026-09", "ana.k", "Particular", 28, 25, 19, 3, 2, 3500], ["2026-10", "ana.k", "Particular", 30, 25, 20, 3, 2, 4000]]
                  : nome === "gestao_desfechos"
                    ? [["2026-10", "Particular", "realizada", 20], ["2026-10", "Particular", "falta", 3], ["2026-10", "Particular", "cancelada", 2]]
                    : nome === "gestao_desfechos_profissional"
                      ? [["ANDRÉ BORN", "Particular", "realizada", 20], ["ANDRÉ BORN", "Particular", "falta", 3]]
                      : [];
    return { data, error: null };
  },
  from: (t: string) => consulta(t === "colaboradores" ? [{ id: "c1", nome: "Ana", login_klingo: "ana.k", ativo: true, equipe_membros: [{ funcao: "membro", fim: null, equipes: { nome: "Comercial" } }] }] : []),
  schema: () => ({ from: () => consulta([]) }),
};
function consulta(data: unknown) {
  const o: Record<string, unknown> = { then: (r: (v: unknown) => unknown) => r({ data, error: null }) };
  for (const m of ["select", "not", "eq", "in", "gte", "lte", "order", "range", "is", "limit"]) o[m] = () => o;
  return o;
}
vi.mock("@/lib/supabase/admin", () => ({ criarClienteAdmin: () => banco }));

const { montarTrabalhos } = await import("@/lib/analises/dados");

describe("arquivos das análises", () => {
  it("101 arquivos com nomes estáveis", () => {
    expect(todosOsArquivos()).toHaveLength(101);
    expect(nomeArquivo("marcacao", "3m", "ano", "todas")).toBe("marcacao__3m__ano__todas.md");
  });

  it("cabeçalho vai e volta", () => {
    const t = montarArquivo({ secao: "faturamento", dados_ate: "2026-11-15", vazio: "" }, "## Resumo\nTexto.");
    expect(t.startsWith("---\nsecao: faturamento\ndados_ate: 2026-11-15\n---\n\n## Resumo")).toBe(true);
    expect(lerArquivo(t)).toEqual({ meta: { secao: "faturamento", dados_ate: "2026-11-15" }, corpo: "## Resumo\nTexto." });
    expect(lerArquivo("sem cabeçalho").meta).toEqual({});
  });

  it("confere seções, ordem e tamanho", () => {
    const palavras = (n: number) => Array.from({ length: n }, () => "palavra").join(" ");
    const bom = ["## Resumo", palavras(60), "## O que os números mostram", palavras(60), "## Pontos de atenção", palavras(60), "## O que fazer", palavras(60), "## Dados usados", palavras(40)].join("\n");
    expect(conferirAnalise(bom, "secao")).toEqual([]);
    expect(conferirAnalise(`\`\`\`markdown\n${bom}\n\`\`\``, "secao")).toEqual([]);
    expect(limparTexto("```md\n## Resumo\n```")).toBe("## Resumo");
    expect(conferirAnalise(bom.replace("## Pontos de atenção", "## Atenção"), "secao")).toContain('falta a seção "## Pontos de atenção"');
    expect(conferirAnalise("## Resumo\ncurto", "secao").join(" ")).toMatch(/curto demais/);
    expect(conferirAnalise(`${bom}\nNaN`, "secao").join(" ")).toMatch(/inválido/);
    expect(conferirAnalise(bom, "geral").length).toBeGreaterThan(0);
  });
});

describe("dados das análises", () => {
  it("dia comum: 100 por seção + a geral, sem texto livre de motivo", async () => {
    const { ref, trabalhos } = await montarTrabalhos("2026-11-16", { db: banco as never });
    expect(ref.ontem).toBe("2026-11-15");
    expect(trabalhos.filter((t) => t.tipo === "secao")).toHaveLength(100);
    expect(trabalhos.at(-1)?.arquivo).toBe("geral.md");
    const tudo = JSON.stringify(trabalhos.map((t) => t.dados));
    expect(tudo).not.toContain("MARIA DA SILVA");
    expect(tudo).toContain("A pedido do paciente ou da família");
    const fat = trabalhos.find((t) => t.arquivo === "faturamento__mes__anterior__particular.md")!;
    expect(fat.meta).toMatchObject({ periodo: "mes", janela_inicio: "2026-11-01", janela_fim: "2026-11-15", dados_ate: "2026-11-15" });
    expect(fat.sempre).toBe(true);
    expect(fat.dados).toHaveProperty("contexto.dados_ate", "15/11/2026");
    expect(fat.dados).toHaveProperty("contexto.recorte", "Particular");
    const tres = trabalhos.find((t) => t.arquivo === "marcacao__3m__anterior__todas.md")!;
    expect(tres.sempre).toBe(false);
    expect(tres.meta).toMatchObject({ janela_inicio: "2026-08-01", janela_fim: "2026-10-31" });
  });

  it("dia 1: sem 'este mês' (ainda sem dados); assinatura estável", async () => {
    const a = await montarTrabalhos("2026-11-01", { db: banco as never });
    expect(a.ref.virouMes).toBe(true);
    expect(a.trabalhos.filter((t) => t.periodo === "mes")).toHaveLength(0);
    expect(a.trabalhos).toHaveLength(81);
    const b = await montarTrabalhos("2026-11-01", { db: banco as never });
    expect(b.trabalhos.map((t) => t.assinatura)).toEqual(a.trabalhos.map((t) => t.assinatura));
  });
});
