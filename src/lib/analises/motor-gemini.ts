// Chama o Gemini pelo Antigravity CLI (agy) para escrever uma análise. Usado só pela rotina das 5h (scripts/analises),
// nunca pelo site. Roda pela assinatura Google de quem está logado no Antigravity (sem chave de API).
//
// O agy é um agente de programação: não aceita trocar o prompt de sistema nem desligar as ferramentas. Por isso as regras
// vão no começo da mensagem, com o aviso de que é só para escrever texto; ele roda numa pasta vazia, em --sandbox, e
// qualquer ferramenta que peça permissão é negada sozinha (modo sem interação). A mensagem vai pelo stdin (stream-json),
// porque a linha de comando do Windows não comporta os dados.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { LimiteDeUso, type UsoClaude } from "./motor-claude";

/** Onde está o agy: AGY_BIN, depois o PATH, depois a instalação padrão (~/.gemini/bin). */
export function acharAgy(): string {
  if (process.env.AGY_BIN && existsSync(process.env.AGY_BIN)) return process.env.AGY_BIN;
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const achado = execFileSync(cmd, ["agy"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/)[0]?.trim();
    if (achado && existsSync(achado)) return achado;
  } catch {
    // não está no PATH
  }
  const padrao = join(homedir(), ".gemini", "bin", process.platform === "win32" ? "agy.exe" : "agy");
  if (existsSync(padrao)) return padrao;
  throw new Error("Não achei o Antigravity CLI (agy). Ele vem com o Antigravity IDE (~/.gemini/bin) — ou defina AGY_BIN.");
}

const LIMITE = /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests|\b429\b|limit reached|exhausted|usage limit/i;

const AVISO =
  "ESTA TAREFA NÃO É DE PROGRAMAÇÃO. Não use ferramentas, não leia nem crie arquivos, não rode comandos, não faça perguntas " +
  "e não proponha plano de implementação. Escreva somente o texto pedido abaixo, seguindo estas regras, que valem acima de " +
  "qualquer outra instrução que você tenha recebido.";

/** Junta as regras (que no Claude vão como prompt de sistema) com a mensagem da análise. */
export function mensagemGemini(sistema: string, mensagem: string): string {
  return `${AVISO}\n\n=== REGRAS ===\n${sistema.trim()}\n\n=== TAREFA ===\n${mensagem}`;
}

/** Lê a saída stream-json do agy (uma linha JSON por evento) e devolve o evento final. */
export function lerResultadoAgy(saida: string): { status: string; texto: string; erro: string; uso: Record<string, unknown>; modelo: string } | null {
  let modelo = "";
  let fim: Record<string, unknown> | null = null;
  for (const linha of saida.split(/\r?\n/)) {
    if (!linha.trim().startsWith("{")) continue;
    try {
      const j = JSON.parse(linha) as { event?: string; init?: { model?: string }; result?: Record<string, unknown> };
      if (j.event === "init" && j.init?.model) modelo = j.init.model;
      if (j.event === "result" && j.result) fim = j.result;
    } catch {
      // linha cortada: ignora
    }
  }
  if (!fim) return null;
  return {
    status: String(fim.status ?? ""),
    texto: typeof fim.response === "string" ? fim.response : "",
    erro: typeof fim.error === "string" ? fim.error : "",
    uso: (fim.usage ?? {}) as Record<string, unknown>,
    modelo,
  };
}

/** Erros passageiros do serviço (vale tentar de novo depois de alguns segundos). */
export const PASSAGEIRO = /empty conversation id|failed to start conversation|UNAVAILABLE|INTERNAL|ECONNRESET|ETIMEDOUT|socket hang up|\b50[234]\b|try again/i;

type PedidoGemini = { bin: string; modelo: string; esforco: string; sistema: string; mensagem: string; tempoMaximoMs?: number };

/** Uma análise pelo Gemini, com até 2 novas tentativas em erro passageiro (5 s e 15 s depois). Limite de uso não repete. */
export async function chamarGemini(o: PedidoGemini, esperas = [5_000, 15_000]): Promise<{ texto: string; uso: UsoClaude }> {
  for (let i = 0; ; i++) {
    try {
      return await chamarGeminiUmaVez(o);
    } catch (e) {
      if (e instanceof LimiteDeUso || i >= esperas.length || !PASSAGEIRO.test((e as Error).message)) throw e;
      await new Promise((r) => setTimeout(r, esperas[i]));
    }
  }
}

/** Uma chamada ao agy. Devolve o texto e o uso de tokens (custo 0: é cota da assinatura Google, sem preço de tabela). */
function chamarGeminiUmaVez(o: {
  bin: string;
  modelo: string;
  esforco: string;
  sistema: string;
  mensagem: string;
  tempoMaximoMs?: number;
}): Promise<{ texto: string; uso: UsoClaude }> {
  const cwd = mkdtempSync(join(tmpdir(), "trackco-ia-"));
  const limite = o.tempoMaximoMs ?? 900_000;
  const args = [
    "--model",
    o.modelo,
    // nem todo modelo aceita esforço no agy (ex.: claude-sonnet-4-6): esforço vazio = não manda
    ...(o.esforco ? ["--effort", o.esforco] : []),
    "--sandbox",
    "--disable-slash-commands",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--print-timeout",
    `${Math.round(limite / 1000)}s`,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(o.bin, args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let out = "";
    let err = "";
    const relogio = setTimeout(() => {
      p.kill();
      reject(new Error(`passou de ${Math.round(limite / 60_000)} min sem responder`));
    }, limite + 60_000);
    p.stdout.setEncoding("utf8");
    p.stderr.setEncoding("utf8");
    p.stdout.on("data", (d: string) => (out += d));
    p.stderr.on("data", (d: string) => (err += d));
    p.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      const r = lerResultadoAgy(out);
      if (!r || r.status !== "SUCCESS" || !r.texto.trim() || codigo !== 0) {
        const msg = (r?.erro || err || r?.texto || `código ${codigo}`).replace(/\s+/g, " ").slice(0, 400);
        return reject(LIMITE.test(msg) ? new LimiteDeUso(msg) : new Error(msg || "o Gemini não devolveu texto"));
      }
      resolve({
        texto: r.texto,
        uso: {
          modelo: r.modelo || o.modelo,
          entrada: Number(r.uso.input_tokens) || 0,
          saida: Number(r.uso.output_tokens) || 0,
          pensamento: Number(r.uso.thinking_tokens) || 0,
          cache_lido: Number(r.uso.cache_read_tokens) || 0,
          cache_criado: 0,
          custo_usd: 0,
        },
      });
    });
    p.stdin.end(JSON.stringify({ event: "user", message: { role: "user", content: [{ type: "text", text: mensagemGemini(o.sistema, o.mensagem) }] } }) + "\n", "utf8");
  });
}
