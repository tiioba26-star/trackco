"use client";

import { useEffect, useRef } from "react";

export interface DisparoConfete {
  id: number;
  x: number;
  y: number;
}

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
}

const CORES_CONFETE = [
  "#38bdf8", // ciano neon
  "#60a5fa", // azul vibrante
  "#a855f7", // violeta neon
  "#34d399", // verde esmeralda
  "#fbbf24", // dourado
  "#f472b6", // rosa neon
  "#ffffff", // branco brilho
];

export function ConfetesTv({ disparo }: { disparo: DisparoConfete | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particulasRef = useRef<Particula[]>([]);
  const animIdRef = useRef<number | null>(null);

  // Escuta novos disparos a partir de coordenadas específicas (ex: bolinha de perfil)
  useEffect(() => {
    if (!disparo) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Criar ~65 partículas explodindo da coordenada (disparo.x, disparo.y)
    const novasParticulas: Particula[] = [];
    const total = 70;

    for (let i = 0; i < total; i++) {
      // Ângulo de explosão com dispersão radial ampla e preferência para cima e lados
      const angulo = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 1.3);
      const velocidade = 6 + Math.random() * 9;

      novasParticulas.push({
        x: disparo.x,
        y: disparo.y,
        w: 8 + Math.random() * 7,
        h: 11 + Math.random() * 9,
        vx: Math.cos(angulo) * velocidade + (Math.random() - 0.5) * 3,
        vy: Math.sin(angulo) * velocidade - 2,
        rotacao: Math.random() * 360,
        vRotacao: (Math.random() - 0.5) * 16,
        cor: CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)],
        opacidade: 1,
        forma: Math.random() > 0.35 ? "retangulo" : "circulo",
        vida: 0,
        vidaMax: 160 + Math.floor(Math.random() * 60),
      });
    }

    particulasRef.current.push(...novasParticulas);

    // Iniciar loop de animação se não estiver rodando
    if (!animIdRef.current) {
      const render = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const vivas: Particula[] = [];

        for (const p of particulasRef.current) {
          p.vida++;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.14; // gravidade suave
          p.vx *= 0.985; // resistência do ar
          p.rotacao += p.vRotacao;

          // Fade out nos últimos 40 frames
          if (p.vida > p.vidaMax - 40) {
            p.opacidade = Math.max(0, (p.vidaMax - p.vida) / 40);
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

  // Redimensionamento
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
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" />;
}
