import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrupoMotor } from "@/lib/analises/motor";
import { LimiteDeUso } from "@/lib/analises/motor-claude";
import { lerResultadoAgy, mensagemGemini } from "@/lib/analises/motor-gemini";

const estado = vi.hoisted(() => ({ chamadas: [] as string[], geminiSemCota: false }));

const uso = (modelo: string, custo: number) => ({ modelo, entrada: 1, saida: 1, pensamento: 0, cache_lido: 0, cache_criado: 0, custo_usd: custo });

vi.mock("@/lib/analises/motor-claude", async (orig) => ({
  ...(await orig<typeof import("@/lib/analises/motor-claude")>()),
  acharClaude: () => "claude.exe",
  chamarClaude: async (o: { modelo: string }) => {
    estado.chamadas.push(`claude:${o.modelo}`);
    return { texto: "ok", uso: uso(o.modelo, 0.01) };
  },
}));

vi.mock("@/lib/analises/motor-gemini", async (orig) => {
  const real = await orig<typeof import("@/lib/analises/motor-gemini")>();
  const { LimiteDeUso: Limite } = await import("@/lib/analises/motor-claude");
  return {
    ...real,
    acharAgy: () => "agy.exe",
    chamarGemini: async (o: { modelo: string }) => {
      estado.chamadas.push(`gemini:${o.modelo}`);
      if (estado.geminiSemCota) throw new Limite("RESOURCE_EXHAUSTED");
      return { texto: "ok", uso: uso(o.modelo, 0) };
    },
  };
});

const BASE = join(mkdtempSync(join(tmpdir(), "motor-ia-")), "base.md");
writeFileSync(BASE, "REGRAS");

describe("saída do agy (stream-json)", () => {
  it("pega o modelo do init e o texto e o uso do result", () => {
    const saida = [
      '{"event":"init","conversation_id":"x","init":{"model":"gemini-3.8-flash-high","tools":[]}}',
      '{"event":"step_update","step_update":{"text_delta":"## Res"}}',
      '{"event":"result","result":{"status":"SUCCESS","response":"## Resumo\\nok","usage":{"input_tokens":12000,"output_tokens":900,"thinking_tokens":400,"cache_read_tokens":0}}}',
      "",
    ].join("\n");
    const r = lerResultadoAgy(saida)!;
    expect(r.modelo).toBe("gemini-3.8-flash-high");
    expect(r.status).toBe("SUCCESS");
    expect(r.texto).toBe("## Resumo\nok");
    expect(r.uso.input_tokens).toBe(12000);
  });

  it("sem evento result devolve null; o erro vem no campo error", () => {
    expect(lerResultadoAgy('{"event":"init","init":{}}')).toBeNull();
    const r = lerResultadoAgy('{"event":"result","result":{"status":"ERROR","response":"","error":"RESOURCE_EXHAUSTED: quota"}}')!;
    expect(r.status).toBe("ERROR");
    expect(r.erro).toMatch(/quota/);
  });

  it("as regras vão no começo da mensagem, com o aviso de que não é programação", () => {
    const m = mensagemGemini("Você é o gestor…", "SEÇÃO: Faturamento");
    expect(m.indexOf("ESTA TAREFA NÃO É DE PROGRAMAÇÃO")).toBe(0);
    expect(m.indexOf("Você é o gestor")).toBeLessThan(m.indexOf("SEÇÃO: Faturamento"));
  });
});

describe("motor com reserva", () => {
  beforeEach(() => {
    estado.chamadas.length = 0;
    estado.geminiSemCota = false;
  });

  it("usa o motor da configuração", async () => {
    const g = new GrupoMotor({ motor: "gemini", modelo: "gemini-3.8-flash-high", esforco: "high" });
    const r = await g.chamar(BASE, "dados");
    expect(estado.chamadas).toEqual(["gemini:gemini-3.8-flash-high"]);
    expect(r.esforco).toBe("high");
  });

  it("sem motor na configuração, é o Claude", async () => {
    await new GrupoMotor({ modelo: "sonnet", esforco: "medium" }).chamar(BASE, "dados");
    expect(estado.chamadas).toEqual(["claude:sonnet"]);
  });

  it("acabou a cota do Gemini: a mesma análise e as seguintes vão para a reserva", async () => {
    estado.geminiSemCota = true;
    const avisos: string[] = [];
    const g = new GrupoMotor(
      { motor: "gemini", modelo: "gemini-3.8-flash-high", esforco: "high", reserva: { motor: "claude", modelo: "sonnet", esforco: "medium" } },
      (m) => avisos.push(m),
    );
    const r1 = await g.chamar(BASE, "a");
    const r2 = await g.chamar(BASE, "b");
    expect(estado.chamadas).toEqual(["gemini:gemini-3.8-flash-high", "claude:sonnet", "claude:sonnet"]);
    expect([r1.esforco, r2.esforco]).toEqual(["medium", "medium"]);
    expect(g.trocouParaReserva).toBe(true);
    expect(avisos).toHaveLength(1);
  });

  it("sem reserva, o limite sobe para a rodada parar", async () => {
    estado.geminiSemCota = true;
    const g = new GrupoMotor({ motor: "gemini", modelo: "gemini-3.8-flash-high", esforco: "high" });
    await expect(g.chamar(BASE, "a")).rejects.toBeInstanceOf(LimiteDeUso);
  });
});
