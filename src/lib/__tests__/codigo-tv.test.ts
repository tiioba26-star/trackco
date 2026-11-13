import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ criarClienteAdmin: () => null }));
const { gerarCodigos } = await import("@/lib/codigo-tv");

const PESSOAS = Array.from({ length: 40 }, (_, i) => ({ id: `id-${i}`, criado_em: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }));

describe("código da TV", () => {
  it("4 dígitos, sem repetir no mesmo dia", () => {
    const c = gerarCodigos(PESSOAS, "2026-11-13", "s");
    expect([...c.values()].every((x) => /^\d{4}$/.test(x))).toBe(true);
    expect(new Set(c.values()).size).toBe(PESSOAS.length);
  });
  it("igual no mesmo dia, diferente no dia seguinte", () => {
    const hoje = gerarCodigos(PESSOAS, "2026-11-13", "s");
    expect(gerarCodigos(PESSOAS, "2026-11-13", "s")).toEqual(hoje);
    const amanha = gerarCodigos(PESSOAS, "2026-11-14", "s");
    const iguais = PESSOAS.filter((p) => hoje.get(p.id) === amanha.get(p.id)).length;
    expect(iguais).toBeLessThan(3);
  });
});
