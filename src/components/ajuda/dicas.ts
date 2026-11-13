// Textos do "?" ao lado dos campos. Linguagem simples, com exemplo. Edite aqui para mudar em todas as telas.

export const DICAS = {
  // ---------- Planos e regras ----------
  "plano.modalidade":
    "O tipo de resultado que o plano entrega. Reconhecimento = só nível/selo (fase atual). Prêmios = bombom, caneca… Comissão em R$ = dinheiro. Pontos = acumula para trocar na loja. Misto = combina.",
  "ind.metrica": "O que este indicador mede. As métricas são criadas em Métricas (ex.: Agendamentos, Consultas realizadas, Taxa de conversão).",
  "ind.nome": "Nome que aparece no painel e no extrato. Se ficar vazio, usa o nome da métrica.",
  "ind.escopo":
    "Individual = conta só a produção da própria pessoa. Equipe = soma a produção de todos os membros da equipe (é assim que o líder é avaliado pelo resultado do conjunto).",
  "ind.aplica_a":
    "Para quem este indicador vale. Membros = atendentes. Líder = só o líder. Todos = os dois. Ex.: 'Agendamentos da equipe' costuma valer só para o líder.",
  "ind.peso":
    "Quanto este indicador pesa na nota geral. A nota é a média ponderada: com pesos 40/40/20, o terceiro vale metade de cada um dos outros. Peso 0 = só aparece, não entra na nota.",
  "ind.teto":
    "Limite de atingimento que conta na nota. Com teto 150%, quem fez 300% da meta conta como 150%. Evita que um único indicador muito alto esconda os outros.",
  "ind.proporcional":
    "Ligado: a meta diminui proporcionalmente aos dias em que a pessoa não trabalhou (férias, atestado, entrada no meio do mês). Ex.: 22 dias úteis e 5 de férias → meta × 17/22. Para taxas (%) não se aplica.",
  "ind.incluir_lider":
    "Só para indicadores de escopo Equipe. Desligado: o total da equipe soma apenas os atendentes. Ligado: soma também o que o próprio líder agendou/realizou. Use ligado se o líder também atende e você quer que isso conte no resultado da equipe.",
  "faixa.de_ate":
    "Intervalo da nota geral (em % da meta) que cai nesta faixa. 'De' entra, 'Até' não: 80 a 100 pega 80% até 99,9%. 'Até' vazio = sem limite (ex.: 120% ou mais).",
  "faixa.nivel": "Nome do nível que a pessoa vê no painel, no extrato e na TV (ex.: Em desenvolvimento, Quase lá, Meta batida, Destaque).",
  "faixa.cor": "Cor do selo do nível nas telas.",
  "faixa.recompensa":
    "O que a pessoa ganha ao cair nesta faixa. Na fase de reconhecimento use 'Reconhecimento (selo)'. Depois: prêmio, valor em R$, percentual ou pontos.",
  "cond.descricao": "Texto que aparece no extrato explicando a condição (ex.: 'Conversão mínima de 60%').",
  "cond.indicador": "Qual indicador é verificado.",
  "cond.base": "Realizado = o número em si (ex.: 60% de conversão, 100 agendamentos). Atingimento = % da meta (ex.: 80% da meta).",
  "cond.efeito":
    "O que acontece se a condição NÃO for cumprida. Bloquear recompensa = a pessoa mantém o nível, mas não ganha o prêmio. Limitar nível = o nível máximo fica travado na faixa escolhida.",
  "plano.simular": "Aplica o rascunho (como está na tela, sem salvar) aos dados reais de um mês e compara com a regra que está valendo.",
  "plano.vigente": "Mês a partir do qual esta versão vale. Meses anteriores continuam calculados com a versão que valia na época.",

  // ---------- Métricas ----------
  "met.codigo": "Identificador interno, sem espaços (ex.: agendamentos). Usado por sistemas e na TV; normalmente não precisa mexer.",
  "met.analise":
    "Quantitativa = volume (quantos agendou). Qualitativa = qualidade/resultado (quantos viraram consulta, conversão). Serve para organizar e explicar; não muda a conta.",
  "met.unidade": "Como o número é mostrado: unidades, %, R$ ou pontos.",
  "met.somente_analise":
    "Ligado: a métrica aparece em painel, relatórios e TV, mas nunca entra em metas, nota, prêmios, comissão ou pontos (é o caso do SUS).",
  "met.tipo_calculo":
    "Contagem/soma = um número (ex.: 120 agendamentos). Taxa = um número dividido por outro, em % (ex.: realizadas ÷ marcadas = conversão).",
  "met.corte":
    "No mês em andamento: 'Hoje' conta também o dia de hoje (o número sobe ao longo do dia). 'Ontem' só conta dias fechados (bom para taxas, que oscilam durante o dia).",
  "met.fonte": "De onde vêm os dados. Klingo = agendamentos e consultas. Lançamentos = notas e registros feitos à mão ou por planilha.",
  "met.agregacao": "Contar = quantas linhas (ex.: quantos agendamentos). Somar = soma de um campo numérico (ex.: soma do valor em R$).",
  "met.campo_data":
    "Qual data decide em que mês cada registro conta. Ex.: 'Data em que foi agendado' conta no mês em que o atendente marcou; 'Data marcada da consulta' conta no mês da consulta; 'Data de realização' conta quando o paciente foi atendido.",
  "met.filtros":
    "Só entram os registros que passam em TODOS os filtros. Ex.: Operadora é igual a Particular; Situação não é nenhum destes: remarcada, erro.",

  // ---------- Metas ----------
  "metas.base": "Quantos meses para trás entram na média que sugere a meta. Meses sem atividade (férias, entrada recente) são ignorados.",
  "metas.crescimento": "Quanto acima da média a sugestão fica. +5% sobre uma média de 200 sugere 210.",
  "metas.equipe":
    "Meta do conjunto, usada nos indicadores de escopo Equipe (avaliação do líder). Vazia = usa automaticamente a soma das metas individuais (ou a média, para %).",

  // ---------- Equipes ----------
  "eq.visibilidade":
    "O que cada atendente vê dos colegas. Aberto = ranking com nomes e números. Só posições = nomes, posição e nível, sem os números dos outros. Privado = cada um vê só o seu. Líder e admin sempre veem tudo.",
  "eq.dias": "Dias em que a equipe trabalha. Define os dias úteis do mês, o ritmo diário necessário e a meta proporcional.",
  "eq.etapas":
    "Etapas do fechamento do mês. Contestação = prazo para a equipe apontar erros. Conferência do líder = o líder revisa antes. A aprovação do admin é sempre a última.",
  "eq.prazo": "Quantos dias a equipe tem para contestar depois que o fechamento entra na etapa de contestação.",

  // ---------- Colaboradores ----------
  "colab.usuario": "O usuário de login (o mesmo do sistema de relatórios). Vira usuario@acesso.iobaoftalmo.com.br por dentro.",
  "colab.klingo":
    "O login da pessoa no Klingo (campo 'Responsável' dos relatórios). É o que liga os agendamentos do Klingo a esta pessoa. Sem ele, nada é atribuído.",
  "colab.perfil":
    "Administrador = configura tudo. Gestor = vê tudo, mas não configura. Colaborador = vê o próprio painel (e a equipe, se for líder em Equipes).",

  // ---------- Dados ----------
  "lanc.tipo": "Código do lançamento que a métrica procura (ex.: avaliacao_lider para a nota do líder, checklist_limpeza para a limpeza).",
  "lanc.valor": "O número lançado: uma nota (ex.: 8,5), uma quantidade (ex.: 1) ou um valor.",

  // ---------- Painel (o que cada número conta) ----------
  "pn.agendou":
    "Total de marcações feitas DENTRO do período, pelo dia em que a marcação foi feita (não importa para quando é a consulta). Inclui as que depois viraram remarcação, bloqueios da clínica e erros: por isso é maior que 'válidos'.",
  "pn.validos":
    "O número de verdade: pacientes marcados DENTRO do período, pelo dia em que a marcação foi feita, sem as marcações que depois foram remarcadas (o mesmo paciente ganhou outra marcação), bloqueios da clínica e erros de cadastro. Cada marcação conta uma vez: a que foi remarcada sai e fica só a nova (dois procedimentos diferentes contam 2). É o que vale no ranking. Ex.: marcou hoje uma consulta para dezembro → conta hoje.",
  "pn.confirmar":
    "Consultas que você marcou para o próximo dia com atendimento. Ligue, confirme e marque aqui: 'Confirmou' ou 'Não atendeu'. Só você vê os nomes. Com o tempo, o Trackco mostra se as confirmadas faltam menos.",
  "pn.recordes":
    "Seus melhores resultados nos últimos 12 meses: o dia e o mês com mais agendamentos válidos e o mês com maior comparecimento (só meses fechados, com pelo menos 20 consultas). Remarcação não conta.",
  "pn.remarques":
    "Marcações feitas no período que depois foram remarcadas para outra data. Cada remarcação gera uma marcação nova no Klingo, então o número de 'agendou' sobe sem ter paciente novo.",
  "pn.marcadas":
    "Consultas cuja DATA DA CONSULTA cai no período e que foram marcadas por você (em qualquer dia). No mês atual inclui as que ainda vão acontecer. Remarcadas, bloqueios da clínica e erros ficam de fora.",
  "pn.compareceram": "Das consultas marcadas para o período, quantas o paciente realmente veio (cruzado com o faturamento do Klingo).",
  "pn.conversao":
    "Taxa de comparecimento (também chamada de conversão): de cada 100 consultas que você marcou para dias que JÁ PASSARAM no período, quantas aconteceram. O dia de hoje só entra amanhã, quando já acabou.",
  "pn.faltaram": "O dia da consulta passou e o paciente não veio (e não remarcou).",
  "pn.desmarcaram": "O paciente desmarcou e não remarcou (cancelamento que não foi remarcação, bloqueio ou erro).",
  "pn.aguardando": "Consultas de hoje ou de dias futuros: ainda não dá para saber se o paciente vem.",
  "pn.codigo":
    "Seu código na TV hoje. A TV nunca mostra nomes: cada pessoa aparece por um número de 4 dígitos, que MUDA TODO DIA (assim ninguém decora o da colega). Para se achar na TV, confira aqui o de hoje.",
  "pn.sus": "SUS é só para acompanhar: não conta para meta, nota, prêmios, comissão ou pontos.",
  "pn.periodo":
    "Escolha de quando são os números. 'Mês' vai do dia 1º até agora; 'Mês passado' é o mês anterior inteiro. A comparação (▲▼) é sempre com o mesmo ponto do período anterior.",
} as const;

export type ChaveDica = keyof typeof DICAS;
