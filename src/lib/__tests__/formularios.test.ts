import { describe, expect, it } from "vitest";
import {
  type Agenda,
  faixaSus,
  MODELOS,
  noPublico,
  pontuacaoSus,
  proximaAbertura,
  rodadaAtual,
  validarRespostas,
  FormularioZ,
} from "@/lib/formularios";

const mensal = (dia: number, inicio: string, a_cada_meses = 1): Agenda => ({ recorrencia: "mensal", dia_mes: dia, a_cada_meses, data_unica: null, inicio });

describe("quando o formulário abre", () => {
  it("todo dia 2: abre no dia 2 e fica pendente até a pessoa responder", () => {
    const a = mensal(2, "2026-10-20");
    expect(rodadaAtual(a, "2026-11-01")).toBeNull(); // outubro já tinha passado do dia 2 quando foi criado
    expect(rodadaAtual(a, "2026-11-02")).toBe("2026-11");
    expect(rodadaAtual(a, "2026-11-25")).toBe("2026-11"); // entrou só no dia 25: ainda pede
    expect(rodadaAtual(a, "2026-12-01")).toBe("2026-11");
    expect(rodadaAtual(a, "2026-12-02")).toBe("2026-12");
    expect(proximaAbertura(a, "2026-11-13")).toBe("2026-12-02");
  });

  it("'já pedir neste mês': início no dia 1 faz a rodada do mês valer", () => {
    expect(rodadaAtual(mensal(2, "2026-11-01"), "2026-11-13")).toBe("2026-11");
  });

  it("a cada 3 meses, contando do primeiro mês", () => {
    const a = mensal(2, "2026-11-01", 3);
    expect(rodadaAtual(a, "2026-11-13")).toBe("2026-11");
    expect(rodadaAtual(a, "2027-01-15")).toBe("2026-11"); // dez e jan não abrem
    expect(rodadaAtual(a, "2027-02-02")).toBe("2027-02");
    expect(proximaAbertura(a, "2026-11-13")).toBe("2027-02-02");
  });

  it("uma vez, numa data", () => {
    const a: Agenda = { recorrencia: "unica", dia_mes: null, a_cada_meses: 1, data_unica: "2026-11-20", inicio: "2026-11-13" };
    expect(rodadaAtual(a, "2026-11-19")).toBeNull();
    expect(rodadaAtual(a, "2026-11-20")).toBe("2026-11-20");
    expect(rodadaAtual(a, "2027-01-01")).toBe("2026-11-20");
    expect(proximaAbertura(a, "2026-11-13")).toBe("2026-11-20");
  });
});

describe("quem responde", () => {
  it("por função e por equipe (lista vazia = todas)", () => {
    const eu = [{ equipe_id: "e1", funcao: "membro" as const }];
    expect(noPublico({ equipes: [], funcoes: ["membro", "lider"] }, eu)).toBe(true);
    expect(noPublico({ equipes: ["e2"], funcoes: ["membro"] }, eu)).toBe(false);
    expect(noPublico({ equipes: [], funcoes: ["lider"] }, eu)).toBe(false);
    expect(noPublico({ equipes: [], funcoes: ["membro"] }, [])).toBe(false); // admin sem equipe não é bloqueado
  });
});

describe("respostas", () => {
  const sus = MODELOS.find((m) => m.id === "sus")!.dados.perguntas;

  it("exige as obrigatórias e ignora valores fora da escala", () => {
    const { respostas, faltando } = validarRespostas(sus, { sus1: 5, sus2: "1", sus3: 9, comentario: "  " });
    expect(respostas).toEqual({ sus1: 5, sus2: 1 });
    expect(faltando).toContain("sus3");
    expect(faltando).not.toContain("comentario");
  });

  it("nota SUS: tudo no melhor = 100, tudo no pior = 0, neutro = 50", () => {
    const todas = (f: (i: number) => number) => Object.fromEntries(sus.slice(0, 10).map((q, i) => [q.id, f(i)]));
    expect(pontuacaoSus(sus, todas((i) => (i % 2 === 0 ? 5 : 1)))).toBe(100);
    expect(pontuacaoSus(sus, todas((i) => (i % 2 === 0 ? 1 : 5)))).toBe(0);
    expect(pontuacaoSus(sus, todas(() => 3))).toBe(50);
    expect(pontuacaoSus(sus, { sus1: 5 })).toBeNull();
    expect(faixaSus(72.5).rotulo).toBe("Bom");
    expect(faixaSus(85).rotulo).toBe("Excelente");
  });

  it("os modelos prontos passam na validação do cadastro", () => {
    for (const m of MODELOS.filter((x) => x.id !== "branco")) {
      const r = FormularioZ.safeParse({ ...m.dados, inicio: "2026-11-13", ativo: false, publico: { equipes: [], funcoes: ["membro", "lider"] } });
      expect(r.success, m.id).toBe(true);
    }
  });
});
