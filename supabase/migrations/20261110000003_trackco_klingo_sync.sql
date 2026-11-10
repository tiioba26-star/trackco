-- Trackco · funções usadas pelo robô do Klingo (somente service_role)

-- Substitui as marcações de um mês (por data_agendado_em) pelo retrato atual do relatório 2331.
-- Linhas que sumiram do Klingo (canceladas/excluídas) são removidas; o resultado do cruzamento
-- (atendido/valor/data_realizacao) é preservado nas linhas que continuam iguais.
create or replace function trackco.klingo_sincronizar_mes(p_mes date, p_linhas jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_upsert int;
  v_removidas int;
begin
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    -- mês vazio nunca apaga o que já existe (protege contra falha silenciosa do Klingo)
    return jsonb_build_object('mes', v_ini, 'upsert', 0, 'removidas', 0, 'ignorado', true);
  end if;

  drop table if exists pg_temp._novas;
  create temporary table _novas on commit drop as
  select * from jsonb_to_recordset(p_linhas) as x(
    chave text, data_agendado_em date, data_agendado_para date, responsavel_login text, paciente_nome text,
    procedimento text, profissional text, operadora text, qtd numeric);

  if exists (select 1 from _novas where data_agendado_em < v_ini or data_agendado_em > v_fim) then
    raise exception 'linhas fora do mês %', to_char(v_ini, 'YYYY-MM');
  end if;

  insert into trackco.klingo_agendamentos as k
    (chave, data_agendado_em, data_agendado_para, responsavel_login, paciente_nome, procedimento, profissional, operadora, qtd, sincronizado_em)
  select chave, data_agendado_em, data_agendado_para, lower(nullif(trim(responsavel_login), '')), paciente_nome,
         procedimento, profissional, operadora, coalesce(qtd, 1), now()
  from _novas
  on conflict (chave) do update set
    data_agendado_para = excluded.data_agendado_para,
    responsavel_login  = excluded.responsavel_login,
    paciente_nome      = excluded.paciente_nome,
    procedimento       = excluded.procedimento,
    profissional       = excluded.profissional,
    operadora          = excluded.operadora,
    qtd                = excluded.qtd,
    sincronizado_em    = now();
  get diagnostics v_upsert = row_count;

  delete from trackco.klingo_agendamentos k
  where k.data_agendado_em between v_ini and v_fim
    and not exists (select 1 from _novas n where n.chave = k.chave);
  get diagnostics v_removidas = row_count;

  return jsonb_build_object('mes', v_ini, 'upsert', v_upsert, 'removidas', v_removidas);
end $$;

-- Marcações com consulta marcada num mês: o robô usa para cruzar com a produção (319).
create or replace function trackco.klingo_marcacoes_para(p_mes date)
returns table (chave text, data_agendado_em date, data_agendado_para date, responsavel_login text,
               paciente_nome text, procedimento text, profissional text, qtd numeric, operadora text)
language sql stable security definer set search_path = '' as $$
  select k.chave, k.data_agendado_em, k.data_agendado_para, k.responsavel_login, k.paciente_nome,
         k.procedimento, k.profissional, k.qtd, k.operadora
  from trackco.klingo_agendamentos k
  where k.data_agendado_para >= date_trunc('month', p_mes)::date
    and k.data_agendado_para < (date_trunc('month', p_mes) + interval '1 month')::date
  order by k.data_agendado_para, k.data_agendado_em, k.chave
$$;

-- Grava o resultado do cruzamento 2331 x 319.
create or replace function trackco.klingo_marcar_atendidos(p_linhas jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  update trackco.klingo_agendamentos k set
    atendido        = x.atendido,
    valor           = x.valor,
    data_realizacao = case when x.atendido then coalesce(x.data_realizacao, k.data_agendado_para) end
  from jsonb_to_recordset(p_linhas) as x(chave text, atendido boolean, valor numeric, data_realizacao date)
  where k.chave = x.chave
    and (k.atendido is distinct from x.atendido or k.valor is distinct from x.valor
         or k.data_realizacao is distinct from case when x.atendido then coalesce(x.data_realizacao, k.data_agendado_para) end);
  get diagnostics v = row_count;
  return v;
end $$;

revoke all on function trackco.klingo_sincronizar_mes(date, jsonb) from public, anon, authenticated;
revoke all on function trackco.klingo_marcacoes_para(date) from public, anon, authenticated;
revoke all on function trackco.klingo_marcar_atendidos(jsonb) from public, anon, authenticated;
grant execute on function trackco.klingo_sincronizar_mes(date, jsonb) to service_role;
grant execute on function trackco.klingo_marcacoes_para(date) to service_role;
grant execute on function trackco.klingo_marcar_atendidos(jsonb) to service_role;
