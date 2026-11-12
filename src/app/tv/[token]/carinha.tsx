"use client";

import { motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import type { Carinha as TipoCarinha } from "@/engine/apuracao";

interface AvatarProps {
  tipo: TipoCarinha;
  cor: string;
  tamanho?: number;
  posicao?: number;
  atingimento?: number | null;
}

/** Ícone de perfil anônimo moderno e elegante (silhueta minimalista de colaborador) */
function AvatarAnonimo({ cor, tamanho = 54 }: { cor: string; tamanho?: number }) {
  const gradId = useId();

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_4px_14px_rgba(0,0,0,0.6)]"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="60%" stopColor={cor} stopOpacity="0.3" />
          <stop offset="100%" stopColor="#071329" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      {/* Círculo de fundo escuro tecnológico com anel luminoso */}
      <circle cx="32" cy="32" r="29" fill={`url(#${gradId})`} stroke={cor} strokeWidth="3" />

      {/* Silhueta minimalista anônima de perfil */}
      {/* Cabeça */}
      <circle cx="32" cy="24" r="8.5" fill="#ffffff" fillOpacity="0.92" />
      {/* Ombros / busto */}
      <path
        d="M17 50 C17 38 23 37 32 37 C41 37 47 38 47 50"
        fill="#ffffff"
        fillOpacity="0.92"
      />
    </svg>
  );
}

/** Rostinho facial expressivo, minimalista e corporativo (estilo idêntico à referência) */
export function RostinhoExpressao({
  tipo,
  cor,
  tamanho = 54,
}: {
  tipo: TipoCarinha;
  cor: string;
  tamanho?: number;
}) {
  const isSuper = tipo === "mega_feliz";
  const isFeliz = tipo === "feliz";
  const gradId = useId();

  return (
    <div className="relative flex items-center justify-center">
      {/* Raios / Feixes de celebração no topo para quem superou a meta (idêntico à imagem de referência) */}
      {isSuper && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <svg width={tamanho * 0.75} height={tamanho * 0.38} viewBox="0 0 36 18" fill="none">
            {/* Raio central */}
            <path d="M18 16 L18 3" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
            {/* Raio esquerdo inclinado */}
            <path d="M11 16 L5 6" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />
            {/* Raio direito inclinado */}
            <path d="M25 16 L31 6" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
      >
        <defs>
          <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="85%" stopColor="#e0f2fe" stopOpacity="1" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Fundo do rosto: branco luminoso com anel da cor da barra */}
        <circle cx="32" cy="32" r="29" fill={`url(#${gradId})`} stroke={cor} strokeWidth="3" />

        {isSuper ? (
          <>
            {/* Super Feliz: Olhos fechados curvados de alegria extrema (^ ^) */}
            <path
              d="M19 28 Q24 20 29 28"
              stroke="#0b172a"
              strokeWidth="3.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M35 28 Q40 20 45 28"
              stroke="#0b172a"
              strokeWidth="3.4"
              fill="none"
              strokeLinecap="round"
            />

            {/* Sorriso aberto radiante (:D) */}
            <path
              d="M19 35 Q32 50 45 35 Z"
              fill="#0b172a"
            />
            {/* Dentes brancos no topo do sorriso */}
            <path
              d="M22 36 Q32 39 42 36"
              stroke="#ffffff"
              strokeWidth="2.2"
              fill="none"
            />
            {/* Bochechas rosadas sutis */}
            <circle cx="16" cy="35" r="3" fill="#f43f5e" fillOpacity="0.45" />
            <circle cx="48" cy="35" r="3" fill="#f43f5e" fillOpacity="0.45" />
          </>
        ) : isFeliz ? (
          <>
            {/* Feliz: Olhos circulares brilhantes */}
            <circle cx="23" cy="26" r="3.4" fill="#0b172a" />
            <circle cx="41" cy="26" r="3.4" fill="#0b172a" />

            {/* Sorriso aberto elegante */}
            <path
              d="M21 35 Q32 46 43 35"
              stroke="#0b172a"
              strokeWidth="3.6"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <>
            {/* Neutro: Olhos focados e determinados */}
            <circle cx="23" cy="28" r="3.2" fill="#0b172a" />
            <circle cx="41" cy="28" r="3.2" fill="#0b172a" />

            {/* Boca serena e reta */}
            <path
              d="M24 41 L40 41"
              stroke="#0b172a"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

/** Componente principal da ponta da barra: alterna assincronamente entre avatar de perfil e carinha animada */
export function AvatarAnimadoTv({
  tipo,
  cor,
  tamanho = 54,
  posicao = 0,
}: AvatarProps) {
  // Maioria do tempo = avatar de perfil anônimo; de vez em quando = carinha com expressão
  const [modo, setModo] = useState<"perfil" | "carinha">("perfil");

  useEffect(() => {
    let ativo = true;
    let timerId: ReturnType<typeof setTimeout>;

    // Cada colaborador tem um ritmo de transição único e aleatório para não mudarem juntos
    const agendarProximaTroca = () => {
      // Se está em perfil: fica entre 8s e 16s antes de mostrar a carinha
      const tempoEspera =
        modo === "perfil"
          ? 7000 + Math.random() * 8000 + (posicao % 4) * 1500
          : 3800 + Math.random() * 1500; // Tempo em que a carinha fica visível (~4 a 5s)

      timerId = setTimeout(() => {
        if (!ativo) return;
        setModo((prev) => (prev === "perfil" ? "carinha" : "perfil"));
      }, tempoEspera);
    };

    agendarProximaTroca();

    return () => {
      ativo = false;
      clearTimeout(timerId);
    };
  }, [modo, posicao]);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: tamanho, height: tamanho }}
    >
      <motion.div
        key={modo}
        initial={{ scale: 0.85, opacity: 0, rotateY: modo === "carinha" ? 90 : -90 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        exit={{ scale: 0.85, opacity: 0, rotateY: 90 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex items-center justify-center"
      >
        {modo === "perfil" ? (
          <AvatarAnonimo cor={cor} tamanho={tamanho} />
        ) : (
          <RostinhoExpressao tipo={tipo} cor={cor} tamanho={tamanho} />
        )}
      </motion.div>
    </div>
  );
}

// Mantém export do componente Carinha clássico para retrocompatibilidade
export function Carinha({
  tipo,
  cor,
  tamanho = 56,
}: {
  tipo: TipoCarinha;
  cor: string;
  tamanho?: number;
}) {
  return <RostinhoExpressao tipo={tipo} cor={cor} tamanho={tamanho} />;
}
