"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { marcarParabensVisto } from "@/app/(app)/acoes-parabens";
import { Button } from "@/components/ui/button";
import type { Parabens } from "@/lib/dados/aniversarios";
import { Contagem, Grande, Historias, Linha, type Slide } from "./retrospectiva";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const n = (v: number) => v.toLocaleString("pt-BR");

/** "cerca de 1,1 bilhão" / "cerca de 730 milhões" (uns 100 mil batidas por dia) */
function batidas(dias: number): string {
  const total = dias * 100_000;
  if (total >= 1e9) {
    const b = Math.floor(total / 1e8) / 10;
    return `${b.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${b < 2 ? "bilhão" : "bilhões"}`;
  }
  return `${n(Math.floor(total / 1e7) * 10)} milhões`;
}

function montarSlides(d: Parabens, fechar: () => void): Slide[] {
  const s: Slide[] = [];
  const diaAniversario = `${Number(d.aniversario.slice(8, 10))} de ${MESES[Number(d.aniversario.slice(5, 7)) - 1]}`;

  s.push({
    fundo: "from-[#db2777] via-[#e11d48] to-[#f59e0b]",
    festa: true,
    segundos: 10,
    conteudo: (
      <>
        <Linha atraso={0.1} className="text-sm font-semibold tracking-widest text-white/80 uppercase">
          {d.ehHoje ? "Hoje é o seu aniversário" : `O seu aniversário foi ${diaAniversario}`}
        </Linha>
        <Grande>🎂</Grande>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-6xl font-black tracking-tight">
          {d.primeiroNome}
        </motion.h2>
        <Linha atraso={0.9}>{d.mensagem}</Linha>
      </>
    ),
  });

  s.push({
    fundo: "from-[#0f766e] via-[#0e7490] to-[#1c5cab]",
    segundos: 9,
    conteudo:
      d.atendimentos && d.atendimentos > 0 ? (
        <>
          <Linha atraso={0.1}>Obrigado por fazer a diferença. Nos últimos 12 meses,</Linha>
          <Grande>
            <Contagem valor={d.atendimentos} />
          </Grande>
          <Linha>consultas e exames aconteceram na IOBA porque você marcou.</Linha>
          <Linha atraso={1.3} className="text-white/80">
            Cada um deles é alguém cuidando da visão. Isso também é obra sua.
          </Linha>
        </>
      ) : (
        <>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-4xl font-black tracking-tight">
            Obrigado por fazer a diferença
          </motion.h2>
          <Linha atraso={0.7}>O seu trabalho ajuda a IOBA a cuidar da visão de muita gente, todos os dias.</Linha>
        </>
      ),
  });

  s.push({
    fundo: "from-[#4c1d95] via-[#6d28d9] to-[#9333ea]",
    segundos: 10,
    conteudo: (
      <>
        <Linha atraso={0.1}>Você nasceu numa</Linha>
        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, type: "spring", stiffness: 120 }} className="text-5xl font-black tracking-tight sm:text-6xl">
          {d.nascimento.diaDaSemana}
        </motion.div>
        <Linha>{d.nascimento.porExtenso}</Linha>
        <Linha atraso={1.2} className="text-white/85">
          Até hoje foram <b>{n(d.nascimento.diasDeVida)}</b> dias de vida, <b>{n(d.nascimento.luasCheias)}</b> luas cheias e cerca de{" "}
          <b>{batidas(d.nascimento.diasDeVida)}</b> de batidas do coração.
        </Linha>
      </>
    ),
  });

  if (d.nascimento.fatoDoAno)
    s.push({
      fundo: "from-[#b45309] via-[#c2410c] to-[#be185d]",
      segundos: 9,
      conteudo: (
        <>
          <Linha atraso={0.1}>No ano em que você nasceu,</Linha>
          <Grande>{d.nascimento.ano}</Grande>
          <Linha>{d.nascimento.fatoDoAno}</Linha>
        </>
      ),
    });

  s.push({
    fundo: "from-[#0f172a] via-[#1e3a8a] to-[#1c5cab]",
    segundos: 16,
    conteudo: (
      <>
        <Linha atraso={0.1} className="text-sm font-semibold tracking-widest text-white/75 uppercase">
          Uma palavra para você 🙏
        </Linha>
        <motion.blockquote
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl leading-snug font-semibold italic"
        >
          “{d.versiculo.texto}”
        </motion.blockquote>
        <Linha atraso={0.9} className="font-semibold text-white/85">
          {d.versiculo.referencia} (NVI)
        </Linha>
        <Linha atraso={1.6}>{d.versiculo.convite}</Linha>
      </>
    ),
  });

  s.push({
    fundo: "from-[#1c5cab] via-[#4338ca] to-[#db2777]",
    festa: true,
    conteudo: (
      <>
        <Linha atraso={0.1}>Que Deus abençoe o seu novo ano de vida.</Linha>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-5xl font-black tracking-tight">
          Parabéns, {d.primeiroNome}! 🎉
        </motion.h2>
        <Linha atraso={0.8}>Com carinho, equipe IOBA.</Linha>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="pt-4">
          <Button size="lg" variant="secondary" onClick={fechar}>
            Continuar
          </Button>
        </motion.div>
      </>
    ),
  });
  return s;
}

/**
 * Parabéns do aniversário: abre sozinho no dia (ou na primeira visita depois) e não abre de novo
 * depois de fechado. Fica por cima de tudo, até da pesquisa obrigatória.
 */
export function HistoriaParabens({ dados }: { dados: Parabens }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAberto(true), 400);
    return () => clearTimeout(t);
  }, []);
  const fechar = useCallback(() => {
    setAberto(false);
    void marcarParabensVisto();
  }, []);
  if (!aberto) return null;
  return (
    <Historias
      slides={montarSlides(dados, fechar)}
      titulo={`Feliz aniversário, ${dados.primeiroNome}`}
      rotulo="seu aniversário"
      onFechar={fechar}
      camada="z-[80]"
    />
  );
}
