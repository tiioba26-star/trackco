// Conteúdo do botão "?" (ajuda) e dos tours guiados de cada seção.
// Os passos apontam para elementos marcados com data-tour="..." nas páginas.

export interface PassoTour {
  alvo: string; // valor do data-tour
  titulo: string;
  texto: string;
}

export interface Ajuda {
  titulo: string;
  resumo: string[];
  dicas?: string[];
  passos: PassoTour[];
}

const PASSOS_MENU: PassoTour[] = [
  { alvo: "menu", titulo: "Menu", texto: "Aqui ficam todas as seções. O que aparece depende do seu perfil: atendente, líder ou administrador." },
  { alvo: "ajuda", titulo: "Ajuda em qualquer tela", texto: "Sempre que tiver dúvida, toque no ? para ver a explicação da seção e refazer este tour." },
];

export const AJUDA: Record<string, Ajuda> = {
  "/": {
    titulo: "Painel",
    resumo: [
      "O painel mostra o seu desempenho no mês: quanto você já realizou, qual é a meta, quanto falta por dia e a projeção de fechamento.",
      "Quantitativo = agendamentos que você fez (contam no dia em que você agendou). Qualitativo = consultas que de fato aconteceram (contam no dia em que o paciente foi atendido, mesmo que você tenha agendado em outro mês).",
      "Os dados vêm do Klingo e são atualizados de hora em hora em horário comercial. A hora da última atualização aparece no topo.",
    ],
    dicas: [
      "Achou um número errado? Abra o Extrato, encontre o agendamento e use o botão Contestar.",
      "O nível (Em desenvolvimento, Quase lá, Meta batida, Destaque) vem da média ponderada dos seus indicadores.",
    ],
    passos: [
      ...PASSOS_MENU,
      { alvo: "competencia", titulo: "Mês de referência", texto: "Troque o mês para ver meses anteriores. O mês atual é parcial e vai até hoje." },
      { alvo: "sync", titulo: "Atualização dos dados", texto: "Mostra quando o robô buscou os dados no Klingo pela última vez." },
      { alvo: "kpis", titulo: "Indicadores", texto: "Cada cartão mostra realizado x meta, o atingimento e quanto falta por dia útil para bater a meta." },
      { alvo: "nivel", titulo: "Seu nível", texto: "Resultado geral do mês segundo as regras do plano. Toque em 'Ver extrato' para ver o cálculo passo a passo." },
      { alvo: "evolucao", titulo: "Evolução diária", texto: "Como seus números cresceram ao longo do mês." },
      { alvo: "ranking", titulo: "Equipe", texto: "Posição na equipe. O que cada pessoa vê dos colegas é configurado pelo administrador." },
    ],
  },
  "/extrato": {
    titulo: "Extrato e memorial de cálculo",
    resumo: [
      "O extrato é a prova do cálculo: mostra cada indicador, a regra aplicada (com a versão do plano), a meta original e a ajustada (férias, entrada no meio do mês), os ajustes manuais e o resultado.",
      "Abaixo do resumo estão TODAS as linhas do Klingo usadas no cálculo. Assim você confere paciente por paciente.",
    ],
    dicas: [
      "Se um agendamento seu não aparece ou aparece errado, use Contestar. O líder e o administrador recebem a contestação.",
      "Uma consulta 'pendente' ainda não aconteceu (ou o faturamento ainda não foi lançado no Klingo).",
    ],
    passos: [
      { alvo: "extrato-cabecalho", titulo: "Resumo", texto: "Pessoa, mês, nível e nota geral." },
      { alvo: "extrato-indicadores", titulo: "Cálculo por indicador", texto: "Realizado, meta, meta ajustada, atingimento e peso de cada indicador." },
      { alvo: "extrato-memorial", titulo: "Memorial", texto: "O passo a passo do cálculo em texto, com a versão das regras usada." },
      { alvo: "extrato-linhas", titulo: "Linhas de origem", texto: "Cada agendamento/consulta que entrou na conta. Use o filtro por indicador." },
      { alvo: "contestar", titulo: "Contestar", texto: "Abra uma contestação quando algo estiver errado. Ela fica registrada e é respondida pelo líder ou admin." },
    ],
  },
  "/contestacoes": {
    titulo: "Contestações",
    resumo: [
      "Aqui ficam as divergências apontadas pelos colaboradores. É assim que validamos os dados nos primeiros meses.",
      "O líder e o administrador analisam e respondem. Ao aceitar, é possível lançar um ajuste (+/-) que entra no cálculo com a justificativa registrada.",
    ],
    passos: [
      { alvo: "contest-lista", titulo: "Lista", texto: "Contestações abertas aparecem primeiro. Cada uma mostra quem abriu, o mês e o indicador." },
      { alvo: "contest-acoes", titulo: "Responder", texto: "Aceite (com ou sem ajuste) ou recuse, sempre com uma resposta." },
    ],
  },
  "/fechamentos": {
    titulo: "Fechamentos",
    resumo: [
      "O fechamento congela o resultado de um mês. Etapas padrão: cálculo → prazo de contestação → conferência do líder → aprovação do admin → entregue.",
      "As etapas podem ser ligadas/desligadas por equipe (em Equipes). Depois de aprovado, o resultado não muda mais.",
    ],
    dicas: ["O checklist 'O que revisar' aponta contestações abertas, pessoas sem meta e falhas de sincronização antes de aprovar."],
    passos: [
      { alvo: "fech-novo", titulo: "Novo fechamento", texto: "Escolha equipe e mês para iniciar." },
      { alvo: "fech-lista", titulo: "Situação", texto: "Cada fechamento mostra a etapa atual." },
    ],
  },
  "/relatorios": {
    titulo: "Relatórios",
    resumo: [
      "Analise a operação sem remontar o cálculo em planilha: evolução por mês, comparação entre pessoas e detalhamento por operadora, procedimento e profissional.",
      "Use Exportar CSV para levar os números para o Excel quando precisar.",
    ],
    passos: [
      { alvo: "rel-filtros", titulo: "Filtros", texto: "Período, equipe e pessoa." },
      { alvo: "rel-evolucao", titulo: "Evolução", texto: "Nota e indicadores mês a mês." },
      { alvo: "rel-tabela", titulo: "Detalhamento", texto: "Números por pessoa e por mês. Exporte em CSV." },
    ],
  },
  "/ausencias": {
    titulo: "Ausências",
    resumo: [
      "Férias, atestados, folgas e afastamentos reduzem a meta proporcionalmente aos dias úteis em que a pessoa trabalhou.",
      "Exemplo: 22 dias úteis no mês e 5 de férias → a meta passa a valer 17/22 do original.",
    ],
    passos: [{ alvo: "aus-form", titulo: "Lançar ausência", texto: "Escolha a pessoa, o período e o tipo." }],
  },
  "/metricas": {
    titulo: "Métricas",
    resumo: [
      "Métrica é O QUE será medido: de qual fonte de dados, contando ou somando, por qual data e com quais filtros.",
      "Exemplo: 'Agendamentos' = contar linhas do Klingo pela data em que foi agendado, onde operadora = Particular. 'Consultas realizadas' = mesma fonte, pela data de realização, onde atendido = sim.",
      "Taxas (ex.: conversão) dividem um numerador por um denominador.",
    ],
    dicas: [
      "Use 'Testar com dados reais' antes de salvar para ver o resultado de cada pessoa no mês.",
      "Mudar uma métrica afeta os cálculos a partir do próximo recálculo; fechamentos aprovados não mudam.",
    ],
    passos: [
      { alvo: "met-lista", titulo: "Métricas cadastradas", texto: "Clique para editar." },
      { alvo: "met-nova", titulo: "Nova métrica", texto: "Crie quantas quiser, para qualquer equipe." },
    ],
  },
  "/planos": {
    titulo: "Planos e regras",
    resumo: [
      "O plano diz COMO o desempenho vira resultado: quais indicadores contam, com que peso, a quem se aplicam (membros ou líder), as faixas de atingimento e o que cada faixa rende.",
      "Para o líder, use indicadores de escopo 'equipe' (agregado da equipe), indicadores individuais da produção dele e/ou uma avaliação manual. Tudo combinável com pesos.",
      "Modalidades: Reconhecimento (só nível/selo), Prêmio (bombom, caneca...), Dinheiro (R$ fixo ou %), Pontos ou Misto.",
      "Ao publicar, o plano vira uma versão imutável com data de início. Cada resultado guarda a versão usada (rastreabilidade).",
    ],
    dicas: ["Use o Simulador para aplicar o rascunho a um mês passado antes de publicar."],
    passos: [
      { alvo: "plano-indicadores", titulo: "Indicadores", texto: "Métrica, escopo, a quem se aplica, peso e teto." },
      { alvo: "plano-faixas", titulo: "Faixas", texto: "Intervalos de atingimento e o resultado de cada um." },
      { alvo: "plano-condicoes", titulo: "Condições", texto: "Gatilhos: por exemplo, só libera o prêmio se a conversão for ≥ 60%." },
      { alvo: "plano-simular", titulo: "Simular", texto: "Veja o resultado com dados reais antes de publicar." },
      { alvo: "plano-publicar", titulo: "Publicar", texto: "Cria uma nova versão a partir do mês escolhido." },
    ],
  },
  "/metas": {
    titulo: "Metas",
    resumo: [
      "Metas mensais por pessoa (e, opcionalmente, da equipe). Se a meta da equipe ficar vazia, o sistema usa a soma das metas individuais.",
      "O painel calcula sozinho o ritmo diário necessário e a projeção de fechamento.",
    ],
    passos: [
      { alvo: "metas-mes", titulo: "Mês", texto: "Escolha o mês." },
      { alvo: "metas-grade", titulo: "Grade", texto: "Uma linha por pessoa e uma coluna por métrica do plano." },
      { alvo: "metas-copiar", titulo: "Copiar do mês anterior", texto: "Atalho para repetir as metas." },
    ],
  },
  "/equipes": {
    titulo: "Equipes",
    resumo: [
      "Cadastre equipes (Comercial, Limpeza...), seus membros e o líder. Cada vínculo tem data de início e fim, então a troca de equipe não bagunça o histórico.",
      "Configure também: quem vê o ranking, os dias de trabalho (para dias úteis) e as etapas do fechamento.",
    ],
    passos: [{ alvo: "equipes-lista", titulo: "Equipes", texto: "Clique para configurar membros e regras de visibilidade." }],
  },
  "/colaboradores": {
    titulo: "Colaboradores",
    resumo: [
      "Pessoas com acesso ao Trackco. O login é o mesmo do sistema de relatórios (mesmo usuário e senha).",
      "O 'login no Klingo' liga a pessoa às linhas do Klingo (campo Responsável). Sem ele, os agendamentos não são atribuídos.",
      "Perfis: Admin (configura tudo), Gestor (vê tudo, não configura) e Colaborador (vê o próprio; se for líder de equipe, vê a equipe).",
    ],
    passos: [
      { alvo: "colab-novo", titulo: "Novo colaborador", texto: "Cria o acesso ou vincula um login que já existe no relatório." },
      { alvo: "colab-lista", titulo: "Lista", texto: "Edite perfil, login do Klingo, status e senha." },
    ],
  },
  "/dados": {
    titulo: "Dados e lançamentos",
    resumo: [
      "Status do robô que busca os dados no Klingo, logins do Klingo ainda não vinculados a ninguém e lançamentos manuais (ex.: nota de avaliação do líder, checklists de outras equipes).",
      "Use 'Recalcular agora' depois de mudar metas, regras ou ajustes para atualizar o painel na hora.",
    ],
    passos: [
      { alvo: "dados-sync", titulo: "Sincronizações", texto: "Histórico das execuções do robô." },
      { alvo: "dados-recalc", titulo: "Recalcular", texto: "Atualiza as apurações do mês atual e do anterior." },
      { alvo: "dados-lanc", titulo: "Lançamentos", texto: "Notas e registros manuais usados por métricas da fonte 'Lançamentos'." },
    ],
  },
  "/paineis-tv": {
    titulo: "Painéis de TV",
    resumo: [
      "Crie links públicos (sem login) para deixar numa TV. A tela mostra o desempenho de forma ANÔNIMA: sem nomes, fotos ou iniciais, só um ícone com carinha neutra, feliz ou mega feliz (nunca triste).",
      "Os modos alternam a cada 30 s (configurável): barras de agendamentos, barras de realizadas, barras de SUS e um painel geral. Nunca aparecem valores de comissão ou pontos.",
      "O link só aparece uma vez ao criar. Se vazar, gere outro ou desative o painel.",
    ],
    passos: [{ alvo: "tv-novo", titulo: "Novo painel", texto: "Escolha equipes, modos e intervalo." }],
  },
  "/auditoria": {
    titulo: "Auditoria",
    resumo: ["Registro de toda alteração em regras, metas, ajustes, equipes, colaboradores e fechamentos: quem fez, quando, antes e depois."],
    passos: [{ alvo: "aud-lista", titulo: "Registros", texto: "Filtre por tabela. Abra um registro para ver o antes e o depois." }],
  },
};

export function ajudaPara(pathname: string): Ajuda {
  if (AJUDA[pathname]) return AJUDA[pathname];
  const chave = Object.keys(AJUDA)
    .filter((k) => k !== "/" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return AJUDA[chave ?? "/"];
}
