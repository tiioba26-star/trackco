import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularMetrica } from "@/engine/metricas";
import type { DefinicaoMetrica, Linha } from "@/engine/tipos";

// lê as definições direto da migração 19 (o que vai para o banco é o que é testado)
const sql = readFileSync(join(__dirname, "..", "..", "..", "supabase", "migrations", "20261118000019_trackco_metricas_analise.sql"), "utf8");
const defs = new Map<string, DefinicaoMetrica>();
for (const m of sql.matchAll(/\('([a-z_]+)',\s*'[^']*',\s*'[^']*',\s*'\w+',\s*'[^']*',\s*'(\{[\s\S]*?\})'\)/g)) defs.set(m[1], JSON.parse(m[2]));

const l = (chave: string, op: string, situacao: string | null, para: string, atendido = false, em = "2026-10-01"): Linha => ({
  chave,
  colaborador_id: "c1",
  operadora: op,
  situacao,
  data_agendado_em: em,
  data_agendado_para: para,
  atendido,
});

const linhas: Linha[] = [
  l("1", "SUS - SUS", "realizada", "2026-10-10", true),
  l("2", "SUS - SUS", "falta", "2026-10-11"),
  l("3", "SUS - SUS", "cancelada", "2026-10-12"),
  l("4", "SUS - SUS", "remarcada", "2026-10-13"),
  l("5", "SUS - SUS", "erro", "2026-10-14"),
  l("6", "Particular", "remarcada", "2026-10-15"),
  l("7", "Particular", "cancelada", "2026-10-16"),
  l("8", "Particular", "nao_realizada", "2026-10-17"),
  l("9", "SUS - SUS", "realizada", "2026-11-03", true), // fora do mês
];
const outubro = { inicio: "2026-10-01", fim: "2026-10-31" };
const valor = (codigo: string) => calcularMetrica(defs.get(codigo)!, () => linhas, outubro, "2026-11-17", ["c1"]).valor;

describe("métricas de análise (migração 19)", () => {
  it("todas as 9 estão na migração e são só de análise", () => {
    expect(defs.size).toBe(9);
    expect([...defs.values()].every((d) => d.somente_analise)).toBe(true);
  });

  it("SUS: válidos tiram remarcação e erro; marcadas pelo dia da consulta; desfechos certos", () => {
    expect(valor("agendamentos_validos_sus")).toBe(4); // 1,2,3,9 marcados em 01/10 (5 erro e 4 remarcada saem)
    expect(valor("marcadas_sus")).toBe(3); // consultas de outubro: 1,2,3
    expect(valor("remarcacoes_sus")).toBe(1);
    expect(valor("cancelamentos_sus")).toBe(1);
    expect(valor("faltas_sus")).toBe(1);
    expect(valor("comparecimento_sus")).toBe(33.33); // 1 de 3 (o motor arredonda taxa em 2 casas)
  });

  it("Particular: remarcadas, canceladas e faltas", () => {
    expect(valor("remarcacoes_particular")).toBe(1);
    expect(valor("cancelamentos_particular")).toBe(1);
    expect(valor("faltas_particular")).toBe(1);
  });
});
