"use client";

/** Olho Humano Tecnológico no Fundo (identidade visual IOBA com alta fidelidade à imagem de referência) */
export function OlhoFundoIoba() {
  return (
    <div
      className="pointer-events-none absolute -top-[6vw] -right-[6vw] w-[50vw] h-[50vw] select-none opacity-25 mix-blend-screen"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_40px_rgba(56,189,248,0.35)]"
      >
        <defs>
          <radialGradient id="iris_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#020817" stopOpacity="1" />
            <stop offset="35%" stopColor="#0b2347" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#0284c7" stopOpacity="0.8" />
            <stop offset="85%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.1" />
          </radialGradient>

          <radialGradient id="pupila_grad" cx="45%" cy="42%" r="50%">
            <stop offset="0%" stopColor="#020617" stopOpacity="1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Arcos externos da órbita / pálpebras estilizadas */}
        <path
          d="M30 250 C120 100 380 100 470 250"
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeOpacity="0.35"
        />
        <path
          d="M30 250 C120 400 380 400 470 250"
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeOpacity="0.35"
        />
        <path
          d="M60 250 C150 130 350 130 440 250"
          stroke="#0284c7"
          strokeWidth="1.2"
          strokeOpacity="0.25"
        />
        <path
          d="M60 250 C150 370 350 370 440 250"
          stroke="#0284c7"
          strokeWidth="1.2"
          strokeOpacity="0.25"
        />

        {/* Círculos concêntricos da Íris */}
        <circle cx="250" cy="250" r="160" stroke="#38bdf8" strokeWidth="2.5" strokeOpacity="0.45" />
        <circle cx="250" cy="250" r="150" stroke="#0ea5e9" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="4 8" />
        <circle cx="250" cy="250" r="140" fill="url(#iris_glow)" />

        {/* Linhas e fibras radiais da íris (textura biológica tecnológica) */}
        {Array.from({ length: 48 }).map((_, i) => {
          const ang = (i * 360) / 48;
          const rad = (ang * Math.PI) / 180;
          const r1 = 65 + (i % 3) * 8;
          const r2 = 135 - (i % 2) * 6;
          const x1 = 250 + Math.cos(rad) * r1;
          const y1 = 250 + Math.sin(rad) * r1;
          const x2 = 250 + Math.cos(rad) * r2;
          const y2 = 250 + Math.sin(rad) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={i % 2 === 0 ? "#7dd3fc" : "#0284c7"}
              strokeWidth={i % 3 === 0 ? "2.2" : "1.2"}
              strokeOpacity={0.45 + (i % 4) * 0.1}
            />
          );
        })}

        {/* Anéis intermediários luminosos */}
        <circle cx="250" cy="250" r="95" stroke="#38bdf8" strokeWidth="1.8" strokeOpacity="0.6" strokeDasharray="6 4" />
        <circle cx="250" cy="250" r="75" stroke="#7dd3fc" strokeWidth="2" strokeOpacity="0.5" />

        {/* Pupila Central profunda */}
        <circle cx="250" cy="250" r="58" fill="url(#pupila_grad)" stroke="#38bdf8" strokeWidth="2.8" strokeOpacity="0.8" />

        {/* Ponto de reflexo de luz na pupila */}
        <circle cx="232" cy="232" r="12" fill="#ffffff" fillOpacity="0.75" />
        <circle cx="260" cy="260" r="4.5" fill="#38bdf8" fillOpacity="0.65" />
      </svg>
    </div>
  );
}

