import "server-only";
import { competenciaAnterior, competenciaDe, fimCompetencia, inicioCompetencia, somarDias } from "@/engine/datas";
import type { RegrasProducao } from "@/engine/producao";
import { comparecimentoPorSemana, semanasAte, validosPorDia } from "@/engine/series";
import type { Linha } from "@/engine/tipos";
import { buscarTodos } from "@/lib/calculo/carregar";
import type { Pessoa } from "@/lib/dados/producao";
import { lembrar } from "@/lib/memoria";
import type { Db } from "@/lib/supabase/tipos";

export const SEMANAS_TV = 26;

export interface SeriesLongas {
  semanas: string[];
  /** Particular: 12 meses, por dia */
  particular: [string, number][];
  /** SUS: 26 semanas, por dia */
  sus: [string, number][];
  comparecimento: { marcadas: number; vieram: number; taxa: number | null }[];
}

/**
 * Séries longas da equipe (6 a 12 meses) para os gráficos da TV. Leem bem mais linhas que o resto da TV,
 * então ficam guardadas 30 minutos (tendência de semanas e meses não muda de um minuto para o outro).
 */
export async function seriesLongas(db: Db, pessoas: Pessoa[], regras: { particular: RegrasProducao | null; sus: RegrasProducao | null }, hoje: string): Promise<SeriesLongas> {
  const logins = Array.from(new Set(pessoas.map((p) => p.login_klingo?.toLowerCase()).filter((l): l is string => !!l))).sort();
  return lembrar(`series|${logins.join(",")}|${hoje}`, 30 * 60_000, async () => {
    const semanas = semanasAte(hoje, SEMANAS_TV);
    const desde12 = inicioCompetencia(competenciaAnterior(competenciaDe(hoje), 11));
    const ontem = somarDias(hoje, -1);
    // mês a mês (mesmo formato das outras consultas da TV: usa o índice login + data e não estoura o tempo do banco)
    const buscarMes = (campo: string, comp: string, de: string, ate: string) => {
      const ini = inicioCompetencia(comp) < de ? de : inicioCompetencia(comp);
      const fim = fimCompetencia(comp) > ate ? ate : fimCompetencia(comp);
      return buscarTodos<Record<string, unknown>>((a, b) =>
        db
          .from("klingo_agendamentos")
          .select("chave, data_agendado_em, data_agendado_para, atendido, situacao, operadora")
          .in("responsavel_login", logins)
          .gte(campo, ini)
          .lte(campo, fim)
          .order(campo)
          .order("chave")
          .range(a, b),
      );
    };
    const buscar = async (campo: string, de: string, ate: string): Promise<Linha[]> => {
      if (!logins.length || de > ate) return [];
      const meses: string[] = [];
      for (let c = competenciaDe(ate); c >= competenciaDe(de); c = competenciaAnterior(c)) meses.push(c);
      const out: Linha[] = [];
      for (let i = 0; i < meses.length; i += 4) {
        const partes = await Promise.all(meses.slice(i, i + 4).map((c) => buscarMes(campo, c, de, ate)));
        for (const ls of partes) for (const l of ls) out.push({ ...l, chave: String(l.chave), colaborador_id: null } as Linha);
      }
      return out;
    };
    const [agendadas, consultas] = await Promise.all([buscar("data_agendado_em", desde12, hoje), buscar("data_agendado_para", semanas[0], ontem)]);
    return {
      semanas,
      particular: regras.particular ? [...validosPorDia(agendadas, regras.particular, desde12, hoje)] : [],
      sus: regras.sus ? [...validosPorDia(agendadas, regras.sus, semanas[0], hoje)] : [],
      comparecimento: regras.particular ? comparecimentoPorSemana(consultas, regras.particular, semanas, hoje) : [],
    };
  });
}
