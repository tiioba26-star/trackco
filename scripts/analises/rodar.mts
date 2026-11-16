// Rotina das análises comentadas pela IA (área Gestão). Roda pelo Agendador de Tarefas do Windows (scripts/analises/agendado.ps1)
// às 5h e às 13h, pela assinatura do Claude Code de quem está logado (sem chave de API).
//
//   npm run analises:rodar                         rodada normal (só o que mudou; dia 1 refaz tudo o que fechou)
//   npm run analises:rodar -- --tudo               refaz as 101
//   npm run analises:rodar -- --amostra            calibração de gasto (não publica; grava em analises/.dados/amostra)
//   npm run analises:rodar -- --sem-publicar       não faz commit/push
//   npm run analises:rodar -- --secao faturamento  só uma seção (e não refaz a geral)
//   npm run analises:rodar -- --so faturamento__mes__anterior__particular.md --modelo haiku --esforco low   (teste)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { formatarDataBR, hojeNoFuso } from "@/engine/datas";
import {
  ARQUIVO_GERAL,
  ARQUIVO_STATUS,
  NOME_RECORTE,
  PASTA_ANALISES,
  SECOES_IA,
  conferirAnalise,
  lerArquivo,
  limparTexto,
  montarArquivo,
  nomeArquivo,
  trechoDaSecao,
  type SecaoIA,
  type StatusAnalises,
} from "@/lib/analises/arquivos";
import { montarTrabalhos, type Trabalho } from "@/lib/analises/dados";
import { LimiteDeUso, acharClaude, chamarClaude, type UsoClaude } from "@/lib/analises/motor-claude";

const RAIZ = resolve(".");
const PASTA = join(RAIZ, PASTA_ANALISES);
const PROMPTS = join(RAIZ, "analises", "prompts");
const DADOS = join(RAIZ, "analises", ".dados");

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const valor = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

interface Config {
  secoes: { modelo: string; esforco: string };
  geral: { modelo: string; esforco: string };
  paralelo: number;
}
const config = JSON.parse(readFileSync(join(RAIZ, "analises", "config.json"), "utf8")) as Config;

const log = (...m: unknown[]) => console.log(new Date().toLocaleTimeString("pt-BR"), ...m);

function lerExistente(arquivo: string) {
  const p = join(PASTA, arquivo);
  return existsSync(p) ? lerArquivo(readFileSync(p, "utf8")) : null;
}

function mensagemDa(t: Trabalho, resumos = ""): string {
  const guia = readFileSync(join(PROMPTS, t.tipo === "geral" ? "geral.md" : `${t.secao}.md`), "utf8").trim();
  if (t.tipo === "geral") {
    return `${guia}\n\nDADOS (JSON):\n${JSON.stringify(t.dados)}\n\nRESUMOS DE HOJE:\n${resumos || "(nenhum)"}`;
  }
  const c = t.dados.contexto as Record<string, unknown>;
  return [
    guia,
    "",
    `RECORTE: ${NOME_RECORTE[t.recorte!]}`,
    `PERÍODO: ${c.periodo} (${c.datas})${c.periodo_em_andamento ? " · em andamento" : ""} · COMPARAÇÃO: ${c.comparacao ?? "nenhuma"} · DADOS ATÉ: ${c.dados_ate}`,
    "",
    "DADOS (JSON):",
    JSON.stringify(t.dados),
  ].join("\n");
}

/** Escreve uma análise (tenta de novo uma vez se o texto vier fora do formato). */
async function escrever(t: Trabalho, bin: string, modelo: string, esforco: string, resumos = ""): Promise<{ corpo: string; uso: UsoClaude }> {
  const base = mensagemDa(t, resumos);
  const tipo = t.tipo === "geral" ? "geral" : "secao";
  let mensagem = base;
  let ultimo: { corpo: string; uso: UsoClaude } | null = null;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const { texto, uso } = await chamarClaude({ bin, modelo, esforco, arquivoSistema: join(PROMPTS, "base.md"), mensagem });
    const corpo = limparTexto(texto);
    const problemas = conferirAnalise(corpo, tipo);
    const acumulado: UsoClaude = ultimo ? somarUso(ultimo.uso, uso) : uso;
    if (!problemas.length) return { corpo, uso: acumulado };
    ultimo = { corpo, uso: acumulado };
    mensagem = `${base}\n\nSUA RESPOSTA ANTERIOR TEVE ESTES PROBLEMAS; ESCREVA DE NOVO CORRIGINDO:\n- ${problemas.join("\n- ")}`;
    log(`  ${t.arquivo}: refazendo (${problemas.join("; ")})`);
  }
  throw new Error(`fora do formato depois de 2 tentativas: ${conferirAnalise(ultimo!.corpo, tipo).join("; ")}`);
}

function somarUso(a: UsoClaude, b: UsoClaude): UsoClaude {
  return {
    modelo: b.modelo,
    entrada: a.entrada + b.entrada,
    saida: a.saida + b.saida,
    pensamento: a.pensamento + b.pensamento,
    cache_lido: a.cache_lido + b.cache_lido,
    cache_criado: a.cache_criado + b.cache_criado,
    custo_usd: a.custo_usd + b.custo_usd,
  };
}

function gravar(t: Trabalho, corpo: string, uso: UsoClaude, esforco: string, pasta = PASTA) {
  const texto = montarArquivo(
    {
      ...t.meta,
      modelo: uso.modelo,
      esforco,
      gerado_em: new Date().toISOString(),
      assinatura: t.assinatura,
      tokens_entrada: uso.entrada + uso.cache_lido + uso.cache_criado,
      tokens_saida: uso.saida,
      custo_equivalente_usd: uso.custo_usd.toFixed(4),
    },
    corpo,
  );
  mkdirSync(pasta, { recursive: true });
  writeFileSync(join(pasta, t.arquivo), texto, "utf8");
}

/** Resumo + pontos de atenção das análises mais úteis para a geral (mês, mês passado e 12 meses, nos dois recortes). */
function resumosParaGeral(): string {
  const partes: string[] = [];
  for (const [periodo, comparacao] of [
    ["mes", "anterior"],
    ["mes_passado", "anterior"],
    ["12m", "ano"],
  ] as const) {
    for (const recorte of ["particular", "todas"] as const) {
      for (const secao of SECOES_IA) {
        const a = lerExistente(nomeArquivo(secao, periodo, comparacao, recorte));
        if (!a) continue;
        const resumo = trechoDaSecao(a.corpo, "## Resumo");
        const atencao = trechoDaSecao(a.corpo, "## Pontos de atenção");
        partes.push(`### ${secao} · ${a.meta.janela_nome ?? periodo} × ${a.meta.base_nome ?? comparacao} · ${NOME_RECORTE[recorte]}\n${resumo}\nPontos de atenção:\n${atencao}`);
      }
    }
  }
  return partes.join("\n\n");
}

/** Roda uma lista de tarefas com no máximo N ao mesmo tempo; para de puxar novas se o limite de uso acabar. */
async function emParalelo<T>(itens: T[], n: number, fn: (x: T) => Promise<void>, parar: () => boolean) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, n) }, async () => {
      while (i < itens.length && !parar()) {
        const x = itens[i++];
        await fn(x);
      }
    }),
  );
}

function git(...a: string[]) {
  return execFileSync("git", a, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function publicar(dadosAte: string) {
  git("add", PASTA_ANALISES);
  const mudou = git("diff", "--cached", "--name-only");
  if (!mudou) {
    log("Nada novo para publicar.");
    return;
  }
  git("commit", "-m", `Análises da IA · dados até ${formatarDataBR(dadosAte).slice(0, 5)}`);
  git("pull", "--rebase", "--autostash", "origin", "main");
  git("push", "origin", "HEAD:main");
  log(`Publicado (${mudou.split("\n").length} arquivos).`);
}

async function main() {
  const hoje = valor("--hoje") ?? hojeNoFuso();
  const secao = valor("--secao") as SecaoIA | undefined;
  const so = valor("--so");
  const amostra = flag("--amostra");
  const bin = acharClaude();
  log(`Claude: ${bin}`);
  log("Montando os dados…");
  const { ref, trabalhos } = await montarTrabalhos(hoje, { secoes: secao ? [secao] : undefined });
  mkdirSync(DADOS, { recursive: true });
  for (const t of trabalhos) writeFileSync(join(DADOS, `${t.arquivo}.json`), JSON.stringify(t.dados, null, 1), "utf8");
  log(`${trabalhos.length} análises possíveis · dados até ${formatarDataBR(ref.ontem)}${ref.virouMes ? " · virou o mês: refaz tudo o que fechou" : ""}`);

  // ---------------------------------------------------------------- calibração de gasto
  if (amostra) {
    const escolhidos = ["faturamento", "marcacao", "perdas"].map((s) => nomeArquivo(s as SecaoIA, "mes_passado", "anterior", "particular"));
    const pasta = join(DADOS, "amostra");
    const configs = [
      { nome: "sonnet-medio", modelo: "sonnet", esforco: "medium" },
      { nome: "opus-medio", modelo: "opus", esforco: "medium" },
    ];
    const linhas: string[] = [];
    for (const c of configs) {
      for (const arq of escolhidos) {
        const t = trabalhos.find((x) => x.arquivo === arq)!;
        const { corpo, uso } = await escrever(t, bin, c.modelo, c.esforco);
        gravar({ ...t, arquivo: `${c.nome}__${t.arquivo}` }, corpo, uso, c.esforco, pasta);
        linhas.push(`${c.nome}\t${arq}\t${uso.entrada + uso.cache_lido + uso.cache_criado} entrada\t${uso.saida} saída (${uso.pensamento} pensando)\tUS$ ${uso.custo_usd.toFixed(4)}`);
        log(linhas.at(-1));
      }
    }
    const geral = trabalhos.find((x) => x.tipo === "geral")!;
    const { corpo, uso } = await escrever(geral, bin, config.geral.modelo, config.geral.esforco, resumosParaGeral());
    gravar({ ...geral, arquivo: `geral-${config.geral.modelo}-${config.geral.esforco}.md` }, corpo, uso, config.geral.esforco, pasta);
    linhas.push(`geral ${config.geral.modelo}/${config.geral.esforco}\t${uso.entrada + uso.cache_lido + uso.cache_criado} entrada\t${uso.saida} saída (${uso.pensamento} pensando)\tUS$ ${uso.custo_usd.toFixed(4)}`);
    log(linhas.at(-1));
    writeFileSync(join(pasta, "gasto.txt"), linhas.join("\n") + "\n", "utf8");
    log(`Amostra pronta em ${pasta}. Compare os textos e veja a % semanal em claude.ai/settings/usage.`);
    return;
  }

  // ---------------------------------------------------------------- o que precisa sair hoje
  const tudo = flag("--tudo");
  const precisa = (t: Trabalho) => {
    if (so) return t.arquivo === so;
    const a = lerExistente(t.arquivo);
    if (tudo || !a) return true;
    if (a.meta.dados_ate === ref.ontem) return false; // já feito hoje (a repescagem das 13h não refaz)
    if (ref.virouMes || t.sempre) return true;
    return a.meta.assinatura !== t.assinatura;
  };
  const secoes = trabalhos.filter((t) => t.tipo === "secao" && precisa(t));
  const semMudanca = trabalhos.filter((t) => t.tipo === "secao").length - secoes.length;
  log(`${secoes.length} análises por seção para escrever (${semMudanca} sem mudança).`);

  const modeloSecoes = valor("--modelo") ?? config.secoes.modelo;
  const esforcoSecoes = valor("--esforco") ?? config.secoes.esforco;
  const status: StatusAnalises = {
    gerado_em: new Date().toISOString(),
    dados_ate: ref.ontem,
    feitas: 0,
    sem_mudanca: semMudanca,
    falhas: [],
    pendentes: [],
    tokens: { entrada: 0, saida: 0, pensamento: 0, cache: 0 },
    custo_equivalente_usd: 0,
    por_modelo: {},
    limite_atingido: false,
  };
  const registrar = (uso: UsoClaude) => {
    status.feitas++;
    status.tokens.entrada += uso.entrada + uso.cache_criado;
    status.tokens.cache += uso.cache_lido;
    status.tokens.saida += uso.saida;
    status.tokens.pensamento += uso.pensamento;
    status.custo_equivalente_usd = Math.round((status.custo_equivalente_usd + uso.custo_usd) * 10000) / 10000;
    const m = (status.por_modelo[uso.modelo] ??= { analises: 0, custo_equivalente_usd: 0 });
    m.analises++;
    m.custo_equivalente_usd = Math.round((m.custo_equivalente_usd + uso.custo_usd) * 10000) / 10000;
  };

  const feitos = new Set<string>();
  await emParalelo(
    secoes,
    config.paralelo,
    async (t) => {
      try {
        const { corpo, uso } = await escrever(t, bin, modeloSecoes, esforcoSecoes);
        gravar(t, corpo, uso, esforcoSecoes);
        registrar(uso);
        feitos.add(t.arquivo);
        log(`  ok ${t.arquivo} · ${uso.modelo} · US$ ${uso.custo_usd.toFixed(3)}`);
      } catch (e) {
        if (e instanceof LimiteDeUso) status.limite_atingido = true;
        status.falhas.push({ arquivo: t.arquivo, erro: (e as Error).message.slice(0, 300) });
        log(`  FALHOU ${t.arquivo}: ${(e as Error).message.slice(0, 200)}`);
      }
    },
    () => status.limite_atingido,
  );
  status.pendentes = secoes.filter((t) => !feitos.has(t.arquivo) && !status.falhas.some((f) => f.arquivo === t.arquivo)).map((t) => t.arquivo);

  // ---------------------------------------------------------------- a geral, por último
  const geral = trabalhos.find((t) => t.tipo === "geral");
  const existente = lerExistente(ARQUIVO_GERAL);
  const fazerGeral = !secao && !so && geral && !status.limite_atingido && (tudo || !existente || existente.meta.dados_ate !== ref.ontem || feitos.size > 0);
  if (fazerGeral && geral) {
    try {
      log("Escrevendo a análise geral…");
      const { corpo, uso } = await escrever(geral, bin, config.geral.modelo, config.geral.esforco, resumosParaGeral());
      gravar(geral, corpo, uso, config.geral.esforco);
      registrar(uso);
      log(`  ok geral · ${uso.modelo} · US$ ${uso.custo_usd.toFixed(3)}`);
    } catch (e) {
      if (e instanceof LimiteDeUso) status.limite_atingido = true;
      status.falhas.push({ arquivo: ARQUIVO_GERAL, erro: (e as Error).message.slice(0, 300) });
      log(`  FALHOU geral: ${(e as Error).message.slice(0, 200)}`);
    }
  } else if (status.limite_atingido) {
    status.pendentes.push(ARQUIVO_GERAL);
  }

  if (!so) writeFileSync(join(PASTA, ARQUIVO_STATUS), JSON.stringify(status, null, 2) + "\n", "utf8");
  log(
    `Fim: ${status.feitas} escritas, ${status.falhas.length} falhas, ${status.pendentes.length} pendentes · ` +
      `${status.tokens.entrada + status.tokens.cache} tokens de entrada, ${status.tokens.saida} de saída · US$ ${status.custo_equivalente_usd.toFixed(2)} (equivalente API)`,
  );
  if (!flag("--sem-publicar") && !so) publicar(ref.ontem);
  if (status.falhas.length && !status.feitas) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
