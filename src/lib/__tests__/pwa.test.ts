import { describe, expect, it } from "vitest";
import { DIAS_ADIADO, deveConvidar, plataformaDe } from "@/lib/pwa";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_OS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

describe("plataforma", () => {
  it("reconhece iPhone, iPad com iPadOS (Macintosh com toque), Android e computador", () => {
    expect(plataformaDe(IPHONE)).toBe("ios");
    expect(plataformaDe(IPAD_OS, 5)).toBe("ios");
    expect(plataformaDe(IPAD_OS, 0)).toBe("outro"); // Mac de verdade
    expect(plataformaDe(ANDROID)).toBe("android");
    expect(plataformaDe(WINDOWS)).toBe("outro");
  });
});

describe("convite para instalar", () => {
  const agora = Date.UTC(2026, 10, 17);
  const base = { instalado: false, adiadoEm: null, agora, navegadorOferece: false };

  it("iPhone: mostra o passo a passo (não há aviso do navegador)", () => {
    expect(deveConvidar({ ...base, plataforma: "ios" })).toBe(true);
  });

  it("Android: só quando o navegador oferece a instalação", () => {
    expect(deveConvidar({ ...base, plataforma: "android" })).toBe(false);
    expect(deveConvidar({ ...base, plataforma: "android", navegadorOferece: true })).toBe(true);
  });

  it("computador e app já aberto em tela cheia: nunca", () => {
    expect(deveConvidar({ ...base, plataforma: "outro", navegadorOferece: true })).toBe(false);
    expect(deveConvidar({ ...base, plataforma: "ios", instalado: true })).toBe(false);
  });

  it("'Agora não' segura o convite por 14 dias", () => {
    const dia = 86_400_000;
    expect(deveConvidar({ ...base, plataforma: "ios", adiadoEm: agora - 3 * dia })).toBe(false);
    expect(deveConvidar({ ...base, plataforma: "ios", adiadoEm: agora - DIAS_ADIADO * dia })).toBe(true);
  });
});
