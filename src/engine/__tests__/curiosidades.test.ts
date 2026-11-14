import { describe, expect, it } from "vitest";
import { curiosidadesDoMes } from "../curiosidades";
import type { RegrasProducao } from "../producao";
import type { Linha } from "../tipos";

const regras: RegrasProducao = { base: [{ campo: "operadora", op: "igual", valor: "Particular" }], fora: ["remarcada", "erro"] };
let n = 0;
const l = (em: string, extra: Partial<Linha> = {}): Linha => ({
  chave: String(n++),
  colaborador_id: "eu",
  data_agendado_em: em,
  data_agendado_para: em,
  operadora: "Particular",
  procedimento: "CONSULTA OFTALMOLOGICA GERAL - OFTALMOLOGIA",
  situacao: null,
  atendido: null,
  ...extra,
});

describe("curiosidades da retrospectiva", () => {
  // 12 válidos: 8 às terças (06, 13, 20 e 27/10/2026 são terças), 4 às quintas; 1 remarcada que não conta
  const linhas: Linha[] = [
    ...["2026-10-06", "2026-10-06", "2026-10-13", "2026-10-13", "2026-10-20", "2026-10-20", "2026-10-27", "2026-10-27"].map((d) =>
      l(d, { data_agendado_para: "2026-10-30", atendido: true, data_realizacao: "2026-10-30" }),
    ),
    ...["2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"].map((d) => l(d, { procedimento: "TOMOGRAFIA" })),
    l("2026-10-06", { situacao: "remarcada" }),
    l("2026-10-06", { colaborador_id: "outra" }),
  ];
  const base = {
    linhas,
    ids: ["eu"],
    regras,
    comp: "2026-10",
    nomeMes: "outubro",
    quem: "voce" as const,
    realizadasClinica: 80,
    logins: ["ana.k"],
  };

  it("fala da parte da clínica, do dia da semana, da espera e do procedimento", () => {
    const c = curiosidadesDoMes({ ...base, validosClinica: null });
    const porId = Object.fromEntries(c.map((x) => [x.id, x]));
    expect(porId.clinica.destaque).toBe("1 em cada 10"); // 8 de 80
    expect(porId.dia_semana.destaque).toBe("terça-feira");
    expect(porId.dia_semana.depois).toContain("66,7%"); // 8 de 12
    expect(porId.procedimento.depois).toBe("foram para consulta oftalmologica geral.");
    expect(c.length).toBeLessThanOrEqual(4);
  });

  it("não mostra a parte da clínica quando ela é pequena demais para motivar", () => {
    const c = curiosidadesDoMes({ ...base, realizadasClinica: 800, validosClinica: null });
    expect(c.find((x) => x.id === "clinica")).toBeUndefined(); // 8 de 800 = 1%
  });

  it("mostra a posição na clínica só de quem vê", () => {
    const clinica = new Map([
      ["ana.k", 12],
      ["b", 30],
      ["c", 9],
      ["d", 8],
      ["e", 7],
      ["f", 6],
      ["g", 6],
      ["h", 5],
      ["i", 2],
    ]);
    const c = curiosidadesDoMes({ ...base, validosClinica: clinica }).find((x) => x.id === "ranking");
    expect(c?.destaque).toBe("25%"); // 2º de 8 (quem marcou menos de 5 não entra)
    const primeiro = curiosidadesDoMes({ ...base, validosClinica: new Map([...clinica, ["b", 3]]) }).find((x) => x.id === "ranking");
    expect(primeiro?.destaque).toBe("ninguém marcou mais");
  });
});
