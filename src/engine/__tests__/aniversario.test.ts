import { describe, expect, it } from "vitest";
import {
  FATOS_DO_ANO,
  MENSAGENS_PARABENS,
  VERSICULOS_ANIVERSARIO,
  aniversarioNoAno,
  curiosidadesDoNascimento,
  mensagemDeParabens,
  parabensPendente,
  ultimoAniversario,
  versiculoDeAniversario,
} from "../aniversario";

describe("aniversário", () => {
  it("parabeniza no dia ou na primeira visita depois, e só uma vez por ano", () => {
    expect(parabensPendente("1995-11-15", null, "2026-11-15")).toBe("2026-11-15");
    expect(parabensPendente("1995-11-10", null, "2026-11-15")).toBe("2026-11-10"); // não abriu o site no dia
    expect(parabensPendente("1995-11-10", "2026-11-12", "2026-11-15")).toBeNull(); // já viu
    expect(parabensPendente("1995-11-10", "2025-11-10", "2026-11-15")).toBe("2026-11-10"); // viu o do ano passado
    expect(parabensPendente("1995-11-20", null, "2026-11-15")).toBeNull(); // ainda não chegou
    expect(parabensPendente("1995-09-01", null, "2026-11-15")).toBeNull(); // passou da janela de 30 dias
    expect(parabensPendente("1995-12-28", null, "2027-01-05")).toBe("2026-12-28"); // virada do ano
    expect(parabensPendente(null, null, "2026-11-15")).toBeNull();
  });

  it("quem nasceu em 29 de fevereiro comemora no dia 28 nos anos que não são bissextos", () => {
    expect(aniversarioNoAno("2000-02-29", 2027)).toBe("2027-02-28");
    expect(aniversarioNoAno("2000-02-29", 2028)).toBe("2028-02-29");
    expect(ultimoAniversario("2000-02-29", "2027-03-01")).toBe("2027-02-28");
  });

  it("no mesmo ano, 30 pessoas recebem 30 mensagens e 30 versículos diferentes", () => {
    expect(MENSAGENS_PARABENS.length).toBeGreaterThanOrEqual(30);
    expect(VERSICULOS_ANIVERSARIO.length).toBeGreaterThanOrEqual(30);
    for (const ano of [2026, 2027, 2031]) {
      const msgs = Array.from({ length: 30 }, (_, i) => mensagemDeParabens("Ana", i, ano));
      const vers = Array.from({ length: 30 }, (_, i) => versiculoDeAniversario(i, ano).referencia);
      expect(new Set(msgs).size).toBe(30);
      expect(new Set(vers).size).toBe(30);
    }
  });

  it("a mesma pessoa recebe mensagem e versículo diferentes a cada ano", () => {
    for (const pos of [0, 7, 29]) {
      for (let ano = 2026; ano < 2031; ano++) {
        expect(mensagemDeParabens("Ana", pos, ano + 1)).not.toBe(mensagemDeParabens("Ana", pos, ano));
        expect(versiculoDeAniversario(pos, ano + 1).referencia).not.toBe(versiculoDeAniversario(pos, ano).referencia);
      }
      // a tela da retrospectiva não repete a mensagem dos parabéns do dia
      expect(mensagemDeParabens("Ana", pos, 2026, 17)).not.toBe(mensagemDeParabens("Ana", pos, 2026));
    }
    expect(mensagemDeParabens("Ana", 0, 2026)).toContain("Ana");
    expect(mensagemDeParabens("Ana", 0, 2026)).not.toContain("{nome}");
  });

  it("calcula o dia em que nasceu e quanto já viveu", () => {
    const c = curiosidadesDoNascimento("1995-03-12", "2026-03-12");
    expect(c.diaDaSemana).toBe("domingo"); // 12/03/1995 foi um domingo
    expect(c.diasDeVida).toBe(11323);
    expect(c.luasCheias).toBe(383);
    expect(c.batidasBilhoes).toBe(1.1);
    expect(c.fatoDoAno).toContain("Toy Story");
    for (let a = 1950; a <= 2012; a++) expect(FATOS_DO_ANO[a], String(a)).toBeTruthy();
  });
});
