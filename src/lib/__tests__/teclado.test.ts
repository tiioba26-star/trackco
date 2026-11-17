import { describe, expect, it } from "vitest";
import { teclaEmCampoDeTexto } from "../teclado";

describe("teclaEmCampoDeTexto", () => {
  it("campos de texto: o atalho não age", () => {
    expect(teclaEmCampoDeTexto({ tagName: "TEXTAREA" })).toBe(true);
    expect(teclaEmCampoDeTexto({ tagName: "input", type: "text" })).toBe(true);
    expect(teclaEmCampoDeTexto({ tagName: "INPUT" })).toBe(true);
    expect(teclaEmCampoDeTexto({ tagName: "SELECT" })).toBe(true);
    expect(teclaEmCampoDeTexto({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });
  it("botões, caixas de marcar e o resto da página: o atalho age", () => {
    expect(teclaEmCampoDeTexto({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(teclaEmCampoDeTexto({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(teclaEmCampoDeTexto({ tagName: "BUTTON" })).toBe(false);
    expect(teclaEmCampoDeTexto({ tagName: "BODY" })).toBe(false);
    expect(teclaEmCampoDeTexto(null)).toBe(false);
  });
});
