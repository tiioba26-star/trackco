import type { FonteId, OperadorFiltro } from "./tipos";

// Catálogo (whitelist) das fontes de dados e dos campos que o construtor de métricas pode usar.
// Novas fontes (ex.: equipe de limpeza via planilha) entram aqui.

export type TipoCampo = "data" | "texto" | "booleano" | "numero";

export interface CampoFonte {
  id: string;
  rotulo: string;
  tipo: TipoCampo;
  ajuda?: string;
}

export interface FonteDados {
  id: FonteId;
  rotulo: string;
  descricao: string;
  tabela: string;
  /** Campo que identifica de quem é a linha. */
  campo_atribuicao: string;
  /** Como o campo de atribuição se liga ao colaborador. */
  atribuicao: "login_klingo" | "colaborador_id";
  campos: CampoFonte[];
}

export const FONTES: Record<FonteId, FonteDados> = {
  klingo_agendamentos: {
    id: "klingo_agendamentos",
    rotulo: "Klingo · Agendamentos",
    descricao:
      "Relatório 2331 (marcações) cruzado com o 319 (produção). Cada linha é um agendamento feito por um atendente.",
    tabela: "klingo_agendamentos",
    campo_atribuicao: "responsavel_login",
    atribuicao: "login_klingo",
    campos: [
      {
        id: "data_agendado_em",
        rotulo: "Data em que foi agendado",
        tipo: "data",
        ajuda: "Dia em que o atendente fez o agendamento.",
      },
      {
        id: "data_agendado_para",
        rotulo: "Data marcada da consulta",
        tipo: "data",
        ajuda: "Dia para o qual a consulta foi marcada.",
      },
      {
        id: "data_realizacao",
        rotulo: "Data de realização",
        tipo: "data",
        ajuda: "Dia em que a consulta de fato aconteceu (atendida/faturada).",
      },
      { id: "operadora", rotulo: "Operadora", tipo: "texto" },
      { id: "procedimento", rotulo: "Procedimento", tipo: "texto" },
      { id: "profissional", rotulo: "Profissional", tipo: "texto" },
      { id: "responsavel_login", rotulo: "Responsável (login Klingo)", tipo: "texto" },
      {
        id: "atendido",
        rotulo: "Virou consulta (atendido)",
        tipo: "booleano",
        ajuda: "Verdadeiro quando a marcação foi encontrada na produção (319).",
      },
      {
        id: "situacao",
        rotulo: "Situação da marcação",
        tipo: "texto",
        ajuda:
          "realizada, falta, falta_remarcada, remarcada, cancelada, erro, bloqueio_clinica ou nao_realizada (relatórios 47 e 8440 do Klingo).",
      },
      { id: "motivo", rotulo: "Motivo do cancelamento", tipo: "texto" },
      { id: "qtd", rotulo: "Quantidade", tipo: "numero" },
      { id: "valor", rotulo: "Valor (R$)", tipo: "numero" },
    ],
  },
  lancamentos: {
    id: "lancamentos",
    rotulo: "Lançamentos manuais / planilha",
    descricao:
      "Notas e registros lançados no Trackco (ex.: avaliação do líder, checklists da limpeza, importação CSV).",
    tabela: "lancamentos",
    campo_atribuicao: "colaborador_id",
    atribuicao: "colaborador_id",
    campos: [
      { id: "data", rotulo: "Data do lançamento", tipo: "data" },
      { id: "tipo", rotulo: "Tipo", tipo: "texto" },
      { id: "valor", rotulo: "Valor / nota", tipo: "numero" },
      { id: "descricao", rotulo: "Descrição", tipo: "texto" },
    ],
  },
};

export const OPERADORES_POR_TIPO: Record<TipoCampo, OperadorFiltro[]> = {
  texto: ["igual", "diferente", "em", "nao_em", "contem", "preenchido", "vazio"],
  booleano: ["verdadeiro", "falso", "preenchido", "vazio"],
  numero: ["igual", "diferente", "preenchido", "vazio"],
  data: ["preenchido", "vazio"],
};

export const ROTULO_OPERADOR: Record<OperadorFiltro, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  em: "é um destes",
  nao_em: "não é nenhum destes",
  contem: "contém",
  verdadeiro: "é verdadeiro",
  falso: "é falso",
  preenchido: "está preenchido",
  vazio: "está vazio",
};

export function campoDaFonte(fonte: FonteId, campo: string): CampoFonte | undefined {
  return FONTES[fonte]?.campos.find((c) => c.id === campo);
}

export function camposDeData(fonte: FonteId): CampoFonte[] {
  return FONTES[fonte].campos.filter((c) => c.tipo === "data");
}

/** Colunas que o carregador precisa ler da fonte (whitelist). */
export function colunasDaFonte(fonte: FonteId): string[] {
  const f = FONTES[fonte];
  const chave = fonte === "klingo_agendamentos" ? "chave" : "id";
  return Array.from(new Set([chave, f.campo_atribuicao, ...f.campos.map((c) => c.id)]));
}
