// "Você sabia?" da retrospectiva: comparações que fazem a pessoa (ou a equipe) se ver no todo da clínica,
// no estilo "você está entre os 2% que mais ouviram". Nada aqui expõe outra pessoa: só a posição de quem vê.
import { diaDaSemanaISO, fimCompetencia, inicioCompetencia } from "./datas";
import { passaFiltros } from "./metricas";
import type { RegrasProducao } from "./producao";
import type { Linha } from "./tipos";

export interface Curiosidade {
  id: "clinica" | "ranking" | "dia_semana" | "antecedencia" | "procedimento";
  emoji: string;
  /** frase antes do número grande */
  antes: string;
  /** o número grande (ou a palavra grande) */
  destaque: string;
  /** frase depois */
  depois: string;
}

const DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
const DIAS_PLURAL = ["segundas", "terças", "quartas", "quintas", "sextas", "sábados", "domingos"];
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** "CONSULTA OFTALMOLOGICA GERAL - OFTALMOLOGIA" → "consulta oftalmologica geral" */
function procedimentoLegivel(p: string): string {
  return p.split(" - ")[0].trim().toLowerCase();
}

export function curiosidadesDoMes(op: {
  linhas: Linha[];
  /** de quem são os números: a pessoa ou os membros da equipe */
  ids: string[];
  regras: RegrasProducao;
  comp: string;
  nomeMes: string;
  /** "voce" fala com a pessoa; "equipe" fala da equipe (versão do líder) */
  quem: "voce" | { equipe: string };
  /** consultas Particular realizadas na clínica toda no mês */
  realizadasClinica: number | null;
  /** agendamentos válidos Particular de cada login da clínica no mês */
  validosClinica: Map<string, number> | null;
  /** login(s) de quem vê, para achar a posição na clínica */
  logins: string[];
}): Curiosidade[] {
  const ini = inicioCompetencia(op.comp);
  const fim = fimCompetencia(op.comp);
  const fora = new Set(op.regras.fora);
  const minhas = op.linhas.filter((l) => l.colaborador_id && op.ids.includes(l.colaborador_id) && passaFiltros(l, op.regras.base));
  const validos = minhas.filter((l) => {
    const em = String(l.data_agendado_em ?? "").slice(0, 10);
    return em >= ini && em <= fim && !fora.has(String(l.situacao ?? ""));
  });
  const realizadas = minhas.filter((l) => {
    const r = String(l.data_realizacao ?? "").slice(0, 10);
    return l.atendido === true && r >= ini && r <= fim;
  }).length;
  const nomeEquipe = op.quem === "voce" ? null : op.quem.equipe;
  const voce = nomeEquipe === null;
  const porQuem = voce ? "por você" : `pela equipe ${nomeEquipe}`;
  const out: Curiosidade[] = [];

  // 1. parte das consultas da clínica
  // só quando motiva: uma parte pequena (ex.: 1 em cada 112) não entra
  const parte = op.realizadasClinica ? (realizadas / op.realizadasClinica) * 100 : 0;
  if (op.realizadasClinica && realizadas >= 3 && parte >= 3) {
    const umEmCada = Math.max(1, Math.round(op.realizadasClinica / realizadas));
    out.push({
      id: "clinica",
      emoji: "🏥",
      antes: `Das ${op.realizadasClinica.toLocaleString("pt-BR")} consultas Particular que aconteceram na IOBA em ${op.nomeMes},`,
      destaque: umEmCada <= 1 ? pct(parte) : `1 em cada ${umEmCada}`,
      depois: `foi marcada ${porQuem} (${pct(parte)} do total).`,
    });
  }

  // 2. posição entre todas as pessoas que marcam na clínica (só a de quem vê)
  if (op.validosClinica && op.validosClinica.size) {
    const ativos = Array.from(op.validosClinica.entries()).filter(([, v]) => v >= 5);
    const meus = op.logins.reduce((s, l) => s + (op.validosClinica!.get(l.toLowerCase()) ?? 0), 0);
    if (voce && meus >= 5 && ativos.length >= 5) {
      const acima = ativos.filter(([, v]) => v > meus).length;
      const posicao = acima + 1;
      const topo = Math.max(1, Math.ceil((posicao / ativos.length) * 100));
      if (posicao === 1)
        out.push({
          id: "ranking",
          emoji: "👑",
          antes: `Entre as ${ativos.length} pessoas que marcaram consultas Particular na IOBA em ${op.nomeMes},`,
          destaque: "ninguém marcou mais",
          depois: `que você. Foram ${meus} agendamentos válidos.`,
        });
      else if (topo <= 50)
        out.push({
          id: "ranking",
          emoji: "🌟",
          antes: "Você ficou entre os",
          destaque: `${topo}%`,
          depois: `que mais marcaram consultas Particular em toda a IOBA em ${op.nomeMes} (${ativos.length} pessoas marcaram).`,
        });
    } else if (!voce) {
      const total = Array.from(op.validosClinica.values()).reduce((s, v) => s + v, 0);
      const daEquipe = validos.length;
      if (total > 0 && daEquipe > 0)
        out.push({
          id: "ranking",
          emoji: "🌟",
          antes: `De todos os agendamentos Particular válidos da IOBA em ${op.nomeMes},`,
          destaque: pct((daEquipe / total) * 100),
          depois: `foram feitos pela equipe ${nomeEquipe}.`,
        });
    }
  }

  // 3. dia da semana preferido
  if (validos.length >= 10) {
    const porDia = new Array(7).fill(0) as number[];
    for (const l of validos) porDia[diaDaSemanaISO(String(l.data_agendado_em).slice(0, 10)) - 1]++;
    const max = Math.max(...porDia);
    const d = porDia.indexOf(max);
    out.push({
      id: "dia_semana",
      emoji: "📅",
      antes: voce ? "Seu dia de marcar foi" : "O dia mais forte da equipe foi",
      destaque: DIAS[d],
      depois: `${pct((max / validos.length) * 100)} dos ${voce ? "seus " : ""}pacientes válidos foram marcados às ${DIAS_PLURAL[d]}.`,
    });
  }

  // 4. quanto tempo o paciente espera entre a marcação e a consulta
  const esperas = validos
    .filter((l) => typeof l.data_agendado_para === "string")
    .map((l) => diasEntre(String(l.data_agendado_em).slice(0, 10), String(l.data_agendado_para).slice(0, 10)))
    .filter((x) => x >= 0);
  if (esperas.length >= 10) {
    const media = esperas.reduce((s, x) => s + x, 0) / esperas.length;
    const naSemana = (esperas.filter((x) => x <= 7).length / esperas.length) * 100;
    out.push({
      id: "antecedencia",
      emoji: "⏱️",
      antes: `Da marcação até a consulta, ${voce ? "seus pacientes" : "os pacientes da equipe"} esperaram em média`,
      destaque: `${Math.round(media)} ${Math.round(media) === 1 ? "dia" : "dias"}`,
      depois: `${pct(naSemana)} foram atendidos em até uma semana.`,
    });
  }

  // 5. procedimento mais marcado
  if (validos.length >= 10) {
    const cont = new Map<string, number>();
    for (const l of validos) {
      const p = procedimentoLegivel(String(l.procedimento ?? ""));
      if (p) cont.set(p, (cont.get(p) ?? 0) + 1);
    }
    const [nome, qtd] = Array.from(cont.entries()).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (nome && qtd / validos.length >= 0.3)
      out.push({
        id: "procedimento",
        emoji: "👁️",
        antes: voce ? "Dos seus pacientes válidos," : "Dos pacientes válidos da equipe,",
        destaque: pct((qtd / validos.length) * 100),
        depois: `foram para ${nome}.`,
      });
  }
  return out.slice(0, 4);
}
