-- Trackco · métricas novas para a tela Análise (SUS e Particular)
--
-- Todas "somente_analise": aparecem na Análise e nos relatórios, nunca entram em metas, nota, prêmios ou comissão.
-- Datas: agendamentos contam pelo dia em que foram MARCADOS; o resto (marcadas para o período, remarcadas,
-- canceladas, faltas, comparecimento) conta pelo dia da CONSULTA, como na aba Perdas da Gestão.
-- "Válidos" = sem remarcações, bloqueios da clínica e erros.

insert into trackco.metricas (codigo, nome, descricao, tipo, unidade, definicao) values
  ('agendamentos_validos_sus', 'Agendamentos válidos SUS',
   'Agendamentos SUS feitos no período, sem remarcações, bloqueios da clínica e erros (pelo dia em que foram marcados).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_em","somente_analise":true,
     "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"nao_em","campo":"situacao","valor":["remarcada","falta_remarcada","bloqueio_clinica","erro"]}]}'),

  ('marcadas_sus', 'Consultas marcadas para o período (SUS)',
   'Consultas SUS marcadas para acontecer no período (pelo dia da consulta), sem remarcações, bloqueios e erros.',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"nao_em","campo":"situacao","valor":["remarcada","falta_remarcada","bloqueio_clinica","erro"]}]}'),

  ('comparecimento_sus', 'Taxa de comparecimento SUS',
   'Das consultas SUS marcadas para o período (até ontem), quantas aconteceram.',
   'qualitativa', '%',
   '{"tipo_calculo":"taxa","corte":"ontem","somente_analise":true,
     "numerador":{"fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
       "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"verdadeiro","campo":"atendido"}]},
     "denominador":{"fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
       "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"nao_em","campo":"situacao","valor":["remarcada","falta_remarcada","bloqueio_clinica","erro"]}]}}'),

  ('remarcacoes_sus', 'Remarcadas SUS',
   'Consultas SUS que estavam marcadas para o período e foram remarcadas para outra data (pelo dia da consulta original).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"em","campo":"situacao","valor":["remarcada","falta_remarcada"]}]}'),

  ('cancelamentos_sus', 'Canceladas SUS',
   'Consultas SUS marcadas para o período que foram canceladas (pelo dia da consulta).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"igual","campo":"situacao","valor":"cancelada"}]}'),

  ('faltas_sus', 'Faltas SUS',
   'Consultas SUS marcadas para o período em que o paciente não veio (pelo dia da consulta).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"contem","campo":"operadora","valor":"SUS"},{"op":"em","campo":"situacao","valor":["falta","nao_realizada"]}]}'),

  ('remarcacoes_particular', 'Remarcadas Particular',
   'Consultas Particular que estavam marcadas para o período e foram remarcadas para outra data (pelo dia da consulta original).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"igual","campo":"operadora","valor":"Particular"},{"op":"em","campo":"situacao","valor":["remarcada","falta_remarcada"]}]}'),

  ('cancelamentos_particular', 'Canceladas Particular',
   'Consultas Particular marcadas para o período que foram canceladas (pelo dia da consulta).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"igual","campo":"operadora","valor":"Particular"},{"op":"igual","campo":"situacao","valor":"cancelada"}]}'),

  ('faltas_particular', 'Faltas Particular',
   'Consultas Particular marcadas para o período em que o paciente não veio (pelo dia da consulta).',
   'quantitativa', 'un',
   '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para","somente_analise":true,
     "filtros":[{"op":"igual","campo":"operadora","valor":"Particular"},{"op":"em","campo":"situacao","valor":["falta","nao_realizada"]}]}')
on conflict (codigo) do nothing;
