import "server-only";
import { competenciaAnterior, competenciaDe, fimCompetencia, inicioCompetencia, somarDias } from "@/engine/datas";
import { calcularRecordes, type Recordes } from "@/engine/recordes";
import type { Linha, Metrica } from "@/engine/tipos";
import type { Sessao } from "@/lib/auth";
import { buscarTodos } from "@/lib/calculo/carregar";
import { regrasDaCategoria } from "@/lib/dados/producao";
import type { Db } from "@/lib/supabase/tipos";

/** Meses de histórico usados nos recordes (além do mês corrente). */
export const MESES_RECORDE = 12;

/** Recordes pessoais dos últimos 12 meses, em agendamentos válidos Particular. */
export async function recordesDe(db: Db, s: Sessao, metricas: Metrica[], hoje: string): Promise<(Recordes & { desde: string }) | null> {
  const login = s.colaborador.login_klingo?.toLowerCase();
  const regras = regrasDaCategoria(metricas, "particular");
  if (!login || !regras) return null;
  const desde = inicioCompetencia(competenciaAnterior(competenciaDe(hoje), MESES_RECORDE));
  const fimMesPassado = fimCompetencia(competenciaAnterior(competenciaDe(hoje)));
  const colunas = "chave, data_agendado_em, data_agendado_para, atendido, situacao, operadora, responsavel_login";
  const porCampo = (campo: string, ate: string) =>
    buscarTodos<Record<string, unknown>>((de, a) =>
      db
        .from("klingo_agendamentos")
        .select(colunas)
        .eq("responsavel_login", login)
        .gte(campo, desde)
        .lte(campo, ate)
        .order(campo)
        .order("chave")
        .range(de, a),
    );
  const [em, para] = await Promise.all([porCampo("data_agendado_em", hoje), porCampo("data_agendado_para", fimMesPassado)]);
  const unicas = new Map<string, Linha>();
  for (const l of [...em, ...para]) unicas.set(String(l.chave), { ...l, chave: String(l.chave), colaborador_id: s.colaborador.id });
  return { ...calcularRecordes(Array.from(unicas.values()), regras, s.colaborador.id, hoje, desde), desde };
}

export interface PacienteConfirmar {
  /** as marcações do paciente no dia (pode ter mais de um procedimento) */
  chaves: string[];
  paciente: string;
  procedimentos: string[];
  profissional: string | null;
  sus: boolean;
  resultado: "confirmado" | "sem_contato" | null;
}

export interface ListaConfirmar {
  dia: string;
  ehAmanha: boolean;
  pacientes: PacienteConfirmar[];
  /** false até a migration das confirmações ser aplicada: mostra a lista sem os botões */
  podeMarcar: boolean;
}

const FORA_DA_LISTA = "(remarcada,falta_remarcada,cancelada,bloqueio_clinica,erro)";

/** Consultas que a pessoa marcou para o próximo dia com consultas (até 7 dias à frente). */
export async function consultasParaConfirmar(db: Db, s: Sessao, hoje: string): Promise<ListaConfirmar | null> {
  const login = s.colaborador.login_klingo?.toLowerCase();
  if (!login) return null;
  const base = () =>
    db
      .from("klingo_agendamentos")
      .select("chave, data_agendado_para, paciente_nome, procedimento, profissional, operadora")
      .eq("responsavel_login", login)
      .or(`situacao.is.null,situacao.not.in.${FORA_DA_LISTA}`);

  const { data: prox } = await base().gt("data_agendado_para", hoje).lte("data_agendado_para", somarDias(hoje, 7)).order("data_agendado_para").limit(1);
  const dia = prox?.[0]?.data_agendado_para as string | undefined;
  if (!dia) return { dia: somarDias(hoje, 1), ehAmanha: true, pacientes: [], podeMarcar: false };

  const { data: linhas } = await base().eq("data_agendado_para", dia).order("paciente_nome").limit(300);
  const porPaciente = new Map<string, PacienteConfirmar>();
  for (const l of linhas ?? []) {
    const nome = String(l.paciente_nome ?? "Paciente sem nome").trim();
    const p = porPaciente.get(nome) ?? {
      chaves: [],
      paciente: nome,
      procedimentos: [],
      profissional: (l.profissional as string | null) ?? null,
      sus: /sus/i.test(String(l.operadora ?? "")),
      resultado: null,
    };
    p.chaves.push(String(l.chave));
    const proc = String(l.procedimento ?? "").trim();
    if (proc && !p.procedimentos.includes(proc)) p.procedimentos.push(proc);
    porPaciente.set(nome, p);
  }
  const pacientes = Array.from(porPaciente.values());

  const chaves = pacientes.flatMap((p) => p.chaves);
  const { data: conf, error } = chaves.length
    ? await db.from("confirmacoes").select("chave, resultado").in("chave", chaves)
    : { data: [], error: null };
  if (!error) {
    const r = new Map((conf ?? []).map((c) => [String(c.chave), c.resultado as PacienteConfirmar["resultado"]]));
    for (const p of pacientes) p.resultado = p.chaves.map((c) => r.get(c)).find(Boolean) ?? null;
  }
  return { dia, ehAmanha: dia === somarDias(hoje, 1), pacientes, podeMarcar: !error };
}
