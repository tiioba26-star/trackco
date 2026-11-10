-- Trackco · configuração inicial (piloto Comercial em modo Reconhecimento)
-- Tudo aqui pode ser alterado depois pelas telas do sistema.

-- Feriados (nacionais + Bahia + Salvador). Pontos facultativos ficam de fora; o admin pode incluir.
insert into trackco.feriados (data, descricao) values
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-24', 'São João (Salvador)'),
  ('2026-07-02', 'Independência da Bahia'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Dia da Consciência Negra'),
  ('2026-12-08', 'Nossa Senhora da Conceição da Praia (Salvador)'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternização Universal'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'),
  ('2027-05-01', 'Dia do Trabalho'),
  ('2027-06-24', 'São João (Salvador)'),
  ('2027-07-02', 'Independência da Bahia'),
  ('2027-09-07', 'Independência do Brasil'),
  ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'),
  ('2027-11-15', 'Proclamação da República'),
  ('2027-11-20', 'Dia da Consciência Negra'),
  ('2027-12-08', 'Nossa Senhora da Conceição da Praia (Salvador)'),
  ('2027-12-25', 'Natal')
on conflict (data) do nothing;

-- Equipe piloto
insert into trackco.equipes (nome, descricao, visibilidade_ranking)
values ('Comercial', 'Atendentes que agendam consultas (piloto do Trackco).', 'posicoes')
on conflict (nome) do nothing;

-- Métricas padrão (Q7: quantitativo pela data do agendamento; qualitativo pela data de realização)
insert into trackco.metricas (codigo, nome, descricao, tipo, unidade, definicao) values
(
  'agendamentos', 'Agendamentos',
  'Quantas consultas Particular o atendente agendou, contadas no dia em que o agendamento foi feito.',
  'quantitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_em",
    "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"}]}'
),
(
  'realizadas', 'Consultas realizadas',
  'Quantas consultas Particular agendadas pelo atendente de fato aconteceram, contadas no dia em que aconteceram (mesmo que tenham sido agendadas em outro mês).',
  'qualitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_realizacao",
    "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"},{"campo":"atendido","op":"verdadeiro"}]}'
),
(
  'conversao', 'Taxa de conversão',
  'Das consultas Particular marcadas para o mês (até ontem), quantas % aconteceram.',
  'qualitativa', '%',
  '{"tipo_calculo":"taxa","corte":"ontem",
    "numerador":{"fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
                 "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"},{"campo":"atendido","op":"verdadeiro"}]},
    "denominador":{"fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_para",
                   "filtros":[{"campo":"operadora","op":"igual","valor":"Particular"}]}}'
),
(
  'agendamentos_sus', 'Agendamentos SUS',
  'Agendamentos da operadora SUS, pela data do agendamento.',
  'quantitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_agendado_em",
    "filtros":[{"campo":"operadora","op":"contem","valor":"SUS"}]}'
),
(
  'realizadas_sus', 'Realizadas SUS',
  'Consultas SUS agendadas pelo atendente que aconteceram, pela data de realização.',
  'qualitativa', 'un',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"klingo_agendamentos","agregacao":"contar","campo_data":"data_realizacao",
    "filtros":[{"campo":"operadora","op":"contem","valor":"SUS"},{"campo":"atendido","op":"verdadeiro"}]}'
),
(
  'avaliacao_lider', 'Avaliação qualitativa do líder',
  'Nota lançada manualmente pelo admin (0 a 10) sobre a liderança no mês.',
  'qualitativa', 'pts',
  '{"tipo_calculo":"simples","corte":"hoje","fonte":"lancamentos","agregacao":"somar","campo_data":"data","campo_valor":"valor",
    "filtros":[{"campo":"tipo","op":"igual","valor":"avaliacao_lider"}]}'
)
on conflict (codigo) do nothing;

-- Plano de Reconhecimento da equipe Comercial (versão 1 publicada, vigente desde jan/2026 para permitir conferir meses passados)
do $$
declare
  v_equipe uuid;
  v_plano uuid;
  v_ag uuid;
  v_re uuid;
  v_cv uuid;
  v_def jsonb;
begin
  select id into v_equipe from trackco.equipes where nome = 'Comercial';
  select id into v_ag from trackco.metricas where codigo = 'agendamentos';
  select id into v_re from trackco.metricas where codigo = 'realizadas';
  select id into v_cv from trackco.metricas where codigo = 'conversao';

  if exists (select 1 from trackco.planos where equipe_id = v_equipe) then
    return;
  end if;

  v_def := jsonb_build_object(
    'indicadores', jsonb_build_array(
      jsonb_build_object('id', 'ind-agendamentos', 'metrica_id', v_ag, 'escopo', 'individual', 'aplica_a', 'membros',
                         'peso', 50, 'teto_pct', 150, 'meta_proporcional', true),
      jsonb_build_object('id', 'ind-realizadas', 'metrica_id', v_re, 'escopo', 'individual', 'aplica_a', 'membros',
                         'peso', 50, 'teto_pct', 150, 'meta_proporcional', true),
      jsonb_build_object('id', 'ind-conversao', 'metrica_id', v_cv, 'escopo', 'individual', 'aplica_a', 'membros',
                         'peso', 0, 'teto_pct', 150, 'meta_proporcional', false),
      jsonb_build_object('id', 'ind-eq-agendamentos', 'nome', 'Agendamentos da equipe', 'metrica_id', v_ag, 'escopo', 'equipe',
                         'aplica_a', 'lider', 'peso', 50, 'teto_pct', 150, 'meta_proporcional', true, 'incluir_lider', false),
      jsonb_build_object('id', 'ind-eq-realizadas', 'nome', 'Realizadas da equipe', 'metrica_id', v_re, 'escopo', 'equipe',
                         'aplica_a', 'lider', 'peso', 50, 'teto_pct', 150, 'meta_proporcional', true, 'incluir_lider', false)
    ),
    'faixas', jsonb_build_array(
      jsonb_build_object('id', 'fx-dev', 'de_pct', 0, 'ate_pct', 80, 'nivel', 'Em desenvolvimento', 'cor', '#64748b'),
      jsonb_build_object('id', 'fx-quase', 'de_pct', 80, 'ate_pct', 100, 'nivel', 'Quase lá', 'cor', '#0ea5e9'),
      jsonb_build_object('id', 'fx-meta', 'de_pct', 100, 'ate_pct', 120, 'nivel', 'Meta batida', 'cor', '#16a34a',
                         'recompensa', jsonb_build_object('tipo', 'reconhecimento', 'descricao', 'Selo Meta batida')),
      jsonb_build_object('id', 'fx-destaque', 'de_pct', 120, 'ate_pct', null, 'nivel', 'Destaque', 'cor', '#f59e0b',
                         'recompensa', jsonb_build_object('tipo', 'reconhecimento', 'descricao', 'Destaque do mês'))
    ),
    'condicoes', '[]'::jsonb
  );

  insert into trackco.planos (nome, descricao, equipe_id, modalidade, status, rascunho)
  values ('Comercial · Reconhecimento',
          'Fase de reconhecimento (2 primeiros meses): acompanhar e validar os dados, sem prêmios.',
          v_equipe, 'reconhecimento', 'ativo', v_def)
  returning id into v_plano;

  insert into trackco.plano_versoes (plano_id, numero, definicao, vigente_desde, observacao)
  values (v_plano, 1, v_def, '2026-01-01', 'Versão inicial do piloto.');
end $$;

-- Colaboradores: importa do relatorio (public.usuarios) a equipe Comercial e os admins.
-- O admin confirma no app quem é o líder. Ninguém mais é importado automaticamente.
do $$
declare v_equipe uuid;
begin
  if to_regclass('public.usuarios') is null then
    raise notice 'public.usuarios não existe; nenhum colaborador importado.';
    return;
  end if;
  select id into v_equipe from trackco.equipes where nome = 'Comercial';

  insert into trackco.colaboradores (auth_id, nome, login, login_klingo, papel, ativo)
  select u.auth_id, u.nome, u.login_site, nullif(u.login_klingo, ''),
         case when u.papel = 'admin' then 'admin' else 'colaborador' end, u.ativo
  from public.usuarios u
  where u.equipe = 'Comercial' or u.papel = 'admin'
  on conflict do nothing;

  insert into trackco.equipe_membros (equipe_id, colaborador_id, funcao, inicio)
  select v_equipe, c.id, 'membro', '2026-01-01'
  from trackco.colaboradores c
  join public.usuarios u on lower(u.login_klingo) = lower(c.login_klingo)
  where u.equipe = 'Comercial'
  on conflict do nothing;
end $$;
