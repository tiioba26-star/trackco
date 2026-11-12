"use client";

import { useEffect, useRef } from "react";

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

export function ConfetesTv({ disparar }: { disparar: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!disparar) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let largura = (canvas.width = window.innerWidth);
    let altura = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      largura = canvas.width = window.innerWidth;
      altura = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // Criação das partículas
    const totalParticulas = 85;
    const particulas: Particula[] = [];

    for (let i = 0; i < totalParticulas; i++) {
      // Dispara principalmente do topo e dos cantos superiores
      const origemX = Math.random() < 0.5 ? largura * 0.2 + Math.random() * (largura * 0.6) : Math.random() * largura;
      particulas.push({
        x: origemX,
        y: -20 - Math.random() * 50,
        w: 8 + Math.random() * 8,
        h: 12 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 5,
        rotacao: Math.random() * 360,
        vRotacao: (Math.random() - 0.5) * 12,
        cor: CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)],
        opacidade: 1,
        forma: Math.random() > 0.4 ? "retangulo" : "circulo",
      });
    }

    let animId: number;
    let tempoInicio = Date.now();
    const duracaoMs = 4500;

    const render = () => {
      const decorrido = Date.now() - tempoInicio;
      ctx.clearRect(0, 0, largura, altura);

      let vivas = false;

      for (const p of particulas) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravidade suave
        p.rotacao += p.vRotacao;

        // Desvanecer perto do final
        if (decorrido > duracaoMs - 1200) {
          p.opacidade = Math.max(0, (duracaoMs - decorrido) / 1200);
        }

        if (p.y < altura + 40 && p.opacidade > 0.01) {
          vivas = true;
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

      if (vivas && decorrido < duracaoMs) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, largura, altura);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [disparar]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" />;
}

