import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { carinhaPara, type Carinha } from "@/engine/apuracao";
import { competenciaDe, datasEntre, fimCompetencia, hojeNoFuso, inicioCompetencia, menorData } from "@/engine/datas";
import { calcularMetrica } from "@/engine/metricas";
import type { Linha, Metrica } from "@/engine/tipos";
import { linhasKlingo, membrosDaEquipe } from "@/lib/calculo/carregar";
import { resolverMetrica } from "@/lib/metricas-papel";
import { criarClienteAdmin } from "@/lib/supabase/admin";

// Modo TV: link público sem login. NUNCA devolve nome, foto, iniciais, login, R$, comissão ou pontos.

export type ModoTv = { tipo: "barras"; metrica: string; titulo: string } | { tipo: "geral"; titulo: string };

export interface ConfigTv {
  intervalo: number;
  modos: ModoTv[];
  limites: { feliz: number; mega_feliz: number };
  frases_rodape?: string[];
  subtitulos?: string[];
  mensagens_barra?: {
    meta_batida?: string[];
    quase_la?: string[];
    evoluindo?: string[];
  };
}

export const CONFIG_TV_PADRAO: ConfigTv = {
  intervalo: 30,
  modos: [
    { tipo: "barras", metrica: "agendamentos", titulo: "Agendamentos Particular" },
    { tipo: "barras", metrica: "realizadas", titulo: "Consultas Particular Realizadas" },
    { tipo: "barras", metrica: "agendamentos_sus", titulo: "SUS · Agendamentos" },
    { tipo: "geral", titulo: "Visão Geral da Equipe" },
  ],
  limites: { feliz: 80, mega_feliz: 100 },
  frases_rodape: [
    "Grandes conquistas começam com uma equipe unida.",
    "Cada agendamento aproxima a nossa equipe da superação.",
    "Consistência e dedicação transformam metas em grandes conquistas.",
    "Estamos evoluindo juntos, com foco e alta performance.",
    "Cada conquista importa para o sucesso de todos nós.",
    "Seguimos crescendo e construindo o nosso melhor resultado.",
  ],
  subtitulos: [
    "Ritmo contínuo, consistência e excelência em cada atendimento",
    "Evolução diária da equipe rumo à superação de metas",
    "Foco no paciente, agilidade e resultados de alto impacto",
    "Dedicação diária construindo grandes realizações",
  ],
};

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ItemBarra {
  id: string; // anônimo, estável no dia (para animar as barras)
  valor: number;
  atingimento: number | null;
  carinha: Carinha;
}

export interface TelaTv {
  tipo: "barras" | "geral";
  titulo: string;
  unidade?: string;
  itens?: ItemBarra[];
  geral?: {
    indicadores: { titulo: string; realizado: number; meta: number | null; pct: number | null; unidade: string }[];
    serie: { dia: string; [k: string]: number | string | null }[];
    series: { chave: string; rotulo: string }[];
    carinhas: Record<Carinha, number>;
    pessoas: number;
  };
}

export interface PayloadTv {
  nome: string;
  equipes: string[];
  competencia: string;
  atualizado_em: string | null;
  config: ConfigTv;
  telas: TelaTv[];
}

function anonimo(colabId: string, painelId: string, dia: string): string {
  return createHash("sha256").update(`${painelId}|${dia}|${colabId}`).digest("hex").slice(0, 10);
}

export async function dadosTv(token: string): Promise<PayloadTv | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const db = criarClienteAdmin();
  const { data: painel } = await db
    .from("paineis_tv")
    .select("id, nome, equipes, config, ativo, ultimo_acesso")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!painel || !painel.ativo) return null;

  // registra o acesso no máximo a cada 10 min
  if (!painel.ultimo_acesso || Date.now() - new Date(painel.ultimo_acesso).getTime() > 10 * 60_000) {
    await db.from("paineis_tv").update({ ultimo_acesso: new Date().toISOString() }).eq("id", painel.id);
  }

  const config: ConfigTv = { ...CONFIG_TV_PADRAO, ...(painel.config as Partial<ConfigTv>) };
  const hoje = hojeNoFuso();
  const comp = competenciaDe(hoje);
  const ini = inicioCompetencia(comp);

  const [{ data: equipes }, { data: metricasRows }, { data: sync }] = await Promise.all([
    db.from("equipes").select("id, nome").in("id", painel.equipes as string[]).eq("ativo", true),
    db.from("metricas").select("id, codigo, nome, tipo, unidade, definicao").eq("ativo", true),
    db.from("sync_execucoes").select("finalizado_em").eq("status", "ok").order("iniciado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const listaMetricas = (metricasRows ?? []) as Metrica[];
  const metricaDo = (ref: string) => resolverMetrica(listaMetricas, ref);
  const equipeIds = (equipes ?? []).map((e) => e.id);

  // membros de todas as equipes do painel
  const membros = (
    await Promise.all(equipeIds.map((id) => membrosDaEquipe(db, id, comp)))
  )
    .flat()
    .filter((m) => m.funcao === "membro");
  const unicos = Array.from(new Map(membros.map((m) => [m.colaborador_id, m])).values());
  const ids = unicos.map((m) => m.colaborador_id);
  const porLogin = new Map(unicos.filter((m) => m.login_klingo).map((m) => [m.login_klingo!.toLowerCase(), m.colaborador_id]));

  const [brutas, { data: metas }, { data: aps }] = await Promise.all([
    linhasKlingo(db, Array.from(porLogin.keys()), comp),
    ids.length
      ? db.from("metas").select("metrica_id, colaborador_id, equipe_id, valor").eq("competencia", ini)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db.from("apuracoes").select("colaborador_id, nota").eq("tipo", "parcial").eq("competencia", ini).in("colaborador_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const linhas: Linha[] = brutas.map((l) => ({
    ...l,
    chave: l.chave as string,
    colaborador_id: porLogin.get(String(l.responsavel_login ?? "").toLowerCase()) ?? null,
  }));
  const notaDe = new Map((aps ?? []).map((a) => [a.colaborador_id as string, a.nota === null ? null : Number(a.nota)]));
  const janela = { inicio: ini, fim: fimCompetencia(comp) };
  const metaDe = (metricaId: string, colab: string) =>
    (metas ?? []).find((m) => m.metrica_id === metricaId && m.colaborador_id === colab)?.valor as number | undefined;

  const telas: TelaTv[] = [];
  for (const modo of config.modos) {
    if (modo.tipo === "barras") {
      const m = metricaDo(modo.metrica);
      if (!m || m.unidade === "R$" || m.unidade === "pts") continue; // nunca dinheiro/pontos na TV
      const itens: ItemBarra[] = unicos.map((p) => {
        const valor = calcularMetrica(m.definicao, () => linhas, janela, hoje, [p.colaborador_id]).valor;
        const meta = metaDe(m.id, p.colaborador_id);
        const ating = meta ? Math.round((valor / Number(meta)) * 1000) / 10 : (notaDe.get(p.colaborador_id) ?? null);
        return { id: anonimo(p.colaborador_id, painel.id, hoje), valor, atingimento: ating, carinha: carinhaPara(ating, config.limites) };
      });
      telas.push({ tipo: "barras", titulo: modo.titulo || m.nome, unidade: m.unidade, itens: itens.sort((a, b) => b.valor - a.valor) });
    } else {
      const codigos = config.modos.filter((x): x is Extract<ModoTv, { tipo: "barras" }> => x.tipo === "barras").map((x) => x.metrica);
      const usadas = codigos
        .map((c) => metricaDo(c))
        .filter((m): m is Metrica => !!m && m.unidade !== "R$" && m.unidade !== "pts");
      const indicadores = usadas.map((m) => {
        const realizado = calcularMetrica(m.definicao, () => linhas, janela, hoje, ids).valor;
        const metaEquipe = (metas ?? []).find((x) => x.metrica_id === m.id && equipeIds.includes(x.equipe_id as string))?.valor;
        const somaInd = ids.reduce((s, id) => s + Number(metaDe(m.id, id) ?? 0), 0);
        const meta = metaEquipe ? Number(metaEquipe) : somaInd || null;
        return {
          titulo: m.nome,
          realizado,
          meta,
          pct: meta && m.unidade !== "%" ? Math.round((realizado / meta) * 1000) / 10 : null,
          unidade: m.unidade,
        };
      });
      const limite = menorData(janela.fim, hoje);
      const serieMetricas = usadas.filter((m) => m.unidade !== "%").slice(0, 2);
      const serie = datasEntre(ini, janela.fim).map((dia) => {
        const p: { dia: string; [k: string]: number | string | null } = { dia: dia.slice(8) };
        for (const m of serieMetricas)
          p[m.codigo] = dia <= limite ? calcularMetrica(m.definicao, () => linhas, { inicio: ini, fim: dia }, dia, ids).valor : null;
        return p;
      });
      const carinhas: Record<Carinha, number> = { neutra: 0, feliz: 0, mega_feliz: 0 };
      for (const id of ids) carinhas[carinhaPara(notaDe.get(id) ?? null, config.limites)]++;
      telas.push({
        tipo: "geral",
        titulo: modo.titulo || "Visão geral",
        geral: {
          indicadores,
          serie,
          series: serieMetricas.map((m) => ({ chave: m.codigo, rotulo: m.nome })),
          carinhas,
          pessoas: ids.length,
        },
      });
    }
  }

  return {
    nome: painel.nome,
    equipes: (equipes ?? []).map((e) => e.nome),
    competencia: comp,
    atualizado_em: sync?.finalizado_em ?? null,
    config,
    telas,
  };
}
