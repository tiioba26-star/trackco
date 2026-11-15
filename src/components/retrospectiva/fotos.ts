import type { TemaFoto } from "@/engine/fatos-percentuais";

// Fotos de fundo das telas "E sabia que…" (public/retrospectiva/fundos/<tema>.jpg), todas do
// Wikimedia Commons com licença livre. O crédito aparece pequeno no pé da tela, como a licença pede.

export const CREDITOS_FOTOS: Record<TemaFoto, string> = {
  agua: "José Manuel Suárez, CC BY 2.0",
  bebe: "Martin Falbisoner, CC BY-SA 4.0",
  biblia: "DylanMusto14, CC BY-SA 2.0",
  brasil: "NASA Earth Observatory, domínio público",
  cafe: "MarkSweep, domínio público",
  campo: "Gregory Heath/CSIRO, CC BY 3.0",
  celular: "Dennis Cortés, CC0",
  cerebro: "Madalena Simões-Abade, CC BY-SA 4.0",
  ceu: "ADARSHluck, CC BY-SA 4.0",
  chocolate: "Famartin, CC BY-SA 4.0",
  coala: "cuatrok77, CC BY-SA 2.0",
  coracao: "Arek Socha, CC0",
  corrida: "Richard Humphrey, CC BY-SA 2.0",
  cristo: "Donatas Dabravolskas, CC BY-SA 4.0",
  deserto: "Bob Wick/BLM, domínio público",
  espaco: "NASA, ESA e Hubble Heritage Team, domínio público",
  estadio: "Adam Jones, CC BY-SA 2.0",
  floresta: "NASA/MODIS, domínio público",
  frutas: "John Phelan, CC BY-SA 3.0",
  gato: "Jules Verne Times Two, CC BY-SA 4.0",
  gelo: "AWeith, CC BY-SA 4.0",
  golfinho: "NASA, domínio público",
  lua: "Luc Viatour, CC BY-SA 3.0",
  luz: "Maxime Raynal, CC BY 2.0",
  manuscrito: "Ardon Bar Hama, domínio público",
  marte: "ESA & MPS/OSIRIS Team, CC BY-SA 3.0 IGO",
  mel: "Matthew T Rader, CC BY-SA 4.0",
  montanha: "Luca Galuzzi, CC BY-SA 2.5",
  oceano: "Radomianin, CC BY-SA 4.0",
  olho: "Mcorrens, CC BY-SA 3.0",
  ossos: "Mrshaxas, CC BY-SA 4.0",
  ouro: "Ibex73, CC BY 4.0",
  relogio: "Jorge Royan, CC BY-SA 3.0",
  salvador: "Paul R. Burley, CC BY-SA 4.0",
  sol: "NASA/SDO, domínio público",
  terra: "NASA/Apollo 17, domínio público",
  vulcao: "Giles Laurent, CC BY-SA 4.0",
};

export const fotoDoTema = (tema: TemaFoto) => ({ src: `/retrospectiva/fundos/${tema}.jpg`, credito: CREDITOS_FOTOS[tema] });
