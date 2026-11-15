import { describe, expect, it } from "vitest";
import { FATOS_EXATOS, LIVROS_DA_BIBLIA, MODELOS, capituloDaBiblia, fatoDaRetrospectiva, fatoDoMes, fatosReais } from "../fatos-percentuais";

const mesesSeguidos = (de: string, n: number) => {
  const [a, m] = de.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = a * 12 + (m - 1) + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  });
};
const citaExato = (texto: string, p: number) => new RegExp(`(?<![\\d,])${p}%`).test(texto);

describe("fatos com a mesma porcentagem da tela", () => {
  it("todo fato real cita exatamente o seu número", () => {
    for (const f of FATOS_EXATOS) {
      expect(Number.isInteger(f.valor) && f.valor >= 1 && f.valor <= 100, f.texto).toBe(true);
      expect(citaExato(f.texto, f.valor), f.texto).toBe(true);
      expect(f.texto.length, f.texto).toBeLessThanOrEqual(150);
    }
    const textos = FATOS_EXATOS.map((f) => f.texto);
    expect(new Set(textos).size).toBe(textos.length);
  });

  it("os fatos calculados valem para qualquer número de 1 a 100 e citam esse número", () => {
    expect(MODELOS.length).toBeGreaterThanOrEqual(12);
    for (let p = 1; p <= 100; p++) {
      for (const m of MODELOS) {
        const t = m.texto(p);
        expect(citaExato(t, p), `${m.id} ${p}: ${t}`).toBe(true);
        expect(t, `${m.id} ${p}`).not.toMatch(/NaN|undefined|null|Infinity/);
      }
    }
  });

  it("a Bíblia tem 66 livros e 1.189 capítulos (929 no Antigo Testamento)", () => {
    expect(LIVROS_DA_BIBLIA.length).toBe(66);
    expect(LIVROS_DA_BIBLIA.reduce((s, [, c]) => s + c, 0)).toBe(1189);
    expect(LIVROS_DA_BIBLIA.slice(0, 39).reduce((s, [, c]) => s + c, 0)).toBe(929);
    expect(capituloDaBiblia(1)).toBe("Gênesis 1");
    expect(capituloDaBiblia(51)).toBe("Êxodo 1");
    expect(capituloDaBiblia(1189)).toBe("Apocalipse 22");
  });

  it("quem tirar a mesma porcentagem todo mês vê um fato diferente em cada um dos 12 meses", () => {
    for (let p = 1; p <= 100; p++) {
      const vistos = mesesSeguidos("2026-09", 12).map((c) => fatoDoMes(p, c)!.texto);
      expect(new Set(vistos).size, `${p}%`).toBe(12);
      for (const t of vistos) expect(citaExato(t, p), t).toBe(true);
    }
  });

  it("com porcentagens variando, ninguém vê o mesmo fato duas vezes em 12 meses", () => {
    let semente = 11;
    const sorteio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let pessoa = 0; pessoa < 300; pessoa++) {
      const vistos: string[] = [];
      for (const comp of mesesSeguidos("2026-01", 12)) {
        // as telas da retrospectiva: posição, parte da clínica, comparecimento e dia mais forte
        const telas = [0, 1, 2, 3].map((i) => ({ id: i, p: sorteio() < 0.15 ? null : 1 + Math.floor(sorteio() * 80) }));
        const r = fatoDaRetrospectiva(telas, comp);
        if (r) vistos.push(r.fato.texto);
      }
      expect(new Set(vistos).size).toBe(vistos.length);
    }
  });

  it("a tela do fato prefere um fato real e cita o número da própria tela", () => {
    const comp = "2026-10"; // contador % 12 = 9
    const comReal = Array.from({ length: 100 }, (_, i) => i + 1).find((p) => fatosReais(p).length > 9)!;
    const r = fatoDaRetrospectiva([{ id: "a", p: 61 }, { id: "b", p: comReal }], comp)!;
    expect(r.tela.id).toBe("b");
    expect(citaExato(r.fato.texto, comReal)).toBe(true);
    expect(fatoDaRetrospectiva([{ id: "a", p: null }], comp)).toBeNull();
  });

  it("nenhum fato toca em temas que incomodam quem tem fé, e há curiosidades da Bíblia", () => {
    const proibidos = /chimpanz|macaco|neandert|antepassad|ancestra|evolu|extint|milh(õ|o)es de anos|bilh(õ|o)es de anos|big bang/i;
    for (const f of FATOS_EXATOS) expect(f.texto, f.texto).not.toMatch(proibidos);
    for (const m of MODELOS) expect(m.texto(50)).not.toMatch(proibidos);
    expect(FATOS_EXATOS.filter((f) => f.emoji === "📖").length).toBeGreaterThanOrEqual(20);
  });
});
