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
  /** "Como ler os números": termos e o que cada um conta */
  glossario?: { termo: string; texto: string }[];
  passos: PassoTour[];
}

/** Os mesmos termos aparecem no Painel, na TV, no Extrato e na Análise. */
const GLOSSARIO: Ajuda["glossario"] = [
  {
    termo: "Agendou",
    texto: "Pacientes que a pessoa marcou dentro do período, contados pelo DIA EM QUE MARCOU (a consulta pode ser em qualquer data). É o esforço.",
  },
  {
    termo: "Remarques e válidos",
    texto: "Toda remarcação vira uma marcação nova no Klingo. 'Válidos' tira as remarcações, bloqueios da clínica e erros: cada paciente conta uma vez.",
  },
  {
    termo: "Consultas marcadas para o período",
    texto: "Consultas cuja DATA DA CONSULTA cai no período, marcadas pela pessoa em qualquer dia. No mês atual inclui as que ainda vão acontecer.",
  },
  { termo: "Compareceram", texto: "Das consultas marcadas para o período, quantas o paciente realmente veio (cruzado com o faturamento do Klingo)." },
  {
    termo: "Taxa de comparecimento (conversão)",
    texto: "Compareceram ÷ consultas marcadas, só em dias que já passaram. Ex.: 72% = de cada 100 consultas marcadas, 72 aconteceram.",
  },
  { termo: "Faltaram / desmarcaram", texto: "Faltou = o dia passou e o paciente não veio. Desmarcou = cancelou e não remarcou." },
  { termo: "▲ ▼ comparação", texto: "Sempre com o mesmo ponto do período anterior: mês até o dia 13 × mês passado até o dia 13; semana até sexta × semana passada até sexta." },
  { termo: "Nível e nota", texto: "Resultado do mês pelas regras do plano (pesos e faixas). Só existe para meses; veja o cálculo no Extrato." },
  { termo: "SUS", texto: "Só para acompanhar. Nunca entra em meta, nota, prêmio, comissão ou pontos." },
];

const PASSOS_MENU: PassoTour[] = [
  { alvo: "menu", titulo: "Menu", texto: "Aqui ficam todas as seções. O que aparece depende do seu perfil: atendente, líder ou administrador." },
  { alvo: "ajuda", titulo: "Ajuda em qualquer tela", texto: "Sempre que tiver dúvida, toque no ? para ver a explicação da seção e refazer este tour." },
];

export const AJUDA: Record<string, Ajuda> = {
  "/": {
    titulo: "Painel",
    resumo: [
      "O Painel responde três perguntas: quanto foi feito, o que aconteceu com as consultas e se o ritmo está bom para a meta.",
      "Comece pelo PERÍODO no topo (Hoje, Semana, Mês, Mês passado ou outro mês). A linha 'Mostrando' diz exatamente quais datas estão sendo contadas, e todos os números da tela seguem essa escolha.",
      "Existem duas datas diferentes, e é isso que mais confunde: 'Agendou' conta pelo dia em que a pessoa MARCOU; 'Consultas marcadas para o período', 'Compareceram' e a taxa contam pelo DIA DA CONSULTA.",
      "Os dados vêm do Klingo de hora em hora em horário comercial. O horário da última atualização fica no canto de cima.",
      "Atendentes veem só os próprios números (e o próprio código da TV). Líderes e administradores veem também a equipe, pessoa por pessoa.",
    ],
    dicas: [
      "Toque no ? ao lado de qualquer número para ver o que ele conta.",
      "Achou um número errado? Abra o Extrato, encontre o paciente e use Contestar.",
      "Remarcar não aumenta 'Válidos': o que conta de verdade é paciente novo que comparece.",
    ],
    glossario: GLOSSARIO,
    passos: [
      ...PASSOS_MENU,
      { alvo: "periodo", titulo: "1. De quando são os números", texto: "Escolha Hoje, Semana, Mês ou Mês passado. A linha 'Mostrando' mostra as datas exatas. Tudo abaixo segue esta escolha." },
      { alvo: "sync", titulo: "Atualização", texto: "Quando o robô buscou os dados no Klingo pela última vez (de hora em hora)." },
      { alvo: "codigo", titulo: "Seu código na TV", texto: "A TV não mostra nomes: cada pessoa aparece por um número de 4 dígitos. Este é o seu." },
      { alvo: "posicao", titulo: "Sua posição", texto: "Um ícone discreto: pódio para 1º, 2º e 3º lugar em agendamentos no período; medalha de menção honrosa do 4º em diante." },
      { alvo: "ritmo", titulo: "2. Ritmo da meta", texto: "Quanto já foi feito, onde deveria estar hoje (o tracinho) e quanto falta por dia útil para bater a meta do mês." },
      { alvo: "kpi-agendou", titulo: "3. Agendou", texto: "Pacientes marcados no período, pelo dia em que a marcação foi feita. Embaixo: quantos foram remarcações e quantos são válidos (cada paciente uma vez)." },
      { alvo: "kpi-marcadas", titulo: "4. Consultas marcadas para o período", texto: "Agora pela DATA DA CONSULTA: consultas que caem no período. No mês atual inclui as que ainda vão acontecer." },
      { alvo: "kpi-compareceram", titulo: "5. Compareceram", texto: "Dessas consultas, quantos pacientes vieram." },
      { alvo: "kpi-conversao", titulo: "6. Taxa de comparecimento", texto: "Compareceram ÷ marcadas, só em dias que já passaram (o dia de hoje entra amanhã). É a 'conversão'. O ▲▼ compara com o mesmo ponto do período anterior." },
      { alvo: "destino", titulo: "7. O que aconteceu com as consultas", texto: "Cada consulta marcada para o período termina em: compareceu, faltou, desmarcou ou ainda vai acontecer. É onde dá para agir (ex.: confirmar na véspera)." },
      { alvo: "sus", titulo: "SUS", texto: "Só acompanhamento: não conta para meta, nota ou prêmios." },
      { alvo: "grafico-agendou", titulo: "8. Agendamentos por dia", texto: "Quantas marcações foram feitas em cada dia. Mostra os dias fortes e fracos." },
      { alvo: "grafico-consultas", titulo: "9. Consultas de cada dia", texto: "Pelo dia da consulta: marcadas × compareceram. Barras claras são dias que ainda vão chegar." },
      { alvo: "categoria", titulo: "Particular ou SUS", texto: "Troca todos os números da equipe entre Particular e SUS." },
      { alvo: "tabela-producao", titulo: "10. Produção por pessoa", texto: "Responde: quanto cada uma agendou no período, quanto foi remarque, quantas consultas estavam marcadas para o período e o que aconteceu com elas. Cada coluna tem o seu ?." },
      { alvo: "grafico-remarques", titulo: "Agendou × válidos", texto: "A diferença entre as barras é o 'número inflado' por remarcações, bloqueios e erros." },
      { alvo: "grafico-pessoas", titulo: "Marcadas × compareceram", texto: "Quem converte melhor as consultas que marca." },
      { alvo: "historico", titulo: "Histórico", texto: "Resultado oficial mês a mês. Toque num mês para abrir o extrato com o cálculo." },
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
  "/analise": {
    titulo: "Análise",
    resumo: [
      "A Análise é para investigar. Há dois jeitos, um de cada vez: 'Perguntas prontas' (escolha uma pergunta e veja a resposta) ou 'Montar a minha análise' (você escolhe as métricas, o período e a visão).",
      "Para comparar quantidade com resultado, compare coisas da mesma data: 'Consultas marcadas para o período' (pela data da consulta) × 'Consultas realizadas'. Assim outubro é comparado com outubro, dia a dia.",
      "'Agendamentos' conta pelo dia em que a pessoa marcou (o esforço), mesmo que a consulta seja em outro mês.",
      "Na visão por dia, os dias que ainda não chegaram aparecem mais claros: mostram o que já está marcado para eles.",
    ],
    glossario: GLOSSARIO,
    passos: [
      { alvo: "analise-modo", titulo: "Escolha o jeito", texto: "Perguntas prontas para o dia a dia; 'Montar a minha' para ir fundo." },
      { alvo: "analise-atalhos", titulo: "Perguntas", texto: "Cada pergunta já sabe quais números e período usar." },
      { alvo: "analise-parametros", titulo: "Ajustes", texto: "Mês, pessoa ou equipe (e, no modo livre, as métricas e a visão)." },
      { alvo: "analise-grafico", titulo: "Resposta", texto: "O gráfico e, abaixo, a tabela com os números. Passe o mouse ou toque para ver os valores." },
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
      "Sugestão pelo histórico: embaixo de cada campo aparece a média dos últimos meses e o último mês da pessoa. Escolha a base (3 ou 6 meses) e o crescimento e clique em 'Preencher com sugestão'. Meses sem atividade (entrada recente, férias) não puxam a média para baixo; quem é novo recebe a média por pessoa da equipe.",
      "Nada é gravado até você clicar em Salvar metas.",
    ],
    passos: [
      { alvo: "metas-mes", titulo: "Mês", texto: "Escolha o mês." },
      { alvo: "metas-sugestao", titulo: "Sugestão", texto: "Preenche a grade com a média histórica de cada pessoa mais o crescimento escolhido." },
      { alvo: "metas-grade", titulo: "Grade", texto: "Uma linha por pessoa e uma coluna por métrica do plano. Embaixo de cada campo: média e último mês." },
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
      "Crie links públicos (sem login) para deixar numa TV. Nunca aparecem nomes, fotos, iniciais, comissão ou pontos: cada pessoa é um código de 4 dígitos (ela vê o próprio código no Painel).",
      "Telas: rankings de agendamentos Particular e SUS (uma por período), uma tela por pessoa com marcadas × compareceram e a visão da equipe com o total da clínica. Cada tela mostra o período e as datas.",
      "O ícone de cada pessoa alterna entre perfil, carinha e a posição numa tacinha: 1º ouro, 2º prata, 3º bronze; do 4º em diante, branco.",
      "Na TV: ← → trocam de tela, espaço (ou P) pausa a rotação, e os pontinhos do rodapé levam direto a uma tela. Pausado, os números continuam atualizando.",
      "O link só aparece uma vez ao criar. Se vazar, gere outro, desative ou exclua o painel.",
    ],
    passos: [{ alvo: "tv-novo", titulo: "Novo painel", texto: "Escolha equipes, tipos de tela, períodos e o intervalo." }],
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
