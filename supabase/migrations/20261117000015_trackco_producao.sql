-- Trackco · faturamento (relatório 319 do Klingo) para a área Gestão (só administradores)
--
-- O 319 já era baixado pelo robô, mas só servia para marcar "atendido" nas marcações; as linhas eram descartadas.
-- Agora ficam guardadas SOMADAS POR DIA (sem paciente, sem repasse médico), como o financeiro do sistema relatorio:
-- uma linha por dia × médico × operadora × categoria × procedimento.
-- Ninguém logado lê esta tabela direto: só o servidor do Trackco (secret key), depois de conferir que é admin.

create table if not exists trackco.klingo_producao (
  data            date not null,
  medico          text not null default '',
  operadora       text not null default '',
  categoria       text not null default '',
  procedimento    text not null default '',
  qtd             numeric not null default 0,
  valor           numeric(14, 2) not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (data, medico, operadora, categoria, procedimento)
);
comment on table trackco.klingo_producao is
  'Faturamento do Klingo (relatório 319) somado por dia/médico/operadora/categoria/procedimento. Sem paciente. Só admin (pelo servidor).';

alter table trackco.klingo_producao enable row level security;
revoke all on trackco.klingo_producao from public, anon, authenticated;
grant all on trackco.klingo_producao to service_role;

-- O robô troca o mês inteiro de uma vez (estornos e correções no Klingo somem/aparecem certinho).
-- Mês vazio nunca apaga o que já existe (protege contra falha silenciosa do Klingo).
create or replace function trackco.klingo_producao_sincronizar_mes(p_mes date, p_linhas jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_removidas int;
  v_gravadas int;
begin
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    return jsonb_build_object('mes', v_ini, 'gravadas', 0, 'ignorado', true);
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_linhas) as x(data date)
    where x.data is null or x.data < v_ini or x.data > v_fim
  ) then
    raise exception 'linhas de faturamento fora do mês %', to_char(v_ini, 'YYYY-MM');
  end if;

  delete from trackco.klingo_producao where data between v_ini and v_fim;
  get diagnostics v_removidas = row_count;

  insert into trackco.klingo_producao (data, medico, operadora, categoria, procedimento, qtd, valor)
  select x.data, coalesce(trim(x.medico), ''), coalesce(trim(x.operadora), ''), coalesce(trim(x.categoria), ''),
         coalesce(trim(x.procedimento), ''), sum(coalesce(x.qtd, 0)), sum(coalesce(x.valor, 0))
  from jsonb_to_recordset(p_linhas) as x(data date, medico text, operadora text, categoria text, procedimento text, qtd numeric, valor numeric)
  group by 1, 2, 3, 4, 5;
  get diagnostics v_gravadas = row_count;

  return jsonb_build_object('mes', v_ini, 'gravadas', v_gravadas, 'removidas', v_removidas);
end $$;

revoke all on function trackco.klingo_producao_sincronizar_mes(date, jsonb) from public, anon, authenticated;
grant execute on function trackco.klingo_producao_sincronizar_mes(date, jsonb) to service_role;

-- Gestão: faturamento do período, já em JSON (uma ida ao banco, sem o limite de 1.000 linhas da API).
create or replace function trackco.gestao_producao(p_ini date, p_fim date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(
           to_char(p.data, 'YYYY-MM-DD'), p.medico, p.operadora, p.categoria, p.procedimento, p.qtd, p.valor)
         order by p.data), '[]'::jsonb)
  from trackco.klingo_producao p
  where p.data between p_ini and p_fim
$$;

-- Gestão: total por mês (para "É sazonal?": todos os meses guardados).
create or replace function trackco.gestao_producao_mensal()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(m.mes, m.operadora, m.categoria, m.qtd, m.valor) order by m.mes), '[]'::jsonb)
  from (
    select to_char(p.data, 'YYYY-MM') as mes, p.operadora, p.categoria, sum(p.qtd) as qtd, sum(p.valor) as valor
    from trackco.klingo_producao p
    group by 1, 2, 3
  ) m
$$;

-- Gestão: marcações do período (pela data do agendamento), somadas por mês × quem marcou × procedimento ×
-- profissional × operadora. Traz quantas aconteceram, quantas já dá para conferir, as perdas e o R$ gerado.
create or replace function trackco.gestao_marcacoes(p_ini date, p_fim date, p_hoje date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(
           g.mes, g.login, g.procedimento, g.profissional, g.operadora,
           g.n, g.verificaveis, g.atendidas, g.faltas, g.canceladas, g.remarcadas, g.valor)), '[]'::jsonb)
  from (
    select to_char(k.data_agendado_em, 'YYYY-MM') as mes,
           coalesce(lower(k.responsavel_login), '') as login,
           coalesce(k.procedimento, '') as procedimento,
           coalesce(k.profissional, '') as profissional,
           coalesce(k.operadora, '') as operadora,
           count(*) as n,
           -- dá para conferir: a data já passou e a situação entra na conta do comparecimento
           count(*) filter (where k.data_agendado_para <= p_hoje
                              and coalesce(k.situacao, '') not in ('remarcada', 'falta_remarcada', 'bloqueio_clinica', 'erro')) as verificaveis,
           count(*) filter (where k.atendido) as atendidas,
           count(*) filter (where k.situacao in ('falta', 'nao_realizada')) as faltas,
           count(*) filter (where k.situacao = 'cancelada') as canceladas,
           count(*) filter (where k.situacao in ('remarcada', 'falta_remarcada')) as remarcadas,
           coalesce(sum(k.valor) filter (where k.atendido), 0) as valor
    from trackco.klingo_agendamentos k
    where k.data_agendado_em between p_ini and p_fim
    group by 1, 2, 3, 4, 5
  ) g
$$;

-- Gestão: marcações por dia × quem marcou × operadora (evolução e comparação de períodos com os mesmos dias).
create or replace function trackco.gestao_marcacoes_dia(p_ini date, p_fim date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(g.data, g.login, g.operadora, g.n, g.atendidas, g.valor) order by g.data), '[]'::jsonb)
  from (
    select to_char(k.data_agendado_em, 'YYYY-MM-DD') as data,
           coalesce(lower(k.responsavel_login), '') as login,
           coalesce(k.operadora, '') as operadora,
           count(*) as n,
           count(*) filter (where k.atendido) as atendidas,
           coalesce(sum(k.valor) filter (where k.atendido), 0) as valor
    from trackco.klingo_agendamentos k
    where k.data_agendado_em between p_ini and p_fim
    group by 1, 2, 3
  ) g
$$;

-- Gestão: perdas pelo dia da consulta (faltas, cancelamentos, remarcações) com o motivo registrado no Klingo.
create or replace function trackco.gestao_perdas(p_ini date, p_fim date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(g.situacao, g.motivo, g.login, g.procedimento, g.profissional, g.operadora, g.n)), '[]'::jsonb)
  from (
    select k.situacao,
           coalesce(nullif(trim(k.motivo), ''), '') as motivo,
           coalesce(lower(k.responsavel_login), '') as login,
           coalesce(k.procedimento, '') as procedimento,
           coalesce(k.profissional, '') as profissional,
           coalesce(k.operadora, '') as operadora,
           count(*) as n
    from trackco.klingo_agendamentos k
    where k.data_agendado_para between p_ini and p_fim
      and k.situacao in ('falta', 'nao_realizada', 'cancelada', 'remarcada', 'falta_remarcada')
    group by 1, 2, 3, 4, 5, 6
  ) g
$$;

-- Conferência dos dados: quanto do faturamento Particular de cada mês ficou ligado a uma marcação
-- (o sistema relatorio avisava abaixo de 95%; sobra = atendimento sem marcação no 2331 ou cruzamento que falhou).
create or replace function trackco.gestao_cobertura(p_desde date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with fat as (
    select to_char(data, 'YYYY-MM') as mes, sum(valor) as total from trackco.klingo_producao
    where data >= p_desde and operadora ilike 'partic%' group by 1
  ), lig as (
    select to_char(data_realizacao, 'YYYY-MM') as mes, sum(valor) as ligado
    from trackco.klingo_agendamentos where atendido and data_realizacao >= p_desde and operadora ilike 'partic%' group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_array(f.mes, coalesce(l.ligado, 0), f.total) order by f.mes), '[]'::jsonb)
  from fat f left join lig l using (mes)
$$;

revoke all on function trackco.gestao_cobertura(date) from public, anon, authenticated;
grant execute on function trackco.gestao_cobertura(date) to service_role;
revoke all on function trackco.gestao_producao(date, date) from public, anon, authenticated;
revoke all on function trackco.gestao_producao_mensal() from public, anon, authenticated;
revoke all on function trackco.gestao_marcacoes(date, date, date) from public, anon, authenticated;
revoke all on function trackco.gestao_marcacoes_dia(date, date) from public, anon, authenticated;
revoke all on function trackco.gestao_perdas(date, date) from public, anon, authenticated;
grant execute on function trackco.gestao_producao(date, date) to service_role;
grant execute on function trackco.gestao_producao_mensal() to service_role;
grant execute on function trackco.gestao_marcacoes(date, date, date) to service_role;
grant execute on function trackco.gestao_marcacoes_dia(date, date) to service_role;
grant execute on function trackco.gestao_perdas(date, date) to service_role;
