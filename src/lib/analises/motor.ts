// Escolhe o motor de cada análise, conforme analises/config.json. São duas contas diferentes:
// - "claude": Claude Code pela assinatura da Anthropic (a mesma usada para programar: gastar pouco);
// - "antigravity": Antigravity CLI (agy) pela assinatura Google AI Pro, com os modelos que `agy models` lista
//   (Gemini 3.8 Flash e também Claude Sonnet/Opus 4.6 da cota do Google). "gemini" é o nome antigo do mesmo motor.
// Se o motor principal bater no limite de uso e houver "reserva", o resto da rodada segue pela reserva.
import { readFileSync } from "node:fs";
import { LimiteDeUso, acharClaude, chamarClaude, type UsoClaude } from "./motor-claude";
import { acharAgy, chamarGemini } from "./motor-gemini";

export type Motor = "claude" | "antigravity" | "gemini";

/** "gemini" e "antigravity" são o mesmo programa (agy). */
const pelaGoogle = (m: Motor | undefined) => m === "antigravity" || m === "gemini";

export interface ConfigMotor {
  /** "claude" (padrão; conta Anthropic) ou "antigravity" (conta Google; "gemini" também vale) */
  motor?: Motor;
  modelo: string;
  esforco: string;
  /** quantas ao mesmo tempo neste grupo (padrão: o "paralelo" geral) */
  paralelo?: number;
  /** motor usado quando este bate no limite de uso (ex.: o Gemini acabou → segue no Claude Sonnet da cota do Google) */
  reserva?: Omit<ConfigMotor, "reserva">;
}

export interface ConfigAnalises {
  secoes: ConfigMotor;
  geral: ConfigMotor;
  paralelo: number;
  /** no máximo quantas análises por seção numa rodada (as mais importantes primeiro); o resto fica para a próxima */
  maximo_por_rodada?: number;
}

const binarios: Partial<Record<"claude" | "agy", string>> = {};
function binario(m: Motor): string {
  return pelaGoogle(m) ? (binarios.agy ??= acharAgy()) : (binarios.claude ??= acharClaude());
}

/** O motor está instalado nesta máquina? (sem lançar erro) */
export function temMotor(m: Motor): boolean {
  try {
    binario(m);
    return true;
  } catch {
    return false;
  }
}

export function onde(m: Motor): string {
  return binario(m);
}

/** Uma chamada no motor indicado. arquivoSistema = regras de todas as análises (analises/prompts/base.md). */
export function chamarMotor(c: Omit<ConfigMotor, "reserva">, arquivoSistema: string, mensagem: string): Promise<{ texto: string; uso: UsoClaude }> {
  if (pelaGoogle(c.motor)) {
    return chamarGemini({ bin: binario("antigravity"), modelo: c.modelo, esforco: c.esforco, sistema: readFileSync(arquivoSistema, "utf8"), mensagem });
  }
  return chamarClaude({ bin: binario("claude"), modelo: c.modelo, esforco: c.esforco, arquivoSistema, mensagem });
}

/**
 * Um grupo (seções ou geral) com a troca para a reserva: depois do primeiro limite, todas as chamadas seguintes do grupo
 * vão direto para a reserva. Sem reserva, o LimiteDeUso sobe e a rodada para de puxar novas análises.
 */
export class GrupoMotor {
  private usandoReserva = false;
  constructor(
    readonly config: ConfigMotor,
    private readonly avisar: (m: string) => void = () => {},
  ) {}

  /** Configuração em uso agora (a principal ou, depois de um limite, a reserva). */
  get atual(): Omit<ConfigMotor, "reserva"> {
    return this.usandoReserva && this.config.reserva ? this.config.reserva : this.config;
  }

  get trocouParaReserva() {
    return this.usandoReserva;
  }

  async chamar(arquivoSistema: string, mensagem: string): Promise<{ texto: string; uso: UsoClaude; esforco: string }> {
    const c = this.atual;
    try {
      return { ...(await chamarMotor(c, arquivoSistema, mensagem)), esforco: c.esforco };
    } catch (e) {
      if (!(e instanceof LimiteDeUso) || !this.config.reserva || this.usandoReserva) throw e;
      this.usandoReserva = true;
      const r = this.config.reserva;
      this.avisar(`Limite de uso em ${c.motor ?? "claude"}/${c.modelo}: o resto segue pela reserva (${r.motor ?? "claude"}/${r.modelo}). ${e.message.slice(0, 160)}`);
      return { ...(await chamarMotor(r, arquivoSistema, mensagem)), esforco: r.esforco };
    }
  }
}
