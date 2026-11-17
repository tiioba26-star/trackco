// Chama o Claude Code de terminal (claude -p) para escrever uma análise. Usado só pela rotina das 5h (scripts/analises),
// nunca pelo site. Roda pela assinatura de quem está logado no Claude Code (sem chave de API), sem ferramentas,
// de uma pasta neutra e em --safe-mode (não carrega CLAUDE.md, skills nem plugins).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface UsoClaude {
  modelo: string;
  entrada: number;
  saida: number;
  pensamento: number;
  cache_lido: number;
  cache_criado: number;
  /** custo equivalente pelo preço de tabela da API (régua para comparar; na assinatura não é cobrado assim) */
  custo_usd: number;
}

export class LimiteDeUso extends Error {}

/**
 * O claude do PATH, como programa que dá para abrir sem shell. No Windows, o npm instala três atalhos ("claude", script
 * de sh; "claude.cmd"; "claude.ps1"): aceitamos só .exe, ou seguimos o .cmd até o claude.exe que ele chama.
 */
export function executavelNoPath(): string | null {
  let achados: string[] = [];
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    achados = execFileSync(cmd, ["claude"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return null; // não está no PATH
  }
  for (const a of achados) {
    if (!existsSync(a)) continue;
    if (process.platform !== "win32" || /\.exe$/i.test(a)) return a;
    if (/\.cmd$/i.test(a)) {
      const alvo = alvoDoCmd(readFileSync(a, "utf8"));
      if (alvo && existsSync(join(dirname(a), alvo))) return join(dirname(a), alvo);
    }
  }
  return null;
}

/** No atalho .cmd do npm, o .exe chamado: "%dp0%\node_modules\...\claude.exe" → caminho relativo à pasta do atalho. */
export function alvoDoCmd(texto: string): string | null {
  return /"%dp0%\\([^"]+\.exe)"/i.exec(texto)?.[1] ?? null;
}

/** Onde está o claude: CLAUDE_BIN, depois o PATH, depois a extensão mais nova do Antigravity / VS Code / Cursor. */
export function acharClaude(): string {
  if (process.env.CLAUDE_BIN && existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const doPath = executavelNoPath();
  if (doPath) return doPath;
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  const versao = (nome: string) => (nome.match(/(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1).map(Number);
  for (const ide of [".antigravity-ide", ".vscode", ".cursor", ".vscode-insiders"]) {
    const pasta = join(homedir(), ide, "extensions");
    if (!existsSync(pasta)) continue;
    const candidatos = readdirSync(pasta)
      .filter((n) => n.startsWith("anthropic.claude-code-"))
      .sort((a, b) => {
        const [x, y] = [versao(a), versao(b)];
        for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
        return 0;
      });
    for (const c of candidatos) {
      const bin = join(pasta, c, "resources", "native-binary", exe);
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error("Não achei o Claude Code (claude). Instale com: irm https://claude.ai/install.ps1 | iex — ou defina CLAUDE_BIN.");
}

const LIMITE = /usage limit|limit reached|hit your limit|out of extra usage|rate limit|limite de uso/i;

/** Uma análise: system = regras (arquivo), mensagem pelo stdin. Devolve o texto e o uso de tokens. */
export function chamarClaude(o: {
  bin: string;
  modelo: string;
  esforco: string;
  arquivoSistema: string;
  mensagem: string;
  tempoMaximoMs?: number;
}): Promise<{ texto: string; uso: UsoClaude }> {
  const cwd = mkdtempSync(join(tmpdir(), "trackco-ia-"));
  const args = [
    "-p",
    "--model",
    o.modelo,
    "--effort",
    o.esforco,
    "--tools",
    "",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--safe-mode",
    "--system-prompt-file",
    o.arquivoSistema,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(o.bin, args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let out = "";
    let err = "";
    const relogio = setTimeout(() => {
      p.kill();
      reject(new Error(`passou de ${Math.round((o.tempoMaximoMs ?? 900_000) / 60_000)} min sem responder`));
    }, o.tempoMaximoMs ?? 900_000);
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
      let j: Record<string, unknown> | null = null;
      try {
        j = JSON.parse(out) as Record<string, unknown>;
      } catch {
        j = null;
      }
      const texto = typeof j?.result === "string" ? j.result : "";
      if (!j || j.is_error || j.subtype !== "success" || codigo !== 0) {
        const msg = (texto || err || out || `código ${codigo}`).slice(0, 400);
        return reject(LIMITE.test(msg) ? new LimiteDeUso(msg) : new Error(msg));
      }
      const u = (j.usage ?? {}) as Record<string, unknown>;
      const det = (u.output_tokens_details ?? {}) as Record<string, unknown>;
      const modelos = Object.keys((j.modelUsage ?? {}) as Record<string, unknown>);
      resolve({
        texto,
        uso: {
          modelo: modelos[0] ?? o.modelo,
          entrada: Number(u.input_tokens) || 0,
          saida: Number(u.output_tokens) || 0,
          pensamento: Number(det.thinking_tokens) || 0,
          cache_lido: Number(u.cache_read_input_tokens) || 0,
          cache_criado: Number(u.cache_creation_input_tokens) || 0,
          custo_usd: Number(j.total_cost_usd) || 0,
        },
      });
    });
    p.stdin.end(o.mensagem, "utf8");
  });
}
