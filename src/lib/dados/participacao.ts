import "server-only";
import { competenciaAnterior, competenciaDe, fimCompetencia, inicioCompetencia, somarDias } from "@/engine/datas";
import { calcularRecordes } from "@/engine/recordes";
import type { RegrasProducao } from "@/engine/producao";
import type { Linha } from "@/engine/tipos";
import { buscarTodos } from "@/lib/calculo/carregar";
import type { Pessoa } from "@/lib/dados/producao";
import { lembrar } from "@/lib/memoria";
import type { Db } from "@/lib/supabase/tipos";

// Dados "da clínica inteira" para a TV. Mudam devagar, então ficam em memória por alguns minutos
// (a TV pede de novo a cada minuto; sem isso seriam dezenas de contagens por minuto).


export interface Fatia {
  equipe: string;
  valor: number;
  destaque: boolean;
}

/**
 * Quanto cada equipe marcou (todas as marcações, todos os convênios) em cada janela.
 * A equipe do painel usa os logins do Trackco; as outras vêm do cadastro de equipes do sistema relatorio.
 */
export async function participacaoPorEquipe(
  db: Db,
  equipeNome: string,
  loginsEquipe: string[],
  janelas: { inicio: string; fim: string }[],
): Promise<Fatia[][]> {
  const meus = new Set(loginsEquipe.map((l) => l.toLowerCase()));
  const outras = await lembrar("usuarios-equipes", 60 * 60_000, async () => {
    const { data } = await db.schema("public").from("usuarios").select("equipe, login_klingo").not("login_klingo", "is", null);
    const por = new Map<string, string[]>();
    for (const u of data ?? []) {
      const login = String(u.login_klingo).toLowerCase();
      const equipe = String(u.equipe ?? "Outros");
      por.set(equipe, [...(por.get(equipe) ?? []), login]);
    }
    return Array.from(por.entries());
  });
  const grupos = outras
    .map(([equipe, logins]) => [equipe, logins.filter((l) => !meus.has(l))] as const)
    .filter(([equipe, logins]) => logins.length && equipe !== "Outros" && equipe !== equipeNome);

  const contar = async (inicio: string, fim: string, logins?: string[]) => {
    let q = db.from("klingo_agendamentos").select("chave", { count: "exact", head: true }).gte("data_agendado_em", inicio).lte("data_agendado_em", fim);
    if (logins) q = q.in("responsavel_login", logins);
    const { count } = await q;
    return count ?? 0;
  };

  return Promise.all(
    janelas.map((j) =>
      lembrar(`fatias|${equipeNome}|${[...meus].sort().join(",")}|${j.inicio}|${j.fim}`, 5 * 60_000, async () => {
        const [total, minha, ...dasOutras] = await Promise.all([
          contar(j.inicio, j.fim),
          meus.size ? contar(j.inicio, j.fim, [...meus]) : Promise.resolve(0),
          ...grupos.map(([, logins]) => contar(j.inicio, j.fim, logins)),
        ]);
        const fatias: Fatia[] = [
          { equipe: equipeNome, valor: minha, destaque: true },
          ...grupos.map(([equipe], i) => ({ equipe, valor: dasOutras[i], destaque: false })),
        ];
        const resto = total - fatias.reduce((s, f) => s + f.valor, 0);
        if (resto > 0) fatias.push({ equipe: "Outros", valor: resto, destaque: false });
        return fatias.filter((f) => f.valor > 0 || f.destaque);
      }),
    ),
  );
}

/** Melhor dia e melhor mês (válidos) de cada pessoa nos 12 meses antes do mês corrente. Guardado por 1 hora. */
export async function recordesAnteriores(
  db: Db,
  pessoas: Pessoa[],
  regras: RegrasProducao,
  hoje: string,
): Promise<Map<string, { melhorDia: number; melhorMes: number }>> {
  const comp = competenciaDe(hoje);
  const desde = inicioCompetencia(competenciaAnterior(comp, 12));
  const ate = fimCompetencia(competenciaAnterior(comp));
  const comLogin = pessoas.filter((p) => p.login_klingo);
  const chave = `recordes|${comLogin.map((p) => p.id).sort().join(",")}|${comp}`;
  const lista = await lembrar(chave, 60 * 60_000, async () => {
    const porLogin = new Map(comLogin.map((p) => [p.login_klingo!.toLowerCase(), p.id]));
    const linhas = await buscarTodos<Record<string, unknown>>((de, a) =>
      db
        .from("klingo_agendamentos")
        .select("chave, data_agendado_em, situacao, operadora, responsavel_login")
        .in("responsavel_login", [...porLogin.keys()])
        .gte("data_agendado_em", desde)
        .lte("data_agendado_em", ate)
        .ilike("operadora", "%particular%")
        .order("data_agendado_em")
        .order("chave")
        .range(de, a),
    );
    const comDono: Linha[] = linhas.map((l) => ({ ...l, chave: String(l.chave), colaborador_id: porLogin.get(String(l.responsavel_login).toLowerCase()) ?? null }));
    return comLogin.map((p) => {
      const r = calcularRecordes(comDono, regras, p.id, ate, desde);
      return [p.id, { melhorDia: r.melhorDia?.valor ?? 0, melhorMes: r.melhorMes?.valor ?? 0 }] as const;
    });
  });
  return new Map(lista);
}

export const ontem = (hoje: string) => somarDias(hoje, -1);
