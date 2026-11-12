"use client";

import { useEffect, useRef } from "react";

export interface DisparoConfete {
  id: number;
  x: number;
  y: number;
}

// =========================================================================
// 🎛️ PAINEL DE CONTROLE DOS PARÂMETROS DO CONFETE
// Altere os valores abaixo conforme sua preferência visual:
// =========================================================================
export const CONFIG_CONFETE = {
  // Quantidade de partículas geradas a cada estouro
  totalParticulas: 85,

  // Limite máximo de partículas simultâneas na tela (para não travar TVs ou navegadores)
  limiteMaximoCanvas: 150,

  // Força do pulo inicial para cima (quanto maior, mais alto ele sobe)
  forcaExplosaoBase: 2.5,
  forcaExplosaoVariacao: 2.5,

  // Velocidade de descida (gravidade):
  // 0.05 a 0.08 = flutua bem devagar como papel de festa
  // 0.15 a 0.25 = cai mais rápido e pesado
  gravidade: 0.065,

  // Resistência do ar (desacelera a velocidade horizontal): 0.98 = suave
  resistenciaAr: 0.985,

  // Oscilação lateral (efeito de zigue-zague flutuante no vento):
  oscilacaoVento: 0.35,

  // Duração na tela em frames a 60fps (180 frames = ~3.2 a 4 segundos):
  duracaoMinFrames: 170,
  duracaoVarFrames: 50,

  // Tamanho das partículas
  larguraMin: 7,
  larguraMax: 13,
  alturaMin: 10,
  alturaMax: 18,
};

interface Particula {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rotacao: number;
  vRotacao: number;
  cor: string;
  opacidade: number;
  forma: "retangulo" | "circulo";
  vida: number;
  vidaMax: number;
  balancoFase: number;
}

export const CORES_CONFETE = [
  "#38bdf8", // ciano neon
  "#60a5fa", // azul vibrante
  "#a855f7", // violeta neon
  "#34d399", // verde esmeralda
  "#fbbf24", // dourado festa
  "#f472b6", // rosa neon
  "#ffffff", // branco brilho
];

export function ConfetesTv({ disparo }: { disparo: DisparoConfete | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particulasRef = useRef<Particula[]>([]);
  const animIdRef = useRef<number | null>(null);
  const ultimoIdProcessado = useRef<number>(0);

  useEffect(() => {
    if (!disparo || disparo.id === ultimoIdProcessado.current) return;
    ultimoIdProcessado.current = disparo.id;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Proteção de sobrecarga
    if (particulasRef.current.length > CONFIG_CONFETE.limiteMaximoCanvas) {
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const novasParticulas: Particula[] = [];

    for (let i = 0; i < CONFIG_CONFETE.totalParticulas; i++) {
      // Ângulo em leque aberto para cima (-160° a -20°)
      const angulo = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 1.25);
      const velocidade =
        CONFIG_CONFETE.forcaExplosaoBase + Math.random() * CONFIG_CONFETE.forcaExplosaoVariacao;

      novasParticulas.push({
        x: disparo.x,
        y: disparo.y,
        w: CONFIG_CONFETE.larguraMin + Math.random() * (CONFIG_CONFETE.larguraMax - CONFIG_CONFETE.larguraMin),
        h: CONFIG_CONFETE.alturaMin + Math.random() * (CONFIG_CONFETE.alturaMax - CONFIG_CONFETE.alturaMin),
        vx: Math.cos(angulo) * velocidade + (Math.random() - 0.5) * 2,
        vy: Math.sin(angulo) * velocidade - 2.5,
        rotacao: Math.random() * 360,
        vRotacao: (Math.random() - 0.5) * 12,
        cor: CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)],
        opacidade: 1,
        forma: Math.random() > 0.35 ? "retangulo" : "circulo",
        vida: 0,
        vidaMax: CONFIG_CONFETE.duracaoMinFrames + Math.floor(Math.random() * CONFIG_CONFETE.duracaoVarFrames),
        balancoFase: Math.random() * Math.PI * 2,
      });
    }

    particulasRef.current.push(...novasParticulas);

    if (!animIdRef.current) {
      const render = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const vivas: Particula[] = [];

        for (const p of particulasRef.current) {
          p.vida++;

          // Gravidade suave (queda mais lenta e realista)
          p.vy += CONFIG_CONFETE.gravidade;
          p.vx *= CONFIG_CONFETE.resistenciaAr;

          // Oscilação de folha caindo no vento
          const vento = Math.sin(p.vida * 0.08 + p.balancoFase) * CONFIG_CONFETE.oscilacaoVento;
          p.x += p.vx + vento;
          p.y += p.vy;

          p.rotacao += p.vRotacao;

          // Fade out gradual nos últimos 45 frames
          if (p.vida > p.vidaMax - 45) {
            p.opacidade = Math.max(0, (p.vidaMax - p.vida) / 45);
          }

          if (p.vida < p.vidaMax && p.y < canvas.height + 40 && p.opacidade > 0.02) {
            vivas.push(p);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotacao * Math.PI) / 180);
            ctx.globalAlpha = p.opacidade;
            ctx.fillStyle = p.cor;

            if (p.forma === "retangulo") {
              ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            } else {
              ctx.beginPath();
              ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          }
        }

        particulasRef.current = vivas;

        if (vivas.length > 0) {
          animIdRef.current = requestAnimationFrame(render);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          animIdRef.current = null;
        }
      };

      animIdRef.current = requestAnimationFrame(render);
    }
  }, [disparo]);

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" />;
}
