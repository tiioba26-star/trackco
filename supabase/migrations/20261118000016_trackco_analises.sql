-- Trackco · dados para as análises comentadas pela IA (área Gestão, só administradores)
--
-- Três funções somadas (sem paciente), lidas só pelo servidor do Trackco (secret key):
-- - gestao_series_mensais: mês a mês, por quem marcou e operadora (tendências de cada pessoa e equipe);
-- - gestao_desfechos: mês a mês da DATA DA CONSULTA, por operadora e situação (taxas de falta e cancelamento);
-- - gestao_desfechos_profissional: o mesmo no período, por médico/agenda.

create or replace function trackco.gestao_series_mensais(p_ini date, p_fim date, p_hoje date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(
           g.mes, g.login, g.operadora, g.n, g.verificaveis, g.atendidas, g.faltas, g.canceladas, g.valor)
         order by g.mes), '[]'::jsonb)
  from (
    select to_char(k.data_agendado_em, 'YYYY-MM') as mes,
           coalesce(lower(k.responsavel_login), '') as login,
           coalesce(k.operadora, '') as operadora,
           count(*) as n,
           count(*) filter (where k.data_agendado_para <= p_hoje
                              and coalesce(k.situacao, '') not in ('remarcada', 'falta_remarcada', 'bloqueio_clinica', 'erro')) as verificaveis,
           count(*) filter (where k.atendido) as atendidas,
           count(*) filter (where k.situacao in ('falta', 'nao_realizada')) as faltas,
           count(*) filter (where k.situacao = 'cancelada') as canceladas,
           coalesce(sum(k.valor) filter (where k.atendido), 0) as valor
    from trackco.klingo_agendamentos k
    where k.data_agendado_em between p_ini and p_fim
    group by 1, 2, 3
  ) g
$$;

create or replace function trackco.gestao_desfechos(p_ini date, p_fim date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(g.mes, g.operadora, g.situacao, g.n) order by g.mes), '[]'::jsonb)
  from (
    select to_char(k.data_agendado_para, 'YYYY-MM') as mes,
           coalesce(k.operadora, '') as operadora,
           coalesce(k.situacao, case when k.atendido then 'realizada' else 'sem_desfecho' end) as situacao,
           count(*) as n
    from trackco.klingo_agendamentos k
    where k.data_agendado_para between p_ini and p_fim
    group by 1, 2, 3
  ) g
$$;

-- Desfechos do período por médico/agenda (taxa de falta e cancelamento de cada agenda).
create or replace function trackco.gestao_desfechos_profissional(p_ini date, p_fim date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(g.profissional, g.operadora, g.situacao, g.n)), '[]'::jsonb)
  from (
    select coalesce(k.profissional, '') as profissional,
           coalesce(k.operadora, '') as operadora,
           coalesce(k.situacao, case when k.atendido then 'realizada' else 'sem_desfecho' end) as situacao,
           count(*) as n
    from trackco.klingo_agendamentos k
    where k.data_agendado_para between p_ini and p_fim
    group by 1, 2, 3
  ) g
$$;

revoke all on function trackco.gestao_desfechos_profissional(date, date) from public, anon, authenticated;
grant execute on function trackco.gestao_desfechos_profissional(date, date) to service_role;
revoke all on function trackco.gestao_series_mensais(date, date, date) from public, anon, authenticated;
revoke all on function trackco.gestao_desfechos(date, date) from public, anon, authenticated;
grant execute on function trackco.gestao_series_mensais(date, date, date) to service_role;
grant execute on function trackco.gestao_desfechos(date, date) to service_role;
